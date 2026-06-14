import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
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

const T = {
  users:    'users',
  conn:     'connections',
  notif:    'notifications',
  chats:    'chats',
  messages: 'messages',
  blocks:   'blocks',
};

// ─── Rate Limiter ────────────────────────────────────────────────────────────
const rl = new Map<string, number[]>();
const rateLimit = (uid: string, action: string, max = 10): boolean => {
  const k = `${uid}:${action}`, now = Date.now();
  const r = (rl.get(k) ?? []).filter(t => now - t < 60_000);
  if (r.length >= max) return false;
  r.push(now); rl.set(k, r); return true;
};

// ─── Match Cache ─────────────────────────────────────────────────────────────
const mc = new Map<string, { data: any; at: number; skillsKey: string }>();
const MC_TTL = 5 * 60 * 1000;

const parseSkills = (s: any): string[] =>
  !s ? [] : String(s).split(',').map((x: string) => x.trim().toLowerCase()).filter(Boolean);
const normCity = (s: any): string =>
  (s ?? '').toString().toLowerCase().trim().split(',')[0].trim();

// ─── Deep Link URL Builder ────────────────────────────────────────────────────
const resolveUrl = (type: string, d: any): string => {
  switch (type) {
    case 'new_message':         return d.chatId   ? `/subScreens/chatScreen/${d.chatId}`    : '/(tabs)/home';
    case 'connection_request':  return d.senderId ? `/subScreens/userProfile/${d.senderId}` : '/(tabs)/home';
    case 'connection_accepted': return d.chatId   ? `/subScreens/chatScreen/${d.chatId}`    : '/(tabs)/home';
    default:                    return '/(tabs)/home';
  }
};

// ─── Channel Selector ─────────────────────────────────────────────────────────
// Each notification type gets its own channel with appropriate sound/vibration
const resolveChannel = (type: string): string => {
  switch (type) {
    case 'new_message':         return 'messages';
    case 'connection_request':  return 'social';
    case 'connection_accepted': return 'social';
    case 'daily_morning':       return 'daily';
    case 'daily_night':         return 'daily';
    default:                    return 'messages';
  }
};

// ─── Title & Body Formatter ───────────────────────────────────────────────────
// WhatsApp/Instagram pattern: sender name as title, message as body
const formatNotification = (
  type: string,
  defaultTitle: string,
  defaultBody: string,
  data: any,
): { title: string; body: string } => {
  switch (type) {
    case 'new_message':
      return {
        title: data.senderName || defaultTitle,   // "A.Meera" — sender name as title
        body:  defaultBody,                        // actual message text
      };
    case 'connection_request':
      return {
        title: '👋 New Connection Request',
        body:  `${data.senderName || 'Someone'} wants to connect with you`,
      };
    case 'connection_accepted':
      return {
        title: '🎉 Connection Accepted!',
        body:  `${data.senderName || 'Someone'} accepted your request. Say hello!`,
      };
    default:
      return { title: defaultTitle, body: defaultBody };
  }
};

// ─── Push Function ────────────────────────────────────────────────────────────
async function push(
  sb: any,
  userId: string,
  title: string,
  body: string,
  data: any = {},
) {
  try {
    const { data: tokenRow } = await sb
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId)
      .maybeSingle();

    if (!tokenRow?.token) {
      console.log(`[push] no token for ${userId}`);
      return;
    }

    const token: string = tokenRow.token;
    if (!token.startsWith('ExponentPushToken')) {
      console.warn(`[push] invalid token format for ${userId}`);
      return;
    }

    const notifType = data.type ?? '';
    const deepLinkUrl = resolveUrl(notifType, data);
    const channelId   = resolveChannel(notifType);
    const { title: fmtTitle, body: fmtBody } = formatNotification(notifType, title, body, data);

    // ✅ sender profile image shown as large icon on Android (like WhatsApp)
    const hasSenderImage = data.senderImage && data.senderImage.length > 10;

    const message: any = {
      to:        token,
      title:     fmtTitle,
      body:      fmtBody,
      sound:     'default',
      badge:     1,
      priority:  'high',
      channelId,
      data: {
        type:        notifType,
        url:         deepLinkUrl,
        chatId:      data.chatId      ?? null,
        senderId:    data.senderId    ?? null,
        senderName:  data.senderName  ?? '',
        senderImage: data.senderImage ?? '',
      },
    };

    // ✅ sender's profile photo as large notification icon
    // Android shows this as the big round avatar on the right side of the notification
    if (hasSenderImage) {
      message.image = data.senderImage;
    }

    // Retry logic for transient Expo API failures
    let res: Response;
    let attempts = 0;
    while (true) {
      res = await fetch('https://exp.host/--/api/v2/push/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(message),
      });
      attempts++;
      if ((res.status !== 503 && res.status !== 429) || attempts >= 3) break;
      console.warn(`[push] Expo API busy (${res.status}), retry ${attempts}/3...`);
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempts - 1)));
    }

    const result = await res.json();
    if (result?.data?.status === 'error') {
      console.error(`[push] delivery error for ${userId}:`, result.data.message);
      if (
        result.data.details?.error === 'DeviceNotRegistered' ||
        result.data.message?.includes('InvalidCredentials')
      ) {
        await sb.from('push_tokens').delete().eq('user_id', userId).catch(() => {});
        console.log(`[push] cleared invalid token for ${userId}`);
      }
    }
  } catch (e: any) {
    console.error('[push] silent error:', e?.message ?? e);
  }
}

