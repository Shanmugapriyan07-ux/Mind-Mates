import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'; // Updated Deno std
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0'; // Updated Supabase JS to a recent stable v2

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

const mc = new Map<string, { data: any; at: number }>();
const MC_TTL = 5 * 60 * 1000;
const parseSkills = (s: any): string[] => !s ? [] : String(s).split(',').map((x: string) => x.trim().toLowerCase()).filter(Boolean);
const normCity = (s: any): string => (s ?? '').toString().toLowerCase().trim().split(',')[0].trim();

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

  // Parse body — handles both normal object AND double-serialized string.
  // Root cause of 400: some older callFn versions sent JSON.stringify(body)
  // which double-serializes. The edge fn would get a string → body.action = undefined → 400.
  let body: any = {};
  try {
    const raw = await req.json();
    // If raw is a string (double-serialized), parse again
    body = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch { body = {}; }
  const action = (body.action ?? '').trim();
  console.log(`ACTION=${action} sender=${senderId ?? 'anon'} body_keys=${Object.keys(body).join(',')}`);
  console.log(`ACTION=${action} sender=${senderId ?? 'anon'}`);

  if (action === 'getMatches') return doGetMatches(sb, body);
  if (!senderId) return json({ error: 'Unauthorized' }, 401);

  // Top-level try/catch: any unhandled exception → 500 with JSON body
  // Without this, Deno runtime exceptions produce a non-JSON 500 response,
  // which the client can't parse → FunctionsHttpError with no detail ❌
  try {
    return await doAction(sb, action, body, senderId);
  } catch (e: any) {
    console.error(`UNCAUGHT in ${action}:`, e?.message ?? e);
    return json({ error: e?.message ?? 'Internal server error', action }, 500);
  }
});


