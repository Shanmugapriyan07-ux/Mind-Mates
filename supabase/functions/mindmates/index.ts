import { serve }        from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0';

declare const Deno: { env: { get(k: string): string | undefined } };

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const corsOk = () => new Response('ok', { status: 200, headers: CORS });
const json   = (d: any, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

const T = { users: 'users', conn: 'connections', notif: 'notifications', chats: 'chats', messages: 'messages', blocks: 'blocks' };

const rl = new Map<string, number[]>();
const rateLimit = (uid: string, action: string, max = 10): boolean => {
  const k = `${uid}:${action}`, now = Date.now();
  const r = (rl.get(k) ?? []).filter(t => now - t < 60_000);
  if (r.length >= max) return false;
  r.push(now); rl.set(k, r); return true;
};

// ── Match cache ───────────────────────────────────────────────────
// Cache key now includes a hash of the user's skills so that if
// a user updates their skills, the old cached result is ignored.
const mc = new Map<string, { data: any; at: number; skillsKey: string }>();
const MC_TTL = 5 * 60 * 1000;

const parseSkills = (s: any): string[] =>
  !s ? [] : String(s).split(',').map((x: string) => x.trim().toLowerCase()).filter(Boolean);
const normCity = (s: any): string =>
  (s ?? '').toString().toLowerCase().trim().split(',')[0].trim();

async function push(sb: any, userId: string, title: string, body: string, data: any = {}) {
  try {
    const { data: u } = await sb.from(T.users).select('push_token').eq('user_id', userId).maybeSingle();
    if (!u?.push_token) return;
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: u.push_token, title, body, data, sound: 'default', badge: 1 }),
    });
  } catch {}
}

async function updateCounts(sb: any, uid1: string, uid2: string) {
  const count = async (uid: string) => {
    const { count: n } = await sb.from(T.conn).select('*', { count: 'exact', head: true })
      .eq('status', 'accepted').or(`sender_id.eq.${uid},receiver_id.eq.${uid}`);
    return n ?? 0;
  };
  Promise.all([uid1, uid2].map(async uid => {
    const n = await count(uid);
    await sb.from(T.users).update({ connections: n }).eq('user_id', uid);
  })).catch(() => {});
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsOk();

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let senderId: string | null = null;
  const auth = req.headers.get('authorization') ?? req.headers.get('Authorization') ?? '';
  if (auth) {
    const { data: { user } } = await sb.auth.getUser(auth.replace('Bearer ', ''));
    if (user) senderId = user.id;
  }

  let body: any = {};
  try {
    const raw = await req.json();
    body = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch { body = {}; }
  const action = (body.action ?? '').trim();
  console.log(`ACTION=${action} sender=${senderId ?? 'anon'} body_keys=${Object.keys(body).join(',')}`);

  if (action === 'getMatches') return doGetMatches(sb, body);
  if (!senderId) return json({ error: 'Unauthorized' }, 401);

  try {
    return await doAction(sb, action, body, senderId);
  } catch (e: any) {
    console.error(`UNCAUGHT in ${action}:`, e?.message ?? e);
    return json({ error: e?.message ?? 'Internal server error', action }, 500);
  }
});