// ─── Batch Push (for broadcasts) ─────────────────────────────────────────────
// Sends to all users in batches of 100 — Expo Push API limit per request
async function pushBroadcast(
  sb: any,
  title: string,
  body: string,
  data: any = {},
  batchSize = 100,
): Promise<{ sent: number; failed: number }> {
  let sent = 0, failed = 0;

  // Fetch all valid tokens in pages
  let page = 0;
  const pageSize = 500;

  while (true) {
    const { data: tokens, error } = await sb
      .from('push_tokens')
      .select('token, user_id')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error || !tokens || tokens.length === 0) break;

    // Filter valid Expo tokens
    const valid = tokens.filter((t: any) =>
      t.token?.startsWith('ExponentPushToken')
    );

    // Send in batches of 100 (Expo API limit)
    for (let i = 0; i < valid.length; i += batchSize) {
      const batch = valid.slice(i, i + batchSize);

      const messages = batch.map((t: any) => ({
        to:        t.token,
        title,
        body,
        sound:     'default',
        priority:  'normal',        // normal priority for broadcasts — saves battery
        channelId: data.channelId ?? 'daily',
        badge:     0,               // broadcasts don't increment badge
        data:      {
          ...data,
          url: data.url ?? '/(tabs)/home',
        },
      }));

      try {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(messages),
        });

        const result = await res.json();
        const results: any[] = Array.isArray(result.data) ? result.data : [];

        // Auto-cleanup dead tokens
        const deadTokenIndices: number[] = [];
        results.forEach((r: any, idx: number) => {
          if (r.status === 'ok') {
            sent++;
          } else {
            failed++;
            if (
              r.details?.error === 'DeviceNotRegistered' ||
              r.message?.includes('InvalidCredentials')
            ) {
              deadTokenIndices.push(idx);
            }
          }
        });

        // Delete dead tokens
        if (deadTokenIndices.length > 0) {
          const deadTokens = deadTokenIndices.map(idx => batch[idx].token);
          await sb
            .from('push_tokens')
            .delete()
            .in('token', deadTokens)
            .catch(() => {});
          console.log(`[broadcast] cleaned ${deadTokenIndices.length} dead tokens`);
        }

      } catch (e: any) {
        console.error('[broadcast] batch error:', e?.message);
        failed += batch.length;
      }

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < valid.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    if (tokens.length < pageSize) break;
    page++;
  }

  console.log(`[broadcast] done: sent=${sent} failed=${failed}`);
  return { sent, failed };
}