async function doAction(sb: any, action: string, body: any, senderId: string) {

  // ══════════════════════════════════════════════════════════
  // SEND_REQUEST
  // ══════════════════════════════════════════════════════════
  if (action === 'send_request') {
    const { receiverId } = body;
    if (!receiverId)             return json({ error: 'Missing receiverId' }, 400);
    if (senderId === receiverId) return json({ error: 'Cannot connect with yourself' }, 400);
    if (!rateLimit(senderId, 'send', 10)) return json({ error: 'Too many requests' }, 429);

    // Check both directions
    const { data: existing } = await sb.from(T.conn).select('id, status')
      .or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`)
      .maybeSingle();
    if (existing) {
      return json({ success: false, alreadyExists: true, connectionId: existing.id, status: existing.status, error: 'Connection already exists' }, 409);
    }

    // Get sender profile
    const { data: sp } = await sb.from(T.users)
      .select('full_name, profile_image, skills, location').eq('user_id', senderId).maybeSingle();

    // ✅ KEY FIX: No created_at — let DB DEFAULT NOW() handle it
    // This was the cause of "invalid input syntax for type bigint: ISO string"
    const { data: conn, error: connErr } = await sb.from(T.conn)
      .insert({ sender_id: senderId, receiver_id: receiverId, status: 'pending' })
      .select('id').single();

    if (connErr) { console.error('Connection insert failed:', connErr.message, connErr.details); return json({ error: connErr.message }, 500); }
    console.log(`Connection created: ${conn.id}`);

    // ✅ No created_at in notification either
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

  // ══════════════════════════════════════════════════════════
  // ACCEPT_REQUEST — 4-strategy lookup
  // ══════════════════════════════════════════════════════════
  if (action === 'accept_request') {
    let { connectionId, notifId } = body;
    console.log(`accept: connId=${connectionId} notifId=${notifId} receiver=${senderId}`);

    let conn: any = null;

    // Strategy 1: direct
    if (connectionId) {
      const { data } = await sb.from(T.conn).select('*').eq('id', connectionId).maybeSingle();
      if (data) { conn = data; console.log('found by connectionId'); }
    }
    // Strategy 2: via notification.connection_id
    if (!conn && notifId) {
      const { data: notif } = await sb.from(T.notif).select('connection_id, sender_id').eq('id', notifId).maybeSingle();
      if (notif?.connection_id) {
        const { data } = await sb.from(T.conn).select('*').eq('id', notif.connection_id).maybeSingle();
        if (data) { conn = data; connectionId = data.id; console.log('found via notif.connection_id'); }
      }
      // Strategy 3: sender + receiver
      if (!conn && notif?.sender_id) {
        const { data } = await sb.from(T.conn).select('*')
          .eq('sender_id', notif.sender_id).eq('receiver_id', senderId).eq('status', 'pending')
          .maybeSingle();
        if (data) { conn = data; connectionId = data.id; console.log('found by sender+receiver'); }
      }
    }
    // Strategy 4: most recent pending to this receiver
    if (!conn) {
      const { data } = await sb.from(T.conn).select('*')
        .eq('receiver_id', senderId).eq('status', 'pending')
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (data) { conn = data; connectionId = data.id; console.log('found as most recent pending'); }
    }

    if (!conn) { console.error('All strategies failed'); return json({ error: 'Connection not found' }, 404); }
    if (conn.receiver_id !== senderId) return json({ error: 'Not authorized' }, 403);
    if (conn.status !== 'pending') return json({ error: `Status is ${conn.status}` }, 409);

    // Create chat
    const chatKey = [senderId, conn.sender_id].sort().join('_');
    let chatId: string;

    const { data: existChat } = await sb.from(T.chats).select('id').eq('chat_key', chatKey).maybeSingle();
    if (existChat) {
      // IMPORTANT: Clear old messages when re-connecting after unfriend
      // Like WhatsApp — reconnecting starts a fresh conversation ✅
      chatId = existChat.id;
      await sb.from(T.messages).delete().eq('chat_id', chatId);
      await sb.from(T.chats).update({
        last_message: '',
        last_message_at: null,
        last_sender_id: null,
        last_message_status: 'sent',
      }).eq('id', chatId);
      console.log(`Re-connect: cleared old messages for chat ${chatId}`);
    } else {
      // ✅ No created_at — DB default handles it
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

  // ══════════════════════════════════════════════════════════
  // REJECT_REQUEST
  // ══════════════════════════════════════════════════════════
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

  // ══════════════════════════════════════════════════════════
  // CANCEL_REQUEST
  // ══════════════════════════════════════════════════════════
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

  // ══════════════════════════════════════════════════════════
  // SEND_MESSAGE
  // ══════════════════════════════════════════════════════════
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
    // ✅ No created_at in messages insert — use DB default
    const [{ data: saved, error: msgErr }] = await Promise.all([
      sb.from(T.messages).insert({
        chat_id: chatId, sender_id: senderId, message: trimmed,
        type, status: 'sent',
        reply_to_id: replyToId, reply_to_text: replyToText, reply_to_sender: replyToSender,
      }).select('id, created_at').single(),
      sb.from(T.chats).update({
        last_message: trimmed,
        last_message_at: now,
        last_sender_id: senderId,
        last_message_status: 'sent',
        // Remove SENDER from hidden_for — chat reappears for them ✅
        // Also remove receiver from hidden_for — they see the new message ✅
        hidden_for: [],
      }).eq('id', chatId),
    ]);
    if (msgErr) return json({ error: msgErr.message }, 500);
    const { data: snd } = await sb.from(T.users).select('full_name,profile_image').eq('user_id', senderId).maybeSingle();
    push(sb, receiverId, snd?.full_name ?? 'New Message', trimmed.length > 60 ? trimmed.slice(0,60)+'…' : trimmed,
      { type: 'new_message', chatId, userId: senderId, senderName: snd?.full_name ?? '', senderImage: snd?.profile_image ?? '' });
    return json({ success: true, messageId: saved.id, createdAt: saved.created_at });
  }

  // ── delete / react / edit / block (no timestamp fields) ───
  
// ══════════════════════════════════════════════════════════════
  // CHAT & MESSAGE OPERATIONS (soft-delete architecture)
  //   deleted_for[]  on messages  → per-user invisible
  //   hidden_for[]   on chats     → per-user hidden list
  //   send_message   clears hidden_for  → chat reappears on new msg
  // ══════════════════════════════════════════════════════════════

  // ── delete_message: soft-delete for caller only ───────────────
  if (action === 'delete_message' || action === 'delete_for_me') {
    const { messageId } = body;
    if (!messageId) return json({ error: 'Missing messageId' }, 400);

    const { data: msg, error: fetchErr } = await sb.from(T.messages)
      .select('id, chat_id, sender_id, deleted_for')
      .eq('id', messageId).single();
    if (fetchErr || !msg) return json({ error: 'Message not found' }, 404);

    // Verify caller is a chat participant
    const { data: chat } = await sb.from(T.chats)
      .select('participants').eq('id', msg.chat_id).single();
    if (!chat?.participants?.includes(senderId))
      return json({ error: 'Not a chat member' }, 403);

    // Idempotent — skip if already deleted for this user
    const current: string[] = msg.deleted_for ?? [];
    if (!current.includes(senderId)) {
      const { error: updErr } = await sb.from(T.messages)
        .update({ deleted_for: [...current, senderId] })
        .eq('id', messageId);
      if (updErr) {
        console.error('delete_message update failed:', updErr.message);
        return json({ error: updErr.message }, 500);
      }
    }

    // Recalculate chat preview — skip rows deleted for this user
    const { data: latest } = await sb.from(T.messages)
      .select('message, sender_id, created_at')
      .eq('chat_id', msg.chat_id)
      .not('deleted_for', 'cs', `{${senderId}}`)
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle();

    await sb.from(T.chats).update({
      last_message:        latest?.message    ?? '',
      last_message_at:     latest?.created_at ?? new Date().toISOString(),
      last_sender_id:      latest?.sender_id  ?? null,
      last_message_status: 'sent',
    }).eq('id', msg.chat_id);

    return json({ success: true });
  }

  // ── delete_for_everyone: hard-delete (sender ≤ 60 s) ─────────
  if (action === 'delete_for_everyone') {
    const { messageId } = body;
    if (!messageId) return json({ error: 'Missing messageId' }, 400);

    const { data: msg, error: fetchErr } = await sb.from(T.messages)
      .select('id, chat_id, sender_id, created_at')
      .eq('id', messageId).single();
    if (fetchErr || !msg) return json({ error: 'Message not found' }, 404);
    if (msg.sender_id !== senderId) return json({ error: 'Only sender can unsend' }, 403);

    const ageMs = Date.now() - new Date(msg.created_at).getTime();
    if (ageMs > 60_000) return json({ error: 'Unsend window expired (60 s)' }, 403);

    const { error: delErr } = await sb.from(T.messages).delete().eq('id', messageId);
    if (delErr) {
      console.error('delete_for_everyone failed:', delErr.message);
      return json({ error: delErr.message }, 500);
    }

    // Update preview to next message
    const { data: latest } = await sb.from(T.messages)
      .select('message, sender_id, created_at')
      .eq('chat_id', msg.chat_id)
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle();

    await sb.from(T.chats).update({
      last_message:        latest?.message    ?? '',
      last_message_at:     latest?.created_at ?? new Date().toISOString(),
      last_sender_id:      latest?.sender_id  ?? null,
      last_message_status: 'sent',
    }).eq('id', msg.chat_id);

    return json({ success: true });
  }

  // ── clear_chat: soft-clear for caller only ────────────────────
  // Marks all messages deleted_for[uid] + hides chat for uid
  // Other user sees ZERO change ✅
  if (action === 'clear_chat') {
    const { chatId } = body;
    if (!chatId) return json({ error: 'Missing chatId' }, 400);

    const { data: chat, error: fetchErr } = await sb.from(T.chats)
      .select('participants, hidden_for').eq('id', chatId).single();
    if (fetchErr || !chat) return json({ error: 'Chat not found' }, 404);
    if (!chat.participants.includes(senderId))
      return json({ error: 'Not a chat member' }, 403);

    // Step 1: bulk-mark all messages deleted_for this user via RPC
    const { error: rpcErr } = await sb.rpc('append_deleted_for', {
      p_chat_id: chatId,
      p_user_id: senderId,
    });
    if (rpcErr) {
      // Fallback: fetch IDs and update individually (slower, always works)
      console.warn('RPC failed, using fallback:', rpcErr.message);
      const { data: msgs } = await sb.from(T.messages)
        .select('id, deleted_for').eq('chat_id', chatId);
      if (msgs?.length) {
        const updates = msgs
          .filter((m: any) => !(m.deleted_for ?? []).includes(senderId))
          .map((m: any) =>
            sb.from(T.messages)
              .update({ deleted_for: [...(m.deleted_for ?? []), senderId] })
              .eq('id', m.id)
          );
        await Promise.all(updates);
      }
    }

    // Step 2: hide chat for this user
    const hiddenFor: string[] = chat.hidden_for ?? [];
    if (!hiddenFor.includes(senderId)) {
      const { error: hideErr } = await sb.from(T.chats)
        .update({ hidden_for: [...hiddenFor, senderId] })
        .eq('id', chatId);
      if (hideErr) {
        console.error('clear_chat hide failed:', hideErr.message);
        return json({ error: hideErr.message }, 500);
      }
    }

    return json({ success: true });
  }

  // ── hide_chat: remove chat from caller's list only ────────────
  // Other user unaffected. Chat reappears when new message arrives.
  if (action === 'hide_chat') {
    const { chatId } = body;
    if (!chatId) return json({ error: 'Missing chatId' }, 400);

    const { data: chat, error: fetchErr } = await sb.from(T.chats)
      .select('participants, hidden_for').eq('id', chatId).single();
    if (fetchErr) {
      console.error('hide_chat fetch failed:', fetchErr.message);
      return json({ error: fetchErr.message }, 500);
    }
    if (!chat) return json({ success: true }); // already gone — treat as success

    if (!chat.participants.includes(senderId))
      return json({ error: 'Not a chat member' }, 403);

    const hiddenFor: string[] = chat.hidden_for ?? [];
    if (!hiddenFor.includes(senderId)) {
      const { error: updErr } = await sb.from(T.chats)
        .update({ hidden_for: [...hiddenFor, senderId] })
        .eq('id', chatId);
      if (updErr) {
        console.error('hide_chat update failed:', updErr.message);
        return json({ error: updErr.message }, 500);
      }
    }
    return json({ success: true });
  }



  // ── check_block ───────────────────────────────────────────────
  if (action === 'check_block') {
    const { otherUserId } = body;
    if (!otherUserId) return json({ error: 'Missing otherUserId' }, 400);
    const { data: rows } = await sb.from(T.blocks).select('blocker_id')
      .or(`and(blocker_id.eq.${senderId},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${senderId})`);
    return json({
      success:      true,
      iBlockedThem: (rows ?? []).some((r: any) => r.blocker_id === senderId),
      theyBlockedMe:(rows ?? []).some((r: any) => r.blocker_id === otherUserId),
      isBlocked:    (rows ?? []).length > 0,
    });
  }

  // ── block_user ────────────────────────────────────────────────
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

  // ── unblock_user ──────────────────────────────────────────────
  if (action === 'unblock_user') {
    const { blockedId } = body;
    if (!blockedId) return json({ error: 'Missing blockedId' }, 400);
    await sb.from(T.blocks).delete().eq('blocker_id', senderId).eq('blocked_id', blockedId);
    return json({ success: true });
  }

  // ── edit_message ──────────────────────────────────────────────
  if (action === 'edit_message') {
    const { messageId, newText } = body;
    if (!messageId || !newText?.trim())
      return json({ error: 'Missing messageId or newText' }, 400);
    const { data: msg } = await sb.from(T.messages)
      .select('sender_id, chat_id, created_at').eq('id', messageId).single();
    if (!msg) return json({ error: 'Message not found' }, 404);
    if (msg.sender_id !== senderId) return json({ error: 'Not your message' }, 403);
    const trimmed = newText.trim();
    await sb.from(T.messages).update({ message: trimmed, edited: true }).eq('id', messageId);
    // Update chat preview if this was the last message
    const { data: ch } = await sb.from(T.chats)
      .select('last_message_at').eq('id', msg.chat_id).single().catch(() => ({ data: null }));
    if (ch && new Date(ch.last_message_at).getTime() >= new Date(msg.created_at).getTime() - 1000) {
      await sb.from(T.chats).update({ last_message: trimmed }).eq('id', msg.chat_id).catch(() => {});
    }
    return json({ success: true });
  }

  // ── react_message ─────────────────────────────────────────────
  if (action === 'react_message') {
    const { messageId, emoji } = body;
    if (!messageId || !emoji) return json({ error: 'Missing messageId or emoji' }, 400);
    const { data: msg } = await sb.from(T.messages)
      .select('reactions, chat_id').eq('id', messageId).single();
    if (!msg) return json({ error: 'Message not found' }, 404);
    const { data: chat } = await sb.from(T.chats)
      .select('participants').eq('id', msg.chat_id).single();
    if (!chat?.participants?.includes(senderId))
      return json({ error: 'Not a member' }, 403);
    let reactions: { userId: string; emoji: string }[] = [];
    try { reactions = msg.reactions ? JSON.parse(msg.reactions) : []; } catch { reactions = []; }
    const idx = reactions.findIndex(r => r.userId === senderId && r.emoji === emoji);
    if (idx >= 0) reactions.splice(idx, 1);
    else { reactions = reactions.filter(r => r.userId !== senderId); reactions.push({ userId: senderId, emoji }); }
    await sb.from(T.messages).update({ reactions: JSON.stringify(reactions) }).eq('id', messageId);
    return json({ success: true, reactions });
  }

  // ── delete_account ────────────────────────────────────────────
  if (action === 'delete_account') {
    const { userId } = body;
    if (!userId || userId !== senderId)
      return json({ error: 'Unauthorized: can only delete your own account' }, 403);
    try {
      const { data: userChats } = await sb.from(T.chats)
        .select('id').contains('participants', [userId]);
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
      if (svcKey) {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', svcKey,
          { auth: { autoRefreshToken: false, persistSession: false } });
        await admin.auth.admin.deleteUser(userId).catch(e => console.error('auth delete:', e.message));
      }
      return json({ success: true });
    } catch (e: any) {
      console.error('delete_account error:', e?.message);
      return json({ error: e?.message ?? 'Delete failed' }, 500);
    }
  }

  // ── remove_friend ─────────────────────────────────────────────
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


  // ── get_chat_id — find chat_id by chat_key (bypasses hidden_for) ──
  // TEACHING: findChat() on the client uses the user session key which
  // is subject to RLS. The old chat_select RLS blocked hidden chats.
  // Now chat_select allows all participants (RLS fix in schema_migration.sql).
  // This action is kept as a reliable server-side fallback.
  if (action === 'get_chat_id') {
    const { otherUserId } = body;
    if (!otherUserId) return json({ error: 'Missing otherUserId' }, 400);
    const chatKey = [senderId, otherUserId].sort().join('_');
    const { data: chat } = await sb.from(T.chats)
      .select('id, hidden_for, participants')
      .eq('chat_key', chatKey).maybeSingle();
    if (!chat) return json({ chatId: null });
    // Return chat_id regardless of hidden_for — caller decides visibility
    return json({ chatId: chat.id, isHidden: (chat.hidden_for ?? []).includes(senderId) });
  }


  // ── delete_cloudinary_image — signed delete (server-side only) ─
  // TEACHING: Cloudinary delete requires API secret (never expose to client).
  // Frontend sends the public_id, edge fn performs signed delete.
  // Used when user removes their profile image (no overwrite possible).
  if (action === 'delete_cloudinary_image') {
    const { publicId, resourceType = 'image' } = body;
    if (!publicId) return json({ error: 'Missing publicId' }, 400);

    const apiKey    = Deno.env.get('CLOUDINARY_API_KEY');
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');
    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');

    if (!apiKey || !apiSecret || !cloudName) {
      // Gracefully skip if not configured — profile image removal still works
      // (the DB record is cleared; Cloudinary file stays but causes no harm)
      console.warn('delete_cloudinary_image: CLOUDINARY_* env vars not set, skipping');
      return json({ success: true, skipped: true });
    }

    // Build signed request
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // Signature: SHA-1 of sorted params + api_secret
    const sigStr = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;

    // Deno crypto for SHA-1
    const encoder = new TextEncoder();
    const data    = encoder.encode(sigStr);
    const hashBuf = await crypto.subtle.digest('SHA-1', data);
    const hashArr = Array.from(new Uint8Array(hashBuf));
    const signature = hashArr.map(b => b.toString(16).padStart(2, '0')).join('');

    const form = new FormData();
    form.append('public_id',    publicId);
    form.append('timestamp',    timestamp);
    form.append('api_key',      apiKey);
    form.append('signature',    signature);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`,
      { method: 'POST', body: form }
    );
    const result = await res.json();
    if (result.result === 'ok' || result.result === 'not found') {
      return json({ success: true });
    }
    return json({ error: result.result ?? 'Delete failed' }, 500);
  }


  // ── sign_upload — generate Cloudinary signed upload params ────
  // TEACHING: Why signed uploads for profile images?
  //   Unsigned: overwrite=true NOT allowed → separate file each upload → storage waste ❌
  //   Signed:   all params allowed including overwrite=true → one file per user ✅
  //
  // FLOW (production Instagram strategy):
  //   1. Client calls this action → gets {timestamp, signature, apiKey, cloudName}
  //   2. Client sends FormData to Cloudinary directly (never through our server)
  //   3. Cloudinary validates signature → accepts overwrite=true ✅
  //   4. Client gets back secure_url, saves to DB
  //
  // SECURITY: API secret never leaves the edge fn. Client only gets a
  //   time-limited signature (valid for 1 hour via timestamp check). ✅
  // ── sign_upload — generate Cloudinary signed upload params ──────
  // CRITICAL FIXES vs previous version:
  //   1. SHA-1 (not SHA-256) — Cloudinary's DEFAULT signing algorithm ✅
  //      SHA-256 produced wrong signatures → Cloudinary rejected with 500.
  //      To use SHA-256 you must set it in Cloudinary dashboard settings.
  //      SHA-1 works on every Cloudinary account with no extra config.
  //   2. Full public_id path — NO separate folder param in signature ✅
  //      Using folder='mindmates/profiles' + public_id='profiles_xxx' is ambiguous.
  //      Using public_id='mindmates/profiles/profiles_xxx' with NO folder param
  //      is unambiguous: signature and FormData both have exactly one path param.
  //   3. Signature params = ONLY what is sent in the upload FormData
  //      (excluding: file, api_key, resource_type, type)
  if (action === 'sign_upload') {
    const { userId, resourceType = 'image' } = body;

    const apiKey    = Deno.env.get('CLOUDINARY_API_KEY');
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');
    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');

    if (!apiKey || !apiSecret || !cloudName) {
      console.error('sign_upload: CLOUDINARY_* env vars not set');
      return json({ error: 'Cloudinary credentials not configured on server. Add CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_CLOUD_NAME to Edge Function secrets.' }, 500);
    }

    if (!userId) return json({ error: 'Missing userId' }, 400);

    // Full public_id path — no separate folder param (avoids signature mismatch)
    const safeId   = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const publicId = `mindmates/profiles/profile_${safeId}`;

    const timestamp = Math.floor(Date.now() / 1000).toString();

    // Params MUST exactly match what the client will send in FormData
    // (excluding: file, api_key, resource_type)
    // Sorted alphabetically — Cloudinary requirement
    const paramsToSign: Record<string, string> = {
      overwrite:  'true',
      public_id:  publicId,
      timestamp,
    };

    // Build signature string: sorted key=value pairs + api_secret
    const sigStr = Object.keys(paramsToSign)
      .sort()
      .map(k => `${k}=${paramsToSign[k]}`)
      .join('&') + apiSecret;

    // SHA-1 — Cloudinary default algorithm ✅
    // Web Crypto SHA-1 is available in Deno and all modern runtimes
    const encoder  = new TextEncoder();
    const hashBuf  = await crypto.subtle.digest('SHA-1', encoder.encode(sigStr));
    const hashArr  = Array.from(new Uint8Array(hashBuf));
    const signature = hashArr.map(b => b.toString(16).padStart(2, '0')).join('');

    console.log(`sign_upload: userId=${userId} public_id=${publicId} sig=${signature.slice(0,8)}...`);

    return json({
      success:      true,
      signature,
      timestamp,
      apiKey,
      cloudName,
      publicId,
      resourceType,
      // Client uses these to build the upload FormData
      // Signed params: overwrite, public_id, timestamp
      // NOT signed: file, api_key, resource_type, signature
    });
  }

  return json({ error: `Unknown action: ${action}` }, 400);
}