async function doAction(sb: any, action: string, body: any, senderId: string) {

  if (action === 'send_request') {
    const { receiverId } = body;
    if (!receiverId)             return json({ error: 'Missing receiverId' }, 400);
    if (senderId === receiverId) return json({ error: 'Cannot connect with yourself' }, 400);
    if (!rateLimit(senderId, 'send', 10)) return json({ error: 'Too many requests' }, 429);
    const { data: existing } = await sb.from(T.conn).select('id, status')
      .or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`)
      .maybeSingle();
    if (existing) {
      return json({ success: false, alreadyExists: true, connectionId: existing.id, status: existing.status, error: 'Connection already exists' }, 409);
    }
    const { data: sp } = await sb.from(T.users)
      .select('full_name, profile_image, skills, location').eq('user_id', senderId).maybeSingle();
    const { data: conn, error: connErr } = await sb.from(T.conn)
      .insert({ sender_id: senderId, receiver_id: receiverId, status: 'pending' })
      .select('id').single();
    if (connErr) { console.error('Connection insert failed:', connErr.message, connErr.details); return json({ error: connErr.message }, 500); }
    console.log(`Connection created: ${conn.id}`);
    const { error: notifErr } = await sb.from(T.notif).insert({
      user_id:         receiverId,
      sender_id:       senderId,
      sender_name:     sp?.full_name      ?? '',
      sender_image:    sp?.profile_image  ?? '',
      sender_skills:   sp?.skills         ?? '',
      sender_location: sp?.location       ?? '',
      type:            'connection_request',
      connection_id:   conn.id,
      is_read:         false,
    });
    if (notifErr) console.error('Notification insert failed:', notifErr.message, notifErr.details);
    else console.log(`Notification created for ${receiverId}`);
    push(sb, receiverId, 'New Friend Request 👋',
      `${sp?.full_name ?? 'Someone'} wants to connect`,
      { type: 'connection_request', senderId, connectionId: conn.id });
    return json({ success: true, connectionId: conn.id });
  }

  if (action === 'accept_request') {
    let { connectionId, notifId } = body;
    console.log(`accept: connId=${connectionId} notifId=${notifId} receiver=${senderId}`);
    let conn: any = null;
    if (connectionId) {
      const { data } = await sb.from(T.conn).select('*').eq('id', connectionId).maybeSingle();
      if (data) { conn = data; console.log('found by connectionId'); }
    }
    if (!conn && notifId) {
      const { data: notif } = await sb.from(T.notif).select('connection_id, sender_id').eq('id', notifId).maybeSingle();
      if (notif?.connection_id) {
        const { data } = await sb.from(T.conn).select('*').eq('id', notif.connection_id).maybeSingle();
        if (data) { conn = data; connectionId = data.id; console.log('found via notif.connection_id'); }
      }
      if (!conn && notif?.sender_id) {
        const { data } = await sb.from(T.conn).select('*')
          .eq('sender_id', notif.sender_id).eq('receiver_id', senderId).eq('status', 'pending')
          .maybeSingle();
        if (data) { conn = data; connectionId = data.id; console.log('found by sender+receiver'); }
      }
    }
    if (!conn) {
      const { data } = await sb.from(T.conn).select('*')
        .eq('receiver_id', senderId).eq('status', 'pending')
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (data) { conn = data; connectionId = data.id; console.log('found as most recent pending'); }
    }
    if (!conn) { console.error('All strategies failed'); return json({ error: 'Connection not found' }, 404); }
    if (conn.receiver_id !== senderId) return json({ error: 'Not authorized' }, 403);
    if (conn.status !== 'pending') return json({ error: `Status is ${conn.status}` }, 409);
    const chatKey = [senderId, conn.sender_id].sort().join('_');
    let chatId: string;
    const { data: existChat } = await sb.from(T.chats).select('id').eq('chat_key', chatKey).maybeSingle();
    if (existChat) {
      chatId = existChat.id;
      await sb.from(T.messages).delete().eq('chat_id', chatId);
      await sb.from(T.chats).update({
        last_message: '', last_message_at: null, last_sender_id: null, last_message_status: 'sent',
      }).eq('id', chatId);
      console.log(`Re-connect: cleared old messages for chat ${chatId}`);
    } else {
      const { data: newChat, error: chatErr } = await sb.from(T.chats)
        .insert({ participants: [senderId, conn.sender_id], chat_key: chatKey, last_message: '' })
        .select('id').single();
      if (chatErr) { console.error('Chat create failed:', chatErr.message); return json({ error: chatErr.message }, 500); }
      chatId = newChat.id;
    }
    console.log(`Chat: ${chatId}`);
    await sb.from(T.conn).update({ status: 'accepted', chat_id: chatId }).eq('id', connectionId);
    if (notifId) await sb.from(T.notif).update({ is_read: true, type: 'accepted' }).eq('id', notifId);
    updateCounts(sb, senderId, conn.sender_id);
    const { data: accepter } = await sb.from(T.users).select('full_name').eq('user_id', senderId).maybeSingle();
    push(sb, conn.sender_id, 'Connection Accepted! 🎉',
      `${accepter?.full_name ?? 'Someone'} accepted your friend request`,
      { type: 'connection_accepted', chatId, userId: senderId });
    console.log(`accept SUCCESS: connId=${connectionId} chatId=${chatId}`);
    return json({ success: true, chatId });
  }

  if (action === 'reject_request') {
    const { connectionId, notifId } = body;
    if (!connectionId) return json({ error: 'Missing connectionId' }, 400);
    const { data: conn } = await sb.from(T.conn).select('receiver_id,status').eq('id', connectionId).single();
    if (!conn) return json({ error: 'Not found' }, 404);
    if (conn.receiver_id !== senderId) return json({ error: 'Not authorized' }, 403);
    if (conn.status !== 'pending') return json({ error: 'Not pending' }, 409);
    await sb.from(T.conn).delete().eq('id', connectionId);
    if (notifId) await sb.from(T.notif).delete().eq('id', notifId).catch(() => {});
    return json({ success: true });
  }

  if (action === 'cancel_request') {
    const { connectionId } = body;
    if (!connectionId) return json({ error: 'Missing connectionId' }, 400);
    const { data: conn } = await sb.from(T.conn).select('sender_id,status').eq('id', connectionId).single();
    if (!conn) return json({ error: 'Not found' }, 404);
    if (conn.sender_id !== senderId) return json({ error: 'Not authorized' }, 403);
    if (conn.status !== 'pending') return json({ error: 'Not pending' }, 409);
    const { data: notif } = await sb.from(T.notif).select('id').eq('connection_id', connectionId).maybeSingle();
    await sb.from(T.conn).delete().eq('id', connectionId);
    if (notif) await sb.from(T.notif).delete().eq('id', notif.id).catch(() => {});
    return json({ success: true });
  }

  if (action === 'send_message') {
    const { chatId, message, type = 'text',
            replyToId = null, replyToText = null, replyToSender = null } = body;
    if (!chatId || !message?.trim()) return json({ error: 'Missing chatId or message' }, 400);
    if (!rateLimit(senderId, 'msg', 60)) return json({ error: 'Too fast' }, 429);
    const { data: chat } = await sb.from(T.chats).select('*').eq('id', chatId).single();
    if (!chat) return json({ error: 'Chat not found' }, 404);
    const parts: string[] = chat.participants ?? [];
    if (!parts.includes(senderId)) return json({ error: 'Not a member' }, 403);
    const receiverId = parts.find((p: string) => p !== senderId) ?? '';
    const { data: block } = await sb.from(T.blocks).select('blocker_id')
      .or(`and(blocker_id.eq.${senderId},blocked_id.eq.${receiverId}),and(blocker_id.eq.${receiverId},blocked_id.eq.${senderId})`)
      .limit(1).maybeSingle();
    if (block) return json({ error: block.blocker_id === senderId ? 'You blocked this user' : 'Cannot message', blocked: true }, 403);
    const trimmed = message.trim(), now = new Date().toISOString();
    const [{ data: saved, error: msgErr }] = await Promise.all([
      sb.from(T.messages).insert({
        chat_id: chatId, sender_id: senderId, message: trimmed,
        type, status: 'sent',
        reply_to_id: replyToId, reply_to_text: replyToText, reply_to_sender: replyToSender,
      }).select('id, created_at').single(),
      sb.from(T.chats).update({
        last_message: trimmed, last_message_at: now, last_sender_id: senderId,
        last_message_status: 'sent', hidden_for: [],
      }).eq('id', chatId),
    ]);
    if (msgErr) return json({ error: msgErr.message }, 500);
    const { data: snd } = await sb.from(T.users).select('full_name,profile_image').eq('user_id', senderId).maybeSingle();
    push(sb, receiverId, snd?.full_name ?? 'New Message', trimmed.length > 60 ? trimmed.slice(0,60)+'…' : trimmed,
      { type: 'new_message', chatId, userId: senderId, senderName: snd?.full_name ?? '', senderImage: snd?.profile_image ?? '' });
    return json({ success: true, messageId: saved.id, createdAt: saved.created_at });
  }

  if (action === 'delete_message' || action === 'delete_for_me') {
    const { messageId } = body;
    if (!messageId) return json({ error: 'Missing messageId' }, 400);
    const { data: msg, error: fetchErr } = await sb.from(T.messages)
      .select('id, chat_id, sender_id, deleted_for').eq('id', messageId).single();
    if (fetchErr || !msg) return json({ error: 'Message not found' }, 404);
    const { data: chat } = await sb.from(T.chats).select('participants').eq('id', msg.chat_id).single();
    if (!chat?.participants?.includes(senderId)) return json({ error: 'Not a chat member' }, 403);
    const current: string[] = msg.deleted_for ?? [];
    if (!current.includes(senderId)) {
      const { error: updErr } = await sb.from(T.messages)
        .update({ deleted_for: [...current, senderId] }).eq('id', messageId);
      if (updErr) { console.error('delete_message update failed:', updErr.message); return json({ error: updErr.message }, 500); }
    }
    const { data: latest } = await sb.from(T.messages)
      .select('message, sender_id, created_at').eq('chat_id', msg.chat_id)
      .not('deleted_for', 'cs', `{${senderId}}`)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    await sb.from(T.chats).update({
      last_message: latest?.message ?? '', last_message_at: latest?.created_at ?? new Date().toISOString(),
      last_sender_id: latest?.sender_id ?? null, last_message_status: 'sent',
    }).eq('id', msg.chat_id);
    return json({ success: true });
  }

  if (action === 'delete_for_everyone') {
    const { messageId } = body;
    if (!messageId) return json({ error: 'Missing messageId' }, 400);
    const { data: msg, error: fetchErr } = await sb.from(T.messages)
      .select('id, chat_id, sender_id, created_at').eq('id', messageId).single();
    if (fetchErr || !msg) return json({ error: 'Message not found' }, 404);
    if (msg.sender_id !== senderId) return json({ error: 'Only sender can unsend' }, 403);
    const ageMs = Date.now() - new Date(msg.created_at).getTime();
    if (ageMs > 60_000) return json({ error: 'Unsend window expired (60 s)' }, 403);
    const { error: delErr } = await sb.from(T.messages).delete().eq('id', messageId);
    if (delErr) { console.error('delete_for_everyone failed:', delErr.message); return json({ error: delErr.message }, 500); }
    const { data: latest } = await sb.from(T.messages)
      .select('message, sender_id, created_at').eq('chat_id', msg.chat_id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    await sb.from(T.chats).update({
      last_message: latest?.message ?? '', last_message_at: latest?.created_at ?? new Date().toISOString(),
      last_sender_id: latest?.sender_id ?? null, last_message_status: 'sent',
    }).eq('id', msg.chat_id);
    return json({ success: true });
  }

  if (action === 'clear_chat') {
    const { chatId } = body;
    if (!chatId) return json({ error: 'Missing chatId' }, 400);
    const { data: chat, error: fetchErr } = await sb.from(T.chats)
      .select('participants, hidden_for').eq('id', chatId).single();
    if (fetchErr || !chat) return json({ error: 'Chat not found' }, 404);
    if (!chat.participants.includes(senderId)) return json({ error: 'Not a chat member' }, 403);
    const { error: rpcErr } = await sb.rpc('append_deleted_for', { p_chat_id: chatId, p_user_id: senderId });
    if (rpcErr) {
      console.warn('RPC failed, using fallback:', rpcErr.message);
      const { data: msgs } = await sb.from(T.messages).select('id, deleted_for').eq('chat_id', chatId);
      if (msgs?.length) {
        const updates = msgs
          .filter((m: any) => !(m.deleted_for ?? []).includes(senderId))
          .map((m: any) => sb.from(T.messages).update({ deleted_for: [...(m.deleted_for ?? []), senderId] }).eq('id', m.id));
        await Promise.all(updates);
      }
    }
    const hiddenFor: string[] = chat.hidden_for ?? [];
    if (!hiddenFor.includes(senderId)) {
      const { error: hideErr } = await sb.from(T.chats)
        .update({ hidden_for: [...hiddenFor, senderId] }).eq('id', chatId);
      if (hideErr) { console.error('clear_chat hide failed:', hideErr.message); return json({ error: hideErr.message }, 500); }
    }
    return json({ success: true });
  }

  if (action === 'hide_chat') {
    const { chatId } = body;
    if (!chatId) return json({ error: 'Missing chatId' }, 400);
    const { data: chat, error: fetchErr } = await sb.from(T.chats)
      .select('participants, hidden_for').eq('id', chatId).single();
    if (fetchErr) { console.error('hide_chat fetch failed:', fetchErr.message); return json({ error: fetchErr.message }, 500); }
    if (!chat) return json({ success: true });
    if (!chat.participants.includes(senderId)) return json({ error: 'Not a chat member' }, 403);
    const hiddenFor: string[] = chat.hidden_for ?? [];
    if (!hiddenFor.includes(senderId)) {
      const { error: updErr } = await sb.from(T.chats)
        .update({ hidden_for: [...hiddenFor, senderId] }).eq('id', chatId);
      if (updErr) { console.error('hide_chat update failed:', updErr.message); return json({ error: updErr.message }, 500); }
    }
    return json({ success: true });
  }

  if (action === 'check_block') {
    const { otherUserId } = body;
    if (!otherUserId) return json({ error: 'Missing otherUserId' }, 400);
    const { data: rows } = await sb.from(T.blocks).select('blocker_id')
      .or(`and(blocker_id.eq.${senderId},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${senderId})`);
    return json({
      success: true,
      iBlockedThem:  (rows ?? []).some((r: any) => r.blocker_id === senderId),
      theyBlockedMe: (rows ?? []).some((r: any) => r.blocker_id === otherUserId),
      isBlocked:     (rows ?? []).length > 0,
    });
  }

  if (action === 'block_user') {
    const { blockedId } = body;
    if (!blockedId || blockedId === senderId)
      return json({ error: !blockedId ? 'Missing blockedId' : 'Cannot block yourself' }, 400);
    const { data: ex } = await sb.from(T.blocks).select('id')
      .eq('blocker_id', senderId).eq('blocked_id', blockedId).maybeSingle();
    if (ex) return json({ success: true, alreadyBlocked: true });
    await sb.from(T.blocks).insert({ blocker_id: senderId, blocked_id: blockedId });
    return json({ success: true });
  }

  if (action === 'unblock_user') {
    const { blockedId } = body;
    if (!blockedId) return json({ error: 'Missing blockedId' }, 400);
    await sb.from(T.blocks).delete().eq('blocker_id', senderId).eq('blocked_id', blockedId);
    return json({ success: true });
  }

  if (action === 'edit_message') {
    const { messageId, newText } = body;
    if (!messageId || !newText?.trim()) return json({ error: 'Missing messageId or newText' }, 400);
    const { data: msg } = await sb.from(T.messages)
      .select('sender_id, chat_id, created_at').eq('id', messageId).single();
    if (!msg) return json({ error: 'Message not found' }, 404);
    if (msg.sender_id !== senderId) return json({ error: 'Not your message' }, 403);
    const trimmed = newText.trim();
    await sb.from(T.messages).update({ message: trimmed, edited: true }).eq('id', messageId);
    const { data: ch } = await sb.from(T.chats)
      .select('last_message_at').eq('id', msg.chat_id).single().catch(() => ({ data: null }));
    if (ch && new Date(ch.last_message_at).getTime() >= new Date(msg.created_at).getTime() - 1000) {
      await sb.from(T.chats).update({ last_message: trimmed }).eq('id', msg.chat_id).catch(() => {});
    }
    return json({ success: true });
  }

  if (action === 'react_message') {
    const { messageId, emoji } = body;
    if (!messageId || !emoji) return json({ error: 'Missing messageId or emoji' }, 400);
    const { data: msg } = await sb.from(T.messages).select('reactions, chat_id').eq('id', messageId).single();
    if (!msg) return json({ error: 'Message not found' }, 404);
    const { data: chat } = await sb.from(T.chats).select('participants').eq('id', msg.chat_id).single();
    if (!chat?.participants?.includes(senderId)) return json({ error: 'Not a member' }, 403);
    let reactions: { userId: string; emoji: string }[] = [];
    try { reactions = msg.reactions ? JSON.parse(msg.reactions) : []; } catch { reactions = []; }
    const idx = reactions.findIndex(r => r.userId === senderId && r.emoji === emoji);
    if (idx >= 0) reactions.splice(idx, 1);
    else { reactions = reactions.filter(r => r.userId !== senderId); reactions.push({ userId: senderId, emoji }); }
    await sb.from(T.messages).update({ reactions: JSON.stringify(reactions) }).eq('id', messageId);
    return json({ success: true, reactions });
  }

  if (action === 'delete_account') {
    const { userId } = body;
    if (!userId || userId !== senderId)
      return json({ error: 'Unauthorized: can only delete your own account' }, 403);
    try {
      const { data: userChats } = await sb.from(T.chats).select('id').contains('participants', [userId]);
      const chatIds: string[] = (userChats ?? []).map((c: any) => c.id);
      if (chatIds.length) {
        await sb.from(T.messages).delete().in('chat_id', chatIds);
        await sb.from(T.chats).delete().in('id', chatIds);
      }
      await sb.from(T.messages).delete().eq('sender_id', userId);
      await sb.from(T.notif).delete().eq('sender_id', userId);
      await sb.from(T.notif).delete().eq('user_id', userId);
      await sb.from(T.blocks).delete().eq('blocker_id', userId);
      await sb.from(T.blocks).delete().eq('blocked_id', userId);
      await sb.from(T.conn).delete().eq('sender_id', userId);
      await sb.from(T.conn).delete().eq('receiver_id', userId);
      await sb.from(T.users).delete().eq('user_id', userId);
      const svcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const svcUrl = Deno.env.get('SUPABASE_URL');
      if (svcKey && svcUrl) {
        const admin = createClient(svcUrl, svcKey, { auth: { autoRefreshToken: false, persistSession: false } });
        await admin.auth.admin.deleteUser(userId).catch((e: any) => console.error('auth delete:', e.message));
      }
      return json({ success: true });
    } catch (e: any) {
      console.error('delete_account error:', e?.message);
      return json({ error: e?.message ?? 'Delete failed' }, 500);
    }
  }

  if (action === 'remove_friend') {
    const { connectionId } = body;
    if (!connectionId) return json({ error: 'Missing connectionId' }, 400);
    const { data: conn } = await sb.from(T.conn)
      .select('sender_id, receiver_id, chat_id').eq('id', connectionId).maybeSingle();
    if (!conn) return json({ error: 'Connection not found' }, 404);
    if (conn.sender_id !== senderId && conn.receiver_id !== senderId)
      return json({ error: 'Not authorized' }, 403);
    await sb.from(T.conn).delete().eq('id', connectionId);
    if (conn.chat_id) {
      await sb.from(T.messages).delete().eq('chat_id', conn.chat_id);
      await sb.from(T.chats).update({
        last_message: '', last_message_at: null, last_sender_id: null, last_message_status: 'sent',
      }).eq('id', conn.chat_id);
    } else {
      const chatKey = [conn.sender_id, conn.receiver_id].sort().join('_');
      const { data: chat } = await sb.from(T.chats).select('id').eq('chat_key', chatKey).maybeSingle();
      if (chat) {
        await sb.from(T.messages).delete().eq('chat_id', chat.id);
        await sb.from(T.chats).update({
          last_message: '', last_message_at: null, last_sender_id: null, last_message_status: 'sent',
        }).eq('id', chat.id);
      }
    }
    updateCounts(sb, conn.sender_id, conn.receiver_id);
    return json({ success: true });
  }

  if (action === 'get_chat_id') {
    const { otherUserId } = body;
    if (!otherUserId) return json({ error: 'Missing otherUserId' }, 400);
    const chatKey = [senderId, otherUserId].sort().join('_');
    const { data: chat } = await sb.from(T.chats)
      .select('id, hidden_for, participants').eq('chat_key', chatKey).maybeSingle();
    if (!chat) return json({ chatId: null });
    return json({ chatId: chat.id, isHidden: (chat.hidden_for ?? []).includes(senderId) });
  }

  if (action === 'delete_cloudinary_image') {
    const { publicId, resourceType = 'image' } = body;
    if (!publicId) return json({ error: 'Missing publicId' }, 400);
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');
    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
    if (!apiKey || !apiSecret || !cloudName) {
      console.warn('delete_cloudinary_image: CLOUDINARY_* env vars not set, skipping');
      return json({ success: true, skipped: true });
    }
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sigStr = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const hashBuf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(sigStr));
    const signature = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
    const form = new FormData();
    form.append('public_id', publicId); form.append('timestamp', timestamp);
    form.append('api_key', apiKey);     form.append('signature', signature);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`, { method: 'POST', body: form });
    const result = await res.json();
    if (result.result === 'ok' || result.result === 'not found') return json({ success: true });
    return json({ error: result.result ?? 'Delete failed' }, 500);
  }

  if (action === 'sign_upload') {
    const { userId, resourceType = 'image' } = body;
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');
    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
    if (!apiKey || !apiSecret || !cloudName) {
      console.error('sign_upload: CLOUDINARY_* env vars not set');
      return json({ error: 'Cloudinary credentials not configured on server.' }, 500);
    }
    if (!userId) return json({ error: 'Missing userId' }, 400);
    const safeId   = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const publicId = `mindmates/profiles/profile_${safeId}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const paramsToSign: Record<string, string> = { overwrite: 'true', public_id: publicId, timestamp };
    const sigStr = Object.keys(paramsToSign).sort().map(k => `${k}=${paramsToSign[k]}`).join('&') + apiSecret;
    const hashBuf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(sigStr));
    const signature = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
    console.log(`sign_upload: userId=${userId} public_id=${publicId} sig=${signature.slice(0,8)}...`);
    return json({ success: true, signature, timestamp, apiKey, cloudName, publicId, resourceType });
  }

  return json({ error: `Unknown action: ${action}` }, 400);
}

// ══════════════════════════════════════════════════════════════════
// doGetMatches — FIXED VERSION
// ══════════════════════════════════════════════════════════════════
//
// ROOT CAUSE OF BLINK + WRONG RESULTS:
//
// OLD behaviour:
//   1. Cache check → returns stale data (possibly []) immediately
//   2. Query ALL users (limit 500) regardless of skills
//   3. Client receives all 500 users, renders them briefly
//   4. JS filter runs → re-renders with only matched users
//   → USER SEES: flash of ALL users → snaps to matches (the "blink")
//
// NEW behaviour:
//   1. Fetch MY profile first — needed for skills key
//   2. Check cache WITH skills key — stale cache from old skills is ignored
//   3. Build a SQL ILIKE filter that pre-filters on skills in the DATABASE
//      → only users who share at least 1 skill are ever fetched
//      → zero non-matching users ever hit the JS ranking layer
//   4. JS ranking runs on already-filtered set → correct results, first time
//   → USER SEES: loading → correct matches (no blink, no wrong results)
//
// SKILL FILTERING STRATEGY:
//   Supabase doesn't support array intersection natively in PostgREST.
//   We use .or() with multiple .ilike() conditions — one per skill.
//   e.g. skills has "photography,gym" → filter: skills.ilike.%photography%,skills.ilike.%gym%
//   This is a DB-level OR filter: any user whose skills column contains
//   at least one of my skills is returned. Then JS finds the exact common set.
//
async function doGetMatches(sb: any, body: any) {
  const { userId, limit = 20, bust = false } = body;
  if (!userId) return json({ error: 'userId required' }, 400);

  const t0 = Date.now();

  // ── Step 1: Fetch MY profile first ───────────────────────────
  // Must happen before cache check so we can validate the cache
  // against current skills (prevents serving stale skill-based results).
  const { data: me } = await sb.from(T.users)
    .select('skills, location')
    .eq('user_id', userId)
    .maybeSingle();

  if (!me) return json({ error: 'Profile not found' }, 404);

  const mySkills = parseSkills(me.skills);
  const myCity   = normCity(me.location);

  // No skills → no matches. Return empty immediately, don't cache.
  // This prevents the old bug where empty-skills users saw everyone.
  if (!mySkills.length) {
    return json({ matches: [], total: 0, hasMore: false, ms: Date.now() - t0 });
  }

  // Skills fingerprint — cache is invalid if skills changed
  const skillsKey = mySkills.slice().sort().join(',');
  const cacheKey  = `m_${userId}`;

  // ── Step 2: Cache check (with skills validation) ──────────────
  // Only return cache if: not busted, not expired, AND skills unchanged.
  // Previously: stale cache with wrong skills was returned → blink.
  if (!bust) {
    const h = mc.get(cacheKey);
    if (h && Date.now() - h.at < MC_TTL && h.skillsKey === skillsKey) {
      console.log(`[getMatches] cache hit for ${userId} in ${Date.now() - t0}ms`);
      return json({ ...h.data, src: 'cache', ms: Date.now() - t0 });
    }
  }

  // ── Step 3: DB-level skill pre-filter ─────────────────────────
  // Build OR filter: fetch only users who have at least ONE of my skills.
  // Format: "skills.ilike.%photography%,skills.ilike.%gym%"
  // This runs in Postgres — zero non-matching rows ever leave the DB.
  //
  // WHY NOT FULL TEXT SEARCH:
  //   Our skills are stored as comma-separated strings (e.g. "Photography,Gym").
  //   ilike with % wrapping handles case-insensitive substring match.
  //   It's not perfect (e.g. "Gym" matches "Gymnastics") but the JS
  //   exact-match filter below corrects any false positives.
  const skillFilter = mySkills
    .map(skill => `skills.ilike.%${skill}%`)
    .join(',');

  const { data: cands } = await sb
    .from(T.users)
    .select('user_id, full_name, bio, location, profile_image, skills')
    .eq('is_profile_complete', true)
    .neq('user_id', userId)
    .or(skillFilter)           // ← DB-level pre-filter: only skill-overlapping users
    .limit(500);

  const lim = Math.min(limit, 50);

  // ── Step 4: JS ranking on already-filtered candidates ─────────
  // At this point every candidate has at least 1 skill that ILIKE-matched.
  // We now compute exact common skills (case-insensitive) and rank.
  //
  // TIER SYSTEM (same as before):
  //   Tier 1: all skills match + same city  (perfect match)
  //   Tier 2: all skills match              (skill perfect)
  //   Tier 3: same city                     (local match)
  //   Tier 4: partial skill overlap         (basic match)
  //
  // SCORE:
  //   +10 per common skill
  //   +50 if all my skills are covered
  //   +30 if same city
  const ranked = (cands ?? []).map((u: any) => {
    const their  = parseSkills(u.skills);
    // Exact intersection — corrects any ILIKE false positives
    const common = mySkills.filter(s => their.includes(s));

    // Skip if no exact match (e.g. "Gym" matched "Gymnastics" in ILIKE)
    if (!common.length) return null;

    const sc    = normCity(u.location) === myCity && myCity.length > 0;
    const all   = common.length >= mySkills.length;
    const score = common.length * 10 + (all ? 50 : 0) + (sc ? 30 : 0);
    const tier  = all && sc ? 1 : all ? 2 : sc ? 3 : 4;

    return {
      userId:        u.user_id,
      fullName:      u.full_name      ?? '',
      bio:           u.bio            ?? '',
      location:      u.location       ?? '',
      profileImage:  u.profile_image  ?? null,
      skillsArray:   their,
      matchScore:    score,
      commonSkills:  common,
      sameCity:      sc,
      allSkillsMatch: all,
      tier,
    };
  })
  .filter(Boolean)
  .sort((a: any, b: any) =>
    a.tier !== b.tier ? a.tier - b.tier : b.matchScore - a.matchScore
  )
  .slice(0, lim);

  const result = { matches: ranked, total: ranked.length, hasMore: false };

  // ── Step 5: Cache with skills key ────────────────────────────
  mc.set(cacheKey, { data: result, at: Date.now(), skillsKey });

  console.log(`[getMatches] fresh fetch for ${userId}: ${ranked.length} matches in ${Date.now() - t0}ms`);
  return json({ ...result, ms: Date.now() - t0 });
}