// ─── Connection Count Helper ─────────────────────────────────────────────────
async function updateCounts(sb: any, uid1: string, uid2: string) {
  const count = async (uid: string) => {
    const { count: n } = await sb.from(T.conn)
      .select('*', { count: 'exact', head: true })
      .eq('status', 'accepted')
      .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`);
    return n ?? 0;
  };
  Promise.all([uid1, uid2].map(async uid => {
    const n = await count(uid);
    await sb.from(T.users).update({ connections: n }).eq('user_id', uid);
  })).catch(() => {});
}

// ─── Main Server ─────────────────────────────────────────────────────────────
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
  console.log(`ACTION=${action} sender=${senderId ?? 'anon'}`);

  // ── Public actions (no auth required) ─────────────────────────────────────
  if (action === 'getMatches') return doGetMatches(sb, body);

  // ── Broadcast actions — authenticated by service role key in header ────────
  // These are called by the pg_cron scheduler, not by users
  if (action === 'broadcast_morning' || action === 'broadcast_night') {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authHeader = req.headers.get('authorization') ?? '';

    // Only allow if called with service role key (from pg_cron)
    if (!authHeader.includes(serviceKey ?? 'INVALID')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    return doBroadcast(sb, action);
  }

  if (!senderId) return json({ error: 'Unauthorized' }, 401);

  try {
    return await doAction(sb, action, body, senderId);
  } catch (e: any) {
    console.error(`UNCAUGHT in ${action}:`, e?.message ?? e);
    return json({ error: e?.message ?? 'Internal server error', action }, 500);
  }
});
async function doBroadcast(sb: any, action: string) {
  const isMorning = action === 'broadcast_morning';
  const morningMessages = [
    { title: '🌞 Good Morning!',     body: 'Stay confident — this is your day! 💜' },
    { title: '🌞 Rise & Shine!',     body: 'Every day is a fresh start. Make it count! 🌟' },
    { title: '🌞 Good Morning!',     body: 'You\'ve got this. Start strong, stay confident! 💪' },
    { title: '✨ New Day, New You!', body: 'Wake up with purpose. The world needs your energy! 🔥' },
    { title: '🌞 Good Morning!',     body: 'Believe in yourself today. Great things are coming! 🌈' },
  ];
  const nightMessages = [
    { title: '🌙 Good Night!',        body: 'Stay happy — tomorrow will be your day! 💜' },
    { title: '⭐ Sweet Dreams!',      body: 'Rest well. Tomorrow brings new opportunities! 🌟' },
    { title: '🌙 Good Night!',        body: 'You did great today. Tomorrow will be even better! 😊' },
    { title: '💤 Time to Rest!',      body: 'Recharge tonight. Tomorrow is going to be amazing! ✨' },
    { title: '🌙 Good Night!',        body: 'Close your eyes peacefully — your best day is coming! 🌈' },
  ];
  const dayIndex = new Date().getDay();
  const messages = isMorning ? morningMessages : nightMessages;
  const msg = messages[dayIndex % messages.length];
  const result = await pushBroadcast(
    sb,
    msg.title,
    msg.body,
    {
      type:      isMorning ? 'daily_morning' : 'daily_night',
      url:       '/(tabs)/home',
      channelId: 'daily',
    },
  );
  return json({
    success: true,
    action,
    message: msg,
    ...result,
  });
}
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
      return json({
        success: false, alreadyExists: true,
        connectionId: existing.id, status: existing.status,
        error: 'Connection already exists',
      }, 409);
    }

    const { data: sp } = await sb.from(T.users)
      .select('full_name, profile_image, skills, location')
      .eq('user_id', senderId).maybeSingle();

    const { data: conn, error: connErr } = await sb.from(T.conn)
      .insert({ sender_id: senderId, receiver_id: receiverId, status: 'pending' })
      .select('id').single();
    if (connErr) return json({ error: connErr.message }, 500);

    await sb.from(T.notif).insert({
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

    push(sb, receiverId,
      'New Friend Request',
      `${sp?.full_name ?? 'Someone'} wants to connect`,
      {
        type:         'connection_request',
        senderId,
        senderName:   sp?.full_name     ?? '',
        senderImage:  sp?.profile_image ?? '',
        connectionId: conn.id,
      }
    );

    return json({ success: true, connectionId: conn.id });
  }

  if (action === 'accept_request') {
    let { connectionId, notifId } = body;

    let conn: any = null;
    if (connectionId) {
      const { data } = await sb.from(T.conn).select('*').eq('id', connectionId).maybeSingle();
      if (data) conn = data;
    }
    if (!conn && notifId) {
      const { data: notif } = await sb.from(T.notif)
        .select('connection_id, sender_id').eq('id', notifId).maybeSingle();
      if (notif?.connection_id) {
        const { data } = await sb.from(T.conn).select('*').eq('id', notif.connection_id).maybeSingle();
        if (data) { conn = data; connectionId = data.id; }
      }
      if (!conn && notif?.sender_id) {
        const { data } = await sb.from(T.conn).select('*')
          .eq('sender_id', notif.sender_id).eq('receiver_id', senderId).eq('status', 'pending')
          .maybeSingle();
        if (data) { conn = data; connectionId = data.id; }
      }
    }
    if (!conn) {
      const { data } = await sb.from(T.conn).select('*')
        .eq('receiver_id', senderId).eq('status', 'pending')
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (data) { conn = data; connectionId = data.id; }
    }
    if (!conn)                          return json({ error: 'Connection not found' }, 404);
    if (conn.receiver_id !== senderId)  return json({ error: 'Not authorized' }, 403);
    if (conn.status !== 'pending')      return json({ error: `Status is ${conn.status}` }, 409);

    const chatKey = [senderId, conn.sender_id].sort().join('_');
    let chatId: string;

    const { data: existChat } = await sb.from(T.chats).select('id').eq('chat_key', chatKey).maybeSingle();
    if (existChat) {
      chatId = existChat.id;
      await sb.from(T.messages).delete().eq('chat_id', chatId);
      await sb.from(T.chats).update({ last_message: '', last_message_at: null, last_sender_id: null, last_message_status: 'sent' }).eq('id', chatId);
    } else {
      const { data: newChat, error: chatErr } = await sb.from(T.chats)
        .insert({ participants: [senderId, conn.sender_id], chat_key: chatKey, last_message: '' })
        .select('id').single();
      if (chatErr) return json({ error: chatErr.message }, 500);
      chatId = newChat.id;
    }

    await sb.from(T.conn).update({ status: 'accepted', chat_id: chatId }).eq('id', connectionId);
    if (notifId) await sb.from(T.notif).update({ is_read: true, type: 'accepted' }).eq('id', notifId);
    updateCounts(sb, senderId, conn.sender_id);

    const { data: accepter } = await sb.from(T.users)
      .select('full_name, profile_image').eq('user_id', senderId).maybeSingle();

    push(sb, conn.sender_id,
      'Connection Accepted!',
      `${accepter?.full_name ?? 'Someone'} accepted your friend request`,
      {
        type:        'connection_accepted',
        chatId,
        senderId,
        senderName:  accepter?.full_name     ?? '',
        senderImage: accepter?.profile_image ?? '',
      }
    );

    return json({ success: true, chatId });
  }

  if (action === 'reject_request') {
    const { connectionId, notifId } = body;
    if (!connectionId) return json({ error: 'Missing connectionId' }, 400);
    const { data: conn } = await sb.from(T.conn).select('receiver_id,status').eq('id', connectionId).single();
    if (!conn)                          return json({ error: 'Not found' }, 404);
    if (conn.receiver_id !== senderId)  return json({ error: 'Not authorized' }, 403);
    if (conn.status !== 'pending')      return json({ error: 'Not pending' }, 409);
    await sb.from(T.conn).delete().eq('id', connectionId);
    if (notifId) await sb.from(T.notif).delete().eq('id', notifId).catch(() => {});
    return json({ success: true });
  }

  if (action === 'cancel_request') {
    const { connectionId } = body;
    if (!connectionId) return json({ error: 'Missing connectionId' }, 400);
    const { data: conn } = await sb.from(T.conn).select('sender_id,status').eq('id', connectionId).single();
    if (!conn)                         return json({ error: 'Not found' }, 404);
    if (conn.sender_id !== senderId)   return json({ error: 'Not authorized' }, 403);
    if (conn.status !== 'pending')     return json({ error: 'Not pending' }, 409);
    const { data: notif } = await sb.from(T.notif).select('id').eq('connection_id', connectionId).maybeSingle();
    await sb.from(T.conn).delete().eq('id', connectionId);
    if (notif) await sb.from(T.notif).delete().eq('id', notif.id).catch(() => {});
    return json({ success: true });
  }

  if (action === 'send_message') {
    const { chatId, message, type = 'text', replyToId = null, replyToText = null, replyToSender = null } = body;
    if (!chatId || !message?.trim()) return json({ error: 'Missing chatId or message' }, 400);
    if (!rateLimit(senderId, 'msg', 60)) return json({ error: 'Too fast' }, 429);

    const { data: chat, error: chatErr } = await sb.from(T.chats).select('participants').eq('id', chatId).single();
    if (chatErr || !chat) return json({ error: 'Chat not found' }, 404);

    const parts: string[] = chat.participants ?? [];
    if (!parts.includes(senderId)) return json({ error: 'Not a member' }, 403);
    const receiverId = parts.find((p: string) => p !== senderId) ?? '';

    const { data: block } = await sb.from(T.blocks).select('blocker_id')
      .or(`and(blocker_id.eq.${senderId},blocked_id.eq.${receiverId}),and(blocker_id.eq.${receiverId},blocked_id.eq.${senderId})`)
      .limit(1).maybeSingle();
    if (block) return json({ error: 'Blocked', blocked: true }, 403);

    const trimmed = message.trim();
    const { data: saved, error: msgErr } = await sb.from(T.messages)
      .insert({ chat_id: chatId, sender_id: senderId, message: trimmed, type, status: 'sent', reply_to_id: replyToId, reply_to_text: replyToText, reply_to_sender: replyToSender })
      .select('id, created_at').single();
    if (msgErr || !saved) return json({ error: msgErr?.message ?? 'Insert failed' }, 500);

    await sb.from(T.chats).update({
      hidden_for: [], last_message: trimmed, last_message_at: saved.created_at,
      last_sender_id: senderId, last_message_status: 'sent',
    }).eq('id', chatId);

    const { data: receiverData } = await sb.from(T.users)
      .select('active_chat_id, is_online').eq('user_id', receiverId).maybeSingle();
    const { data: snd } = await sb.from(T.users)
      .select('full_name, profile_image').eq('user_id', senderId).maybeSingle();

    if (receiverData?.active_chat_id !== chatId) {
      push(sb, receiverId,
        snd?.full_name ?? 'New Message',
        trimmed.length > 60 ? trimmed.slice(0, 60) + '…' : trimmed,
        {
          type:        'new_message',
          chatId,
          senderId,
          senderName:  snd?.full_name     ?? '',
          senderImage: snd?.profile_image ?? '',
        }
      );
    }

    return json({ success: true, messageId: saved.id, createdAt: saved.created_at });
  }

  if (action === 'delete_message' || action === 'delete_for_me') {
    const { messageId } = body;
    if (!messageId) return json({ error: 'Missing messageId' }, 400);
    const { data: msg } = await sb.from(T.messages).select('id, chat_id, sender_id, deleted_for').eq('id', messageId).single();
    if (!msg) return json({ error: 'Message not found' }, 404);
    const { data: chat } = await sb.from(T.chats).select('participants').eq('id', msg.chat_id).single();
    if (!chat?.participants?.includes(senderId)) return json({ error: 'Not a chat member' }, 403);
    const current: string[] = msg.deleted_for ?? [];
    if (!current.includes(senderId)) {
      await sb.from(T.messages).update({ deleted_for: [...current, senderId] }).eq('id', messageId);
    }
    const participants: string[] = chat.participants ?? [];
    const otherUserId = participants.find((p: string) => p !== senderId) ?? '';
    const { data: lastForOther } = await sb.from(T.messages).select('message, sender_id, created_at')
      .eq('chat_id', msg.chat_id).not('deleted_for', 'cs', `{${otherUserId}}`).order('created_at', { ascending: false }).limit(1).maybeSingle();
    await sb.from(T.chats).update({ last_message: lastForOther?.message ?? '', last_message_at: lastForOther?.created_at ?? null, last_sender_id: lastForOther?.sender_id ?? null, last_message_status: 'sent' }).eq('id', msg.chat_id);
    return json({ success: true });
  }

  if (action === 'delete_for_everyone') {
    const { messageId } = body;
    if (!messageId) return json({ error: 'Missing messageId' }, 400);
    const { data: msg } = await sb.from(T.messages).select('id, chat_id, sender_id, created_at').eq('id', messageId).single();
    if (!msg)                         return json({ error: 'Message not found' }, 404);
    if (msg.sender_id !== senderId)   return json({ error: 'Only sender can unsend' }, 403);
    if (Date.now() - new Date(msg.created_at).getTime() > 60_000) return json({ error: 'Unsend window expired (60 s)' }, 403);
    await sb.from(T.messages).delete().eq('id', messageId);
    const { data: chat } = await sb.from(T.chats).select('participants').eq('id', msg.chat_id).single();
    const otherUserId = (chat?.participants ?? []).find((p: string) => p !== senderId) ?? '';
    const { data: latestForOther } = await sb.from(T.messages).select('message, sender_id, created_at')
      .eq('chat_id', msg.chat_id).not('deleted_for', 'cs', `{${otherUserId}}`).order('created_at', { ascending: false }).limit(1).maybeSingle();
    await sb.from(T.chats).update({ last_message: latestForOther?.message ?? '', last_message_at: latestForOther?.created_at ?? null, last_sender_id: latestForOther?.sender_id ?? null, last_message_status: 'sent' }).eq('id', msg.chat_id);
    return json({ success: true });
  }

  if (action === 'clear_chat') {
    const { chatId } = body;
    if (!chatId) return json({ error: 'Missing chatId' }, 400);
    const { data: chat } = await sb.from(T.chats).select('participants, last_message, last_message_at, last_sender_id').eq('id', chatId).single();
    if (!chat) return json({ error: 'Chat not found' }, 404);
    if (!chat.participants.includes(senderId)) return json({ error: 'Not a chat member' }, 403);
    const { error: rpcErr } = await sb.rpc('append_deleted_for', { p_chat_id: chatId, p_user_id: senderId });
    if (rpcErr) {
      const { data: msgs } = await sb.from(T.messages).select('id, deleted_for').eq('chat_id', chatId);
      if (msgs?.length) await Promise.all(msgs.filter((m: any) => !(m.deleted_for ?? []).includes(senderId)).map((m: any) => sb.from(T.messages).update({ deleted_for: [...(m.deleted_for ?? []), senderId] }).eq('id', m.id)));
    }
    const participants: string[] = chat.participants ?? [];
    const myIndex = participants.indexOf(senderId);
    const otherUserId = participants.find((p: string) => p !== senderId);
    const clearedAtField = myIndex === 0 ? 'cleared_at_p1' : 'cleared_at_p2';
    const { data: lastForOther } = otherUserId
      ? await sb.from(T.messages).select('message, sender_id, created_at').eq('chat_id', chatId).not('deleted_for', 'cs', `{${otherUserId}}`).order('created_at', { ascending: false }).limit(1).maybeSingle()
      : { data: null };
    await sb.from(T.chats).update({ [clearedAtField]: new Date().toISOString(), last_message: lastForOther?.message ?? '', last_message_at: lastForOther?.created_at ?? null, last_sender_id: lastForOther?.sender_id ?? null, last_message_status: 'sent' }).eq('id', chatId);
    return json({ success: true });
  }

  if (action === 'remove_friend') {
    const { connectionId } = body;
    if (!connectionId) return json({ error: 'Missing connectionId' }, 400);
    const { data: conn } = await sb.from(T.conn).select('sender_id, receiver_id, chat_id').eq('id', connectionId).maybeSingle();
    if (!conn) return json({ error: 'Connection not found' }, 404);
    if (conn.sender_id !== senderId && conn.receiver_id !== senderId) return json({ error: 'Not authorized' }, 403);
    const otherUserId = conn.sender_id === senderId ? conn.receiver_id : conn.sender_id;
    let chatId = conn.chat_id;
    if (!chatId) {
      const chatKey = [senderId, otherUserId].sort().join('_');
      const { data: chat } = await sb.from(T.chats).select('id').eq('chat_key', chatKey).maybeSingle();
      chatId = chat?.id ?? null;
    }
    if (chatId) { await sb.from(T.messages).delete().eq('chat_id', chatId); await sb.from(T.chats).delete().eq('id', chatId); }
    await sb.from(T.notif).delete().or(`and(user_id.eq.${senderId},sender_id.eq.${otherUserId}),and(user_id.eq.${otherUserId},sender_id.eq.${senderId})`);
    await sb.from(T.conn).delete().eq('id', connectionId);
    updateCounts(sb, senderId, otherUserId);
    return json({ success: true, chatId });
  }

  if (action === 'hide_chat') {
    const { chatId } = body;
    if (!chatId) return json({ error: 'Missing chatId' }, 400);
    const { data: chat } = await sb.from(T.chats).select('participants, hidden_for').eq('id', chatId).single();
    if (!chat) return json({ success: true });
    if (!chat.participants.includes(senderId)) return json({ error: 'Not a chat member' }, 403);
    const { error: rpcErr } = await sb.rpc('append_deleted_for', { p_chat_id: chatId, p_user_id: senderId });
    if (rpcErr) {
      const { data: msgs } = await sb.from(T.messages).select('id, deleted_for').eq('chat_id', chatId);
      if (msgs?.length) await Promise.all(msgs.filter((m: any) => !(m.deleted_for ?? []).includes(senderId)).map((m: any) => sb.from(T.messages).update({ deleted_for: [...(m.deleted_for ?? []), senderId] }).eq('id', m.id)));
    }
    const hiddenFor: string[] = chat.hidden_for ?? [];
    const newHidden = hiddenFor.includes(senderId) ? hiddenFor : [...hiddenFor, senderId];
    const otherUserId = (chat.participants as string[]).find((p: string) => p !== senderId);
    const { data: lastForOther } = otherUserId
      ? await sb.from(T.messages).select('message, sender_id, created_at').eq('chat_id', chatId).not('deleted_for', 'cs', `{${otherUserId}}`).order('created_at', { ascending: false }).limit(1).maybeSingle()
      : { data: null };
    await sb.from(T.chats).update({ last_message: lastForOther?.message ?? '', last_message_at: lastForOther?.created_at ?? null, last_sender_id: lastForOther?.sender_id ?? null, last_message_status: 'sent', hidden_for: newHidden }).eq('id', chatId);
    return json({ success: true });
  }

  if (action === 'mark_chat_read') {
    const { chatId } = body;
    if (!chatId) return json({ error: 'Missing chatId' }, 400);
    const { data: chat } = await sb.from(T.chats).select('participants, last_sender_id').eq('id', chatId).single();
    if (!chat) return json({ error: 'Chat not found' }, 404);
    const participants: string[] = chat.participants ?? [];
    const memberIndex = participants.indexOf(senderId);
    if (memberIndex === -1) return json({ error: 'Not a chat member' }, 403);
    await sb.from(T.messages).update({ status: 'seen' }).eq('chat_id', chatId).neq('sender_id', senderId);
    const chatUpdates: Record<string, any> = { last_message_status: 'seen' };
    if (memberIndex === 0) chatUpdates.unread_p1 = 0;
    else if (memberIndex === 1) chatUpdates.unread_p2 = 0;
    await sb.from(T.chats).update(chatUpdates).eq('id', chatId);
    return json({ success: true });
  }

  if (action === 'check_block') {
    const { otherUserId } = body;
    if (!otherUserId) return json({ error: 'Missing otherUserId' }, 400);
    const { data: rows } = await sb.from(T.blocks).select('blocker_id')
      .or(`and(blocker_id.eq.${senderId},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${senderId})`);
    return json({ success: true, iBlockedThem: (rows ?? []).some((r: any) => r.blocker_id === senderId), theyBlockedMe: (rows ?? []).some((r: any) => r.blocker_id === otherUserId), isBlocked: (rows ?? []).length > 0 });
  }

  if (action === 'block_user') {
    const { blockedId } = body;
    if (!blockedId || blockedId === senderId) return json({ error: !blockedId ? 'Missing blockedId' : 'Cannot block yourself' }, 400);
    const { data: ex } = await sb.from(T.blocks).select('id').eq('blocker_id', senderId).eq('blocked_id', blockedId).maybeSingle();
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
    const { data: msg } = await sb.from(T.messages).select('sender_id, chat_id, created_at').eq('id', messageId).single();
    if (!msg)                       return json({ error: 'Message not found' }, 404);
    if (msg.sender_id !== senderId) return json({ error: 'Not your message' }, 403);
    const trimmed = newText.trim();
    await sb.from(T.messages).update({ message: trimmed, edited: true }).eq('id', messageId);
    const { data: ch } = await sb.from(T.chats).select('last_message_at').eq('id', msg.chat_id).single().catch(() => ({ data: null }));
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
    if (!userId || userId !== senderId) return json({ error: 'Unauthorized' }, 403);
    try {
      const { data: userChats } = await sb.from(T.chats).select('id').contains('participants', [userId]);
      const chatIds: string[] = (userChats ?? []).map((c: any) => c.id);
      if (chatIds.length) { await sb.from(T.messages).delete().in('chat_id', chatIds); await sb.from(T.chats).delete().in('id', chatIds); }
      await sb.from(T.messages).delete().eq('sender_id', userId);
      await sb.from(T.notif).delete().eq('sender_id', userId);
      await sb.from(T.notif).delete().eq('user_id', userId);
      await sb.from(T.blocks).delete().eq('blocker_id', userId);
      await sb.from(T.blocks).delete().eq('blocked_id', userId);
      await sb.from(T.conn).delete().eq('sender_id', userId);
      await sb.from(T.conn).delete().eq('receiver_id', userId);
      await sb.from(T.users).delete().eq('user_id', userId);
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } });
      await admin.auth.admin.deleteUser(userId).catch(() => {});
      return json({ success: true });
    } catch (e: any) { return json({ error: e?.message ?? 'Delete failed' }, 500); }
  }

  if (action === 'get_chat_id') {
    const { otherUserId } = body;
    if (!otherUserId) return json({ error: 'Missing otherUserId' }, 400);
    const chatKey = [senderId, otherUserId].sort().join('_');
    const { data: chat } = await sb.from(T.chats).select('id, hidden_for, participants').eq('chat_key', chatKey).maybeSingle();
    if (!chat) return json({ chatId: null });
    return json({ chatId: chat.id, isHidden: (chat.hidden_for ?? []).includes(senderId) });
  }

  if (action === 'delete_cloudinary_image') {
    const { publicId, resourceType = 'image' } = body;
    if (!publicId) return json({ error: 'Missing publicId' }, 400);
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY'), apiSecret = Deno.env.get('CLOUDINARY_API_SECRET'), cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
    if (!apiKey || !apiSecret || !cloudName) return json({ success: true, skipped: true });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sigStr = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const hashBuf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(sigStr));
    const signature = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
    const form = new FormData();
    form.append('public_id', publicId); form.append('timestamp', timestamp); form.append('api_key', apiKey); form.append('signature', signature);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`, { method: 'POST', body: form });
    const result = await res.json();
    if (result.result === 'ok' || result.result === 'not found') return json({ success: true });
    return json({ error: result.result ?? 'Delete failed' }, 500);
  }

  if (action === 'sign_upload') {
    const { userId, resourceType = 'image' } = body;
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY'), apiSecret = Deno.env.get('CLOUDINARY_API_SECRET'), cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
    if (!apiKey || !apiSecret || !cloudName) return json({ error: 'Cloudinary not configured' }, 500);
    if (!userId) return json({ error: 'Missing userId' }, 400);
    const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const publicId = `mindmates/profiles/profile_${safeId}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const paramsToSign: Record<string, string> = { overwrite: 'true', public_id: publicId, timestamp };
    const sigStr = Object.keys(paramsToSign).sort().map(k => `${k}=${paramsToSign[k]}`).join('&') + apiSecret;
    const hashBuf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(sigStr));
    const signature = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
    return json({ success: true, signature, timestamp, apiKey, cloudName, publicId, resourceType });
  }

  return json({ error: `Unknown action: ${action}` }, 400);
}

// ─── getMatches ───────────────────────────────────────────────────────────────
async function doGetMatches(sb: any, body: any) {
  const { userId, limit = 20, bust = false } = body;
  if (!userId) return json({ error: 'userId required' }, 400);
  const t0 = Date.now();
  const { data: me } = await sb.from(T.users).select('skills, location').eq('user_id', userId).maybeSingle();
  if (!me) return json({ error: 'Profile not found' }, 404);
  const mySkills = parseSkills(me.skills);
  const myCity   = normCity(me.location);
  if (!mySkills.length) return json({ matches: [], total: 0, hasMore: false, ms: Date.now() - t0 });
  const skillsKey = mySkills.slice().sort().join(',');
  const cacheKey  = `m_${userId}`;
  if (!bust) {
    const h = mc.get(cacheKey);
    if (h && Date.now() - h.at < MC_TTL && h.skillsKey === skillsKey) return json({ ...h.data, src: 'cache', ms: Date.now() - t0 });
  }
  const skillFilter = mySkills.map(skill => `skills.ilike.%${skill}%`).join(',');
  const { data: cands } = await sb.from(T.users).select('user_id, full_name, bio, location, profile_image, skills').eq('is_profile_complete', true).neq('user_id', userId).or(skillFilter).limit(500);
  const lim    = Math.min(limit, 50);
  const ranked = (cands ?? []).map((u: any) => {
    const their  = parseSkills(u.skills);
    const common = mySkills.filter(s => their.includes(s));
    if (!common.length) return null;
    const sc    = normCity(u.location) === myCity && myCity.length > 0;
    const all   = common.length >= mySkills.length;
    const score = common.length * 10 + (all ? 50 : 0) + (sc ? 30 : 0);
    const tier  = all && sc ? 1 : all ? 2 : sc ? 3 : 4;
    return { userId: u.user_id, fullName: u.full_name ?? '', bio: u.bio ?? '', location: u.location ?? '', profileImage: u.profile_image ?? null, skillsArray: their, matchScore: score, commonSkills: common, sameCity: sc, allSkillsMatch: all, tier };
  }).filter(Boolean).sort((a: any, b: any) => a.tier !== b.tier ? a.tier - b.tier : b.matchScore - a.matchScore).slice(0, lim);
  const result = { matches: ranked, total: ranked.length, hasMore: false };
  mc.set(cacheKey, { data: result, at: Date.now(), skillsKey });
  return json({ ...result, ms: Date.now() - t0 });
}