async function doGetMatches(sb: any, body: any) {
  const { userId, limit = 20, bust = false } = body;
  if (!userId) return json({ error: 'userId required' }, 400);
  const t0 = Date.now(), ck = `m_${userId}`;
  if (!bust) { const h = mc.get(ck); if (h && Date.now()-h.at < MC_TTL) return json({ ...h.data, src:'cache', ms: Date.now()-t0 }); }
  const { data: me } = await sb.from(T.users).select('skills,location').eq('user_id', userId).maybeSingle();
  if (!me) return json({ error: 'Profile not found' }, 404);
  const mySkills = parseSkills(me.skills), myCity = normCity(me.location);
  if (!mySkills.length) return json({ matches: [], total: 0, ms: Date.now()-t0 });
  const { data: cands } = await sb.from(T.users).select('user_id,full_name,bio,location,profile_image,skills')
    .eq('is_profile_complete', true).neq('user_id', userId).limit(500);
  const lim = Math.min(limit, 50);
  const ranked = (cands ?? []).map((u: any) => {
    const their = parseSkills(u.skills), common = mySkills.filter(s => their.includes(s));
    if (!common.length) return null;
    const sc = normCity(u.location) === myCity && myCity.length > 0;
    const all = common.length >= mySkills.length;
    const score = common.length*10 + (all?50:0) + (sc?30:0);
    const tier  = all&&sc?1:all?2:sc?3:4;
    return { userId: u.user_id, fullName: u.full_name??'', bio: u.bio??'', location: u.location??'', profileImage: u.profile_image??null, skillsArray: their, matchScore: score, commonSkills: common, sameCity: sc, allSkillsMatch: all, tier };
  }).filter(Boolean).sort((a:any,b:any)=>a.tier!==b.tier?a.tier-b.tier:b.matchScore-a.matchScore).slice(0,lim);
  const result = { matches: ranked, total: ranked.length, hasMore: false };
  mc.set(ck, { data: result, at: Date.now() });
  return json({ ...result, ms: Date.now()-t0 });
}