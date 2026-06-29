import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0';

declare const Deno: { env: { get(k: string): string | undefined } };

// ─── CORS ─────────────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const corsOk = () => new Response('ok', { status: 200, headers: CORS });
const json   = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), {
    status: s,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

// ─── Table names ──────────────────────────────────────────────────────────────
const T = {
  users:    'users',
  conn:     'connections',
  notif:    'notifications',
  chats:    'chats',
  messages: 'messages',
  blocks:   'blocks',
  tokens:   'push_tokens',
};

// ─── Rate limiter ─────────────────────────────────────────────────────────────
const _rl = new Map<string, number[]>();
function rateLimit(uid: string, action: string, max: number, windowMs = 60_000): boolean {
  const k   = `${uid}:${action}`;
  const now = Date.now();
  const hits = (_rl.get(k) ?? []).filter(t => now - t < windowMs);
  if (hits.length >= max) return false;
  hits.push(now);
  _rl.set(k, hits);
  if (_rl.size > 5_000) {
    for (const [key, times] of _rl) {
      if (times.every(t => now - t > 300_000)) _rl.delete(key);
    }
  }
  return true;
}

// ─── Match cache ──────────────────────────────────────────────────────────────
const _mc  = new Map<string, { data: unknown; at: number; skillsKey: string; connKey: string }>();
const MC_TTL = 5 * 60_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const parseSkills = (s: unknown): string[] =>
  !s ? [] : String(s).split(',').map(x => x.trim().toLowerCase()).filter(Boolean);

const normCity = (s: unknown): string =>
  (s ?? '').toString().toLowerCase().trim().split(',')[0].trim();

const safeJson = async (req: Request): Promise<Record<string, unknown>> => {
  try {
    const raw = await req.json();
    return (typeof raw === 'string' ? JSON.parse(raw) : raw) ?? {};
  } catch { return {}; }
};

const ensureHttps = (url: string | null | undefined): string => {
  if (!url || url.trim() === '') return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return '';
};

const resolveUrl = (type: string, d: Record<string, unknown>): string => {
  switch (type) {
    case 'new_message':         return d.chatId   ? `/subScreens/chatScreen/${d.chatId}`    : '/(tabs)/home';
    case 'connection_request':  return d.senderId ? `/subScreens/userProfile/${d.senderId}` : '/(tabs)/home';
    case 'connection_accepted': return d.chatId   ? `/subScreens/chatScreen/${d.chatId}`    : '/(tabs)/home';
    default:                    return '/(tabs)/home';
  }
};

const resolveChannel = (type: string): string => {
  switch (type) {
    case 'new_message':                 return 'messages';
    case 'connection_request':
    case 'connection_accepted':         return 'social';
    case 'daily_morning':
    case 'daily_night':                 return 'daily';
    default:                            return 'messages';
  }
};

const formatPush = (
  type: string,
  fallbackTitle: string,
  fallbackBody:  string,
  data: Record<string, unknown>,
): { title: string; subtitle?: string; body: string } => {
  const name = (data.senderName as string) || 'Someone';
  switch (type) {
    case 'new_message':
      return { title: name, subtitle: 'MindMates', body: fallbackBody };
    case 'connection_request':
      return {
        title:    'New Friend Request 👋',
        subtitle: 'MindMates',
        body:     `${name} wants to connect with you`,
      };
    case 'connection_accepted':
      return {
        title:    'Connection Accepted! 🎉',
        subtitle: 'MindMates',
        body:     `${name} accepted your request — say hello!`,
      };
    default:
      return { title: fallbackTitle, body: fallbackBody };
  }
};

// ─── Expo push — single user ──────────────────────────────────────────────────
async function pushOne(
  sb:     ReturnType<typeof import('https://esm.sh/@supabase/supabase-js@2.43.0').createClient>,
  userId: string,
  title:  string,
  body:   string,
  data:   Record<string, unknown>,
): Promise<void> {
  try {
    const { data: row } = await sb
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId)
      .maybeSingle();

    const token = row?.token as string | undefined;
    if (!token?.startsWith('ExponentPushToken')) return;

    const type      = (data.type as string) ?? '';
    const url       = resolveUrl(type, data);
    const channelId = resolveChannel(type);
    const { title: fmtTitle, subtitle: fmtSubtitle, body: fmtBody } = formatPush(type, title, body, data);
    const senderImage = ensureHttps(data.senderImage as string | undefined);

    const msg: Record<string, unknown> = {
      to:        token,
      title:     fmtTitle,
      body:      fmtBody,
      sound:     'default',
      badge:     1,
      priority:  'high',
      channelId,
      ttlSeconds: 86400,
      ...(fmtSubtitle ? { subtitle: fmtSubtitle } : {}),
      data: {
        type,
        url,
        title:       fmtTitle,
        body:        fmtBody,
        chatId:      data.chatId      ?? null,
        senderId:    data.senderId    ?? null,
        senderName:  data.senderName  ?? '',
        senderImage,
      },
    };

    if (senderImage.length > 0) {
      msg.image = senderImage;
    }

    let res!: Response;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(EXPO_PUSH_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(msg),
      });
      if (res.status !== 429 && res.status !== 503) break;
      await sleep(1_000 * 2 ** attempt);
    }

    const result = await res.json().catch(() => ({}));

    if (result?.data?.status === 'error') {
      const errCode = result.data.details?.error ?? '';
      const errMsg  = result.data.message        ?? '';
      if (errCode === 'DeviceNotRegistered' || errMsg.includes('InvalidCredentials')) {
        await sb.from('push_tokens').delete().eq('user_id', userId).catch(() => {});
        console.log(`[push] removed dead token for ${userId}`);
      } else {
        console.warn(`[push] delivery error for ${userId}:`, errMsg);
      }
    }
  } catch (e: unknown) {
    console.error('[push] error:', (e as Error)?.message ?? e);
  }
}

const EXPO_PUSH_URL   = 'https://exp.host/--/api/v2/push/send';
const BROADCAST_BATCH = 100;
const BROADCAST_DELAY = 300;
const DB_PAGE_SIZE    = 500;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function pushBroadcast(
  sb:    ReturnType<typeof import('https://esm.sh/@supabase/supabase-js@2.43.0').createClient>,
  title: string,
  body:  string,
  data:  Record<string, unknown>,
): Promise<{ sent: number; failed: number; dead: number }> {
  let sent = 0, failed = 0;
  const dead: string[] = [];
  let page = 0;

  outer: while (true) {
    const { data: rows, error } = await sb
      .from('push_tokens')
      .select('token, user_id')
      .range(page * DB_PAGE_SIZE, (page + 1) * DB_PAGE_SIZE - 1);

    if (error) { console.error('[broadcast] DB page error:', error.message); break; }
    if (!rows || rows.length === 0) break;

    const valid = (rows as { token: string; user_id: string }[])
      .filter(r => r.token?.startsWith('ExponentPushToken'));

    for (let i = 0; i < valid.length; i += BROADCAST_BATCH) {
      const batch = valid.slice(i, i + BROADCAST_BATCH);
      const messages = batch.map(r => ({
        to:        r.token,
        title,
        body,
        sound:     'default',
        priority:  'normal',
        channelId: (data.channelId as string) ?? 'daily',
        badge:     0,
        ttlSeconds: 86400,
        data: { ...data, title, body, url: data.url ?? '/(tabs)/home' },
      }));

      try {
        let res = await fetch(EXPO_PUSH_URL, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(messages),
        });
        if (res.status === 429) {
          console.warn('[broadcast] Rate limited — waiting 2s before retry');
          await sleep(2_000);
          res = await fetch(EXPO_PUSH_URL, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(messages),
          });
        }
        if (!res.ok) { console.error(`[broadcast] HTTP error: ${res.status}`); failed += batch.length; continue; }
        const result = await res.json().catch(() => ({ data: [] }));
        const items  = Array.isArray(result?.data) ? result.data : [];
        (items as any[]).forEach((r: any, idx: number) => {
          if (r.status === 'ok') { sent++; }
          else {
            failed++;
            if (r.details?.error === 'DeviceNotRegistered' || r.message?.includes('InvalidCredentials')) {
              dead.push(batch[idx].token);
            }
          }
        });
      } catch (e: unknown) {
        console.error('[broadcast] batch error:', (e as Error)?.message);
        failed += batch.length;
      }
      if (i + BROADCAST_BATCH < valid.length) await sleep(BROADCAST_DELAY);
    }
    if (rows.length < DB_PAGE_SIZE) break outer;
    page++;
  }

  if (dead.length > 0) {
    await sb.from('push_tokens').delete().in('token', dead).catch(() => {});
    console.log(`[broadcast] removed ${dead.length} dead tokens`);
  }
  return { sent, failed, dead: dead.length };
}

async function updateCounts(
  sb:   ReturnType<typeof createClient>,
  uid1: string,
  uid2: string,
): Promise<void> {
  const count = async (uid: string) => {
    const { count: n } = await sb
      .from(T.conn).select('*', { count: 'exact', head: true })
      .eq('status', 'accepted')
      .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`);
    return n ?? 0;
  };
  Promise.all([uid1, uid2].map(async uid => {
    const n = await count(uid);
    await sb.from(T.users).update({ connections: n }).eq('user_id', uid);
  })).catch(() => {});
}

// ─── Main server ──────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsOk();
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405);

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  let senderId: string | null = null;
  const authHeader = (req.headers.get('authorization') ?? '').trim();
  if (authHeader) {
    try {
      const { data: { user } } = await sb.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''));
      if (user?.id) senderId = user.id;
    } catch { /* invalid token */ }
  }

  const body   = await safeJson(req);
  const action = String(body.action ?? '').trim();
  console.log(`[${action}] sender=${senderId ?? 'anon'}`);

  if (action === 'getMatches') return doGetMatches(sb, body, senderId);

  if (action === 'broadcast_morning' || action === 'broadcast_night') {
    const svcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!svcKey || authHeader !== `Bearer ${svcKey}`) return json({ error: 'Unauthorized' }, 401);
    return doBroadcast(sb, action === 'broadcast_morning' ? 'morning' : 'night');
  }

  if (!senderId) return json({ error: 'Unauthorized' }, 401);

  try {
    return await doAction(sb, action, body, senderId);
  } catch (e: unknown) {
    console.error(`[${action}] uncaught:`, (e as Error)?.message ?? e);
    return json({ error: 'Internal server error' }, 500);
  }
});

async function doBroadcast(
  sb:   ReturnType<typeof import('https://esm.sh/@supabase/supabase-js@2.43.0').createClient>,
  type: 'morning' | 'night',
): Promise<Response> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await sb
    .from('broadcast_log').select('sent_date')
    .eq('type', type).eq('sent_date', today).maybeSingle().catch(() => ({ data: null }));

  if (existing) {
    console.log(`[broadcast] ${type} already sent today — skipping`);
    return new Response(JSON.stringify({ success: true, skipped: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

  await sb.from('broadcast_log')
    .upsert({ type, sent_date: today }, { onConflict: 'type,sent_date' }).catch(() => {});

  const MORNING = [
    { title: '🌞 Good Morning!',      body: 'Stay confident — this is your day! 💜' },
    { title: '🌞 Rise & Shine!',      body: 'Every day is a fresh start. Make it count! 🌟' },
    { title: '🌞 Good Morning!',      body: "You've got this. Start strong today! 💪" },
    { title: '🌞 New Day, New You!',  body: 'Wake up with purpose. Great things are coming! 🔥' },
    { title: '🌞 Good Morning!',      body: 'Believe in yourself today. You are amazing! 🌈' },
    { title: '🌞 Happy Morning!',     body: 'Smile, breathe, go slowly. You got this! 😊' },
    { title: '🌞 Morning Vibes!',     body: 'Today is full of possibilities. Go grab them! ⚡' },
  ];
  const NIGHT = [
    { title: '🌙 Good Night!',        body: 'Stay happy — tomorrow will be your day! 💜' },
    { title: '⭐ Sweet Dreams!',      body: 'Rest well. Tomorrow brings new opportunities! 🌟' },
    { title: '🌙 Good Night!',        body: 'You did great today. Tomorrow will be even better! 😊' },
    { title: '💤 Time to Rest!',      body: 'Recharge tonight. Tomorrow is going to be amazing! ✨' },
    { title: '🌙 Good Night!',        body: 'Close your eyes peacefully — best day is coming! 🌈' },
    { title: '⭐ Rest Well!',         body: "Tomorrow is another chance to be great. Sleep tight! 💪" },
    { title: '🌙 Night Night!',       body: "Dream big tonight. Tomorrow we'll make it real! 🔥" },
  ];

  const pool = type === 'morning' ? MORNING : NIGHT;
  const msg  = pool[new Date().getDay() % pool.length];
  console.log(`[broadcast] starting ${type}: "${msg.title}"`);

  const stats = await pushBroadcast(sb, msg.title, msg.body, {
    type:      type === 'morning' ? 'daily_morning' : 'daily_night',
    url:       '/(tabs)/home',
    channelId: 'daily',
  });

  console.log(`[broadcast] ${type} complete:`, stats);
  return new Response(JSON.stringify({ success: true, type, message: msg, stats }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Action router ────────────────────────────────────────────────────────────
async function doAction(
  sb:       ReturnType<typeof createClient>,
  action:   string,
  body:     Record<string, unknown>,
  senderId: string,
): Promise<Response> {

  // ── send_request ────────────────────────────────────────────────────────────
  if (action === 'send_request') {
    const receiverId = String(body.receiverId ?? '');
    if (!receiverId)              return json({ error: 'Missing receiverId' }, 400);
    if (receiverId === senderId)  return json({ error: 'Cannot connect with yourself' }, 400);
    if (!rateLimit(senderId, 'send_request', 10)) return json({ error: 'Too many requests' }, 429);

    const { data: existing } = await sb.from(T.conn).select('id, status')
      .or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`)
      .maybeSingle();
    if (existing) return json({ success: false, alreadyExists: true, connectionId: existing.id, status: existing.status }, 409);

    const { data: sp } = await sb.from(T.users)
      .select('full_name, profile_image, skills, location').eq('user_id', senderId).maybeSingle();

    const { data: conn, error: connErr } = await sb.from(T.conn)
      .insert({ sender_id: senderId, receiver_id: receiverId, status: 'pending' })
      .select('id').single();
    if (connErr) { console.error('[send_request] insert:', connErr.message); return json({ error: connErr.message }, 500); }

    // FIX: bust the match cache for BOTH users so neither sees the other
    // in search results after a connection request is sent.
    _mc.delete(`m_${senderId}`);
    _mc.delete(`m_${receiverId}`);

    Promise.all([
      sb.from(T.notif).insert({
        user_id: receiverId, sender_id: senderId,
        sender_name: sp?.full_name ?? '', sender_image: sp?.profile_image ?? '',
        sender_skills: sp?.skills ?? '', sender_location: sp?.location ?? '',
        type: 'connection_request', connection_id: conn.id, is_read: false,
      }),
      pushOne(sb, receiverId, 'New Friend Request', `${sp?.full_name ?? 'Someone'} wants to connect`, {
        type:        'connection_request',
        senderId,
        senderName:  sp?.full_name      ?? '',
        senderImage: ensureHttps(sp?.profile_image),
        connectionId: conn.id,
      }),
    ]).catch(e => console.error('[send_request] bg error:', e?.message));

    return json({ success: true, connectionId: conn.id });
  }

  // ── accept_request ──────────────────────────────────────────────────────────
  if (action === 'accept_request') {
    let { connectionId, notifId } = body as { connectionId?: string; notifId?: string };

    let conn: Record<string, unknown> | null = null;

    if (connectionId) {
      const { data } = await sb.from(T.conn).select('*').eq('id', connectionId).maybeSingle();
      conn = data;
    }
    if (!conn && notifId) {
      const { data: notif } = await sb.from(T.notif).select('connection_id, sender_id').eq('id', notifId).maybeSingle();
      if (notif?.connection_id) {
        const { data } = await sb.from(T.conn).select('*').eq('id', notif.connection_id).maybeSingle();
        if (data) { conn = data; connectionId = data.id as string; }
      }
      if (!conn && notif?.sender_id) {
        const { data } = await sb.from(T.conn).select('*')
          .eq('sender_id', notif.sender_id).eq('receiver_id', senderId).eq('status', 'pending').maybeSingle();
        if (data) { conn = data; connectionId = data.id as string; }
      }
    }
    if (!conn) {
      const { data } = await sb.from(T.conn).select('*').eq('receiver_id', senderId).eq('status', 'pending')
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (data) { conn = data; connectionId = data.id as string; }
    }

    if (!conn)                                     return json({ error: 'Connection not found' }, 404);
    if ((conn.receiver_id as string) !== senderId) return json({ error: 'Not authorized' }, 403);
    if ((conn.status as string) !== 'pending')     return json({ error: `Already ${conn.status}` }, 409);

    const chatKey = [senderId, conn.sender_id as string].sort().join('_');
    let chatId: string;

    const { data: existChat } = await sb.from(T.chats).select('id').eq('chat_key', chatKey).maybeSingle();
    if (existChat) {
      chatId = existChat.id as string;
      await Promise.all([
        sb.from(T.messages).delete().eq('chat_id', chatId),
        sb.from(T.chats).update({ last_message: '', last_message_at: null, last_sender_id: null, last_message_status: 'sent' }).eq('id', chatId),
      ]);
    } else {
      const { data: newChat, error: chatErr } = await sb.from(T.chats)
        .insert({ participants: [senderId, conn.sender_id], chat_key: chatKey, last_message: '' })
        .select('id').single();
      if (chatErr) return json({ error: chatErr.message }, 500);
      chatId = newChat.id as string;
    }

    await Promise.all([
      sb.from(T.conn).update({ status: 'accepted', chat_id: chatId }).eq('id', connectionId),
      notifId ? sb.from(T.notif).update({ is_read: true, type: 'accepted' }).eq('id', notifId) : Promise.resolve(),
    ]);

    // FIX: bust cache for both users on accept too
    _mc.delete(`m_${senderId}`);
    _mc.delete(`m_${conn.sender_id as string}`);

    updateCounts(sb, senderId, conn.sender_id as string);

    const { data: accepter } = await sb.from(T.users).select('full_name, profile_image').eq('user_id', senderId).maybeSingle();
    pushOne(sb, conn.sender_id as string,
      'Connection Accepted!', `${accepter?.full_name ?? 'Someone'} accepted your friend request`,
      {
        type:        'connection_accepted',
        chatId,
        senderId,
        senderName:  accepter?.full_name ?? '',
        senderImage: ensureHttps(accepter?.profile_image),
      },
    ).catch(() => {});

    return json({ success: true, chatId });
  }

  // ── reject_request ──────────────────────────────────────────────────────────
// ── reject_request ──────────────────────────────────────────────────────────
if (action === 'reject_request') {
  const { connectionId, notifId } = body as { connectionId?: string; notifId?: string };
  if (!connectionId) return json({ error: 'Missing connectionId' }, 400);

  const { data: conn } = await sb.from(T.conn)
    .select('receiver_id, status, sender_id')
    .eq('id', connectionId)
    .single();

  if (!conn)                                     return json({ error: 'Not found' }, 404);
  if ((conn.receiver_id as string) !== senderId) return json({ error: 'Not authorized' }, 403);
  if ((conn.status as string) !== 'pending')     return json({ error: 'Not pending' }, 409);

  await Promise.all([
    sb.from(T.conn).delete().eq('id', connectionId),
    // ✅ Fixed: wrap in Promise.resolve() so .catch() works
    notifId
      ? Promise.resolve(sb.from(T.notif).delete().eq('id', notifId)).catch(() => {})
      : Promise.resolve(),
  ]);

  _mc.delete(`m_${senderId}`);
  return json({ success: true });
}

  // ── cancel_request ──────────────────────────────────────────────────────────
  if (action === 'cancel_request') {
    const { connectionId } = body as { connectionId?: string };
    if (!connectionId) return json({ error: 'Missing connectionId' }, 400);
    const { data: conn } = await sb.from(T.conn).select('sender_id, receiver_id, status').eq('id', connectionId).single();
    if (!conn)                                   return json({ error: 'Not found' }, 404);
    if ((conn.sender_id as string) !== senderId) return json({ error: 'Not authorized' }, 403);
    if ((conn.status as string) !== 'pending')   return json({ error: 'Not pending' }, 409);
    const { data: notif } = await sb.from(T.notif).select('id').eq('connection_id', connectionId).maybeSingle();
    await Promise.all([
      sb.from(T.conn).delete().eq('id', connectionId),
      notif ? sb.from(T.notif).delete().eq('id', notif.id).catch(() => {}) : Promise.resolve(),
    ]);
    // FIX: bust cache for both users so cancelled user reappears in search
    _mc.delete(`m_${senderId}`);
    _mc.delete(`m_${conn.receiver_id as string}`);
    return json({ success: true });
  }

  // ── send_message ─────────────────────────────────────────────────────────────
if (action === 'send_message') {
  const {
    chatId, message, type = 'text',
    audioUrl = null, duration = null, waveform = null,
    replyToId = null, replyToText = null, replyToSender = null,
  } = body as {
    chatId?: string; message?: string; type?: string;
    audioUrl?: string | null; duration?: number | null; waveform?: number[] | null;
    replyToId?: string | null; replyToText?: string | null; replyToSender?: string | null;
  };

  const isVoice = type === 'voice';
  if (!chatId) return json({ error: 'Missing chatId' }, 400);
  if (!isVoice && !message?.trim()) return json({ error: 'Missing message' }, 400);
  if (isVoice && !audioUrl) return json({ error: 'Missing audioUrl for voice message' }, 400);
  if (!rateLimit(senderId, 'send_message', 60)) return json({ error: 'Too fast — slow down' }, 429);

  const trimmed = isVoice ? '' : (message?.trim() ?? '');
  if (!isVoice && trimmed.length > 4_000) return json({ error: 'Message too long' }, 400);

  const { data: chat } = await sb.from(T.chats).select('participants').eq('id', chatId).single();
  if (!chat) return json({ error: 'Chat not found' }, 404);

  const parts = chat.participants as string[];
  if (!parts.includes(senderId)) return json({ error: 'Not a member' }, 403);
  const receiverId = parts.find((p) => p !== senderId) ?? '';
  const senderIdx  = parts.indexOf(senderId);   // 0 or 1
  const recvIdx    = parts.indexOf(receiverId);  // 0 or 1

  const { data: block } = await sb.from(T.blocks).select('blocker_id')
    .or(`and(blocker_id.eq.${senderId},blocked_id.eq.${receiverId}),and(blocker_id.eq.${receiverId},blocked_id.eq.${senderId})`)
    .limit(1).maybeSingle();
  if (block) return json({ error: 'Blocked', blocked: true }, 403);

  const { data: saved, error: msgErr } = await sb.from(T.messages)
    .insert({
      chat_id: chatId, sender_id: senderId, message: trimmed, type,
      audio_url: audioUrl, duration, waveform, status: 'sent',
      reply_to_id: replyToId, reply_to_text: replyToText, reply_to_sender: replyToSender,
    })
    .select('id, created_at').single();

  if (msgErr || !saved) return json({ error: 'Failed to save message' }, 500);

  const lastMessagePreview = isVoice ? '🎤 Voice message' : trimmed;

  // ✅ Update BOTH per-user last_message columns + shared fields
  await sb.from(T.chats).update({
    hidden_for:          [],
    last_message:        lastMessagePreview,
    last_message_at:     saved.created_at,
    last_sender_id:      senderId,
    last_message_status: 'sent',
    // Per-user columns — both see the new message
    [`last_message_p${senderIdx + 1}`]:    lastMessagePreview,
    [`last_message_at_p${senderIdx + 1}`]: saved.created_at,
    [`last_sender_id_p${senderIdx + 1}`]:  senderId,
    [`last_message_p${recvIdx + 1}`]:      lastMessagePreview,
    [`last_message_at_p${recvIdx + 1}`]:   saved.created_at,
    [`last_sender_id_p${recvIdx + 1}`]:    senderId,
  }).eq('id', chatId);

  // Push notification
  Promise.resolve().then(async () => {
    const [{ data: rcvr }, { data: snd }] = await Promise.all([
      sb.from(T.users).select('active_chat_id').eq('user_id', receiverId).maybeSingle(),
      sb.from(T.users).select('full_name, profile_image').eq('user_id', senderId).maybeSingle(),
    ]);
    if (rcvr?.active_chat_id === chatId) return;
    await pushOne(sb, receiverId,
      snd?.full_name ?? 'New Message',
      lastMessagePreview.length > 60 ? `${lastMessagePreview.slice(0, 60)}…` : lastMessagePreview,
      { type: 'new_message', chatId, senderId, senderName: snd?.full_name ?? '', senderImage: ensureHttps(snd?.profile_image) },
    );
  }).catch(() => {});

  return json({ success: true, messageId: saved.id, createdAt: saved.created_at });
}

// ── delete_message / delete_for_me ───────────────────────────────────────────
if (action === 'delete_message' || action === 'delete_for_me') {
  const { messageId } = body as { messageId?: string };
  if (!messageId) return json({ error: 'Missing messageId' }, 400);

  const { data: msg } = await sb.from(T.messages)
    .select('id, chat_id, sender_id, deleted_for').eq('id', messageId).single();
  if (!msg) return json({ error: 'Message not found' }, 404);

  const { data: chat } = await sb.from(T.chats)
    .select('participants').eq('id', msg.chat_id).single();
  if (!(chat?.participants as string[])?.includes(senderId))
    return json({ error: 'Not a chat member' }, 403);

  const current = (msg.deleted_for as string[]) ?? [];
  if (!current.includes(senderId)) {
    await sb.from(T.messages)
      .update({ deleted_for: [...current, senderId] }).eq('id', messageId);
  }

  const parts = chat!.participants as string[];
  const myIdx = parts.indexOf(senderId);
  const other = parts.find(p => p !== senderId) ?? '';
  const otherIdx = parts.indexOf(other);

  // ── FIX: select type and audio_url so voice messages get correct preview ──
  const [{ data: lastForMe }, { data: lastForOther }] = await Promise.all([
    sb.from(T.messages)
      .select('message, sender_id, created_at, type, audio_url')
      .eq('chat_id', msg.chat_id)
      .not('deleted_for', 'cs', `{${senderId}}`)
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle(),
    sb.from(T.messages)
      .select('message, sender_id, created_at, type, audio_url')
      .eq('chat_id', msg.chat_id)
      .not('deleted_for', 'cs', `{${other}}`)
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle(),
  ]);

  // ── FIX: build preview correctly — voice messages have message='' ──────────
  const buildPreview = (row: { message: string; type?: string; audio_url?: string } | null) => {
    if (!row) return '';
    if (row.type === 'voice') return '🎤 Voice message';
    return row.message ?? '';
  };

  await sb.from(T.chats).update({
    [`last_message_p${myIdx + 1}`]:    buildPreview(lastForMe),
    [`last_message_at_p${myIdx + 1}`]: lastForMe?.created_at  ?? null,
    [`last_sender_id_p${myIdx + 1}`]:  lastForMe?.sender_id   ?? null,
    [`last_message_p${otherIdx + 1}`]:    buildPreview(lastForOther),
    [`last_message_at_p${otherIdx + 1}`]: lastForOther?.created_at ?? null,
    [`last_sender_id_p${otherIdx + 1}`]:  lastForOther?.sender_id  ?? null,
    // shared field = other user's view
    last_message:        buildPreview(lastForOther),
    last_message_at:     lastForOther?.created_at ?? null,
    last_sender_id:      lastForOther?.sender_id  ?? null,
    last_message_status: 'sent',
  }).eq('id', msg.chat_id);

  return json({ success: true });
}

// ── delete_for_everyone ───────────────────────────────────────────────────────
if (action === 'delete_for_everyone') {
  const { messageId } = body as { messageId?: string };
  if (!messageId) return json({ error: 'Missing messageId' }, 400);

  const { data: msg } = await sb.from(T.messages)
    .select('id, chat_id, sender_id, created_at').eq('id', messageId).single();
  if (!msg) return json({ error: 'Message not found' }, 404);
  if ((msg.sender_id as string) !== senderId) return json({ error: 'Only sender can unsend' }, 403);
  if (Date.now() - new Date(msg.created_at as string).getTime() > 60_000)
    return json({ error: 'Unsend window expired (60 s)' }, 403);

  await sb.from(T.messages).delete().eq('id', messageId);

  const { data: chat } = await sb.from(T.chats)
    .select('participants').eq('id', msg.chat_id).single();
  const parts = (chat?.participants as string[]) ?? [];
  const p1 = parts[0] ?? '';
  const p2 = parts[1] ?? '';

  // ── FIX: select type so voice preview is correct ──────────────────────────
  const buildPreview = (row: { message: string; type?: string } | null) => {
    if (!row) return '';
    if (row.type === 'voice') return '🎤 Voice message';
    return row.message ?? '';
  };

  const [{ data: lastP1 }, { data: lastP2 }] = await Promise.all([
    p1 ? sb.from(T.messages)
      .select('message, sender_id, created_at, type')
      .eq('chat_id', msg.chat_id)
      .not('deleted_for', 'cs', `{${p1}}`)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
      : { data: null },
    p2 ? sb.from(T.messages)
      .select('message, sender_id, created_at, type')
      .eq('chat_id', msg.chat_id)
      .not('deleted_for', 'cs', `{${p2}}`)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
      : { data: null },
  ]);

  await sb.from(T.chats).update({
    last_message_p1:    buildPreview(lastP1),
    last_message_at_p1: lastP1?.created_at ?? null,
    last_sender_id_p1:  lastP1?.sender_id  ?? null,
    last_message_p2:    buildPreview(lastP2),
    last_message_at_p2: lastP2?.created_at ?? null,
    last_sender_id_p2:  lastP2?.sender_id  ?? null,
    last_message:        buildPreview(lastP1),
    last_message_at:     lastP1?.created_at ?? null,
    last_sender_id:      lastP1?.sender_id  ?? null,
    last_message_status: 'sent',
  }).eq('id', msg.chat_id);

  return json({ success: true });
}

// ── clear_chat ────────────────────────────────────────────────────────────────
if (action === 'clear_chat') {
  const { chatId } = body as { chatId?: string };
  if (!chatId) return json({ error: 'Missing chatId' }, 400);

  const { data: chat } = await sb.from(T.chats)
    .select('participants, last_message, last_message_at, last_sender_id')
    .eq('id', chatId).single();
  if (!chat) return json({ error: 'Chat not found' }, 404);
  if (!(chat.participants as string[]).includes(senderId))
    return json({ error: 'Not a member' }, 403);

  const { error: rpcErr } = await sb.rpc('append_deleted_for', { p_chat_id: chatId, p_user_id: senderId });
  if (rpcErr) {
    const { data: msgs } = await sb.from(T.messages).select('id, deleted_for').eq('chat_id', chatId);
    await Promise.all(
      (msgs ?? []).filter((m: { deleted_for: string[] }) => !(m.deleted_for ?? []).includes(senderId))
        .map((m: { id: string; deleted_for: string[] }) =>
          sb.from(T.messages).update({ deleted_for: [...(m.deleted_for ?? []), senderId] }).eq('id', m.id))
    ).catch(() => {});
  }

  const parts = chat.participants as string[];
  const myIdx = parts.indexOf(senderId);
  const other = parts.find(p => p !== senderId) ?? '';
  const otherIdx = parts.indexOf(other); // 0 or 1

  // ✅ MY preview = empty. OTHER user's preview = unchanged (fetch their last visible)
  const { data: lastForOther } = other
    ? await sb.from(T.messages).select('message, sender_id, created_at')
        .eq('chat_id', chatId)
        .not('deleted_for', 'cs', `{${other}}`)
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle()
    : { data: null };

  await sb.from(T.chats).update({
    [myIdx === 0 ? 'cleared_at_p1' : 'cleared_at_p2']: new Date().toISOString(),

    // ✅ MY per-user columns → blank (I cleared everything)
    [`last_message_p${myIdx + 1}`]:    '',
    [`last_message_at_p${myIdx + 1}`]: null,
    [`last_sender_id_p${myIdx + 1}`]:  null,

    // ✅ OTHER user's per-user columns → their last visible message (untouched)
    [`last_message_p${otherIdx + 1}`]:    lastForOther?.message    ?? '',
    [`last_message_at_p${otherIdx + 1}`]: lastForOther?.created_at ?? null,
    [`last_sender_id_p${otherIdx + 1}`]:  lastForOther?.sender_id  ?? null,

    // Shared field = other user's view (so their sort order stays correct)
    last_message:        lastForOther?.message    ?? '',
    last_message_at:     lastForOther?.created_at ?? null,
    last_sender_id:      lastForOther?.sender_id  ?? null,
    last_message_status: 'sent',
  }).eq('id', chatId);

  return json({ success: true });
}

  // ── remove_friend ───────────────────────────────────────────────────────────
  if (action === 'remove_friend') {
    const { connectionId } = body as { connectionId?: string };
    if (!connectionId) return json({ error: 'Missing connectionId' }, 400);
    const { data: conn } = await sb.from(T.conn).select('sender_id, receiver_id, chat_id').eq('id', connectionId).maybeSingle();
    if (!conn) return json({ error: 'Not found' }, 404);
    if ((conn.sender_id as string) !== senderId && (conn.receiver_id as string) !== senderId) return json({ error: 'Not authorized' }, 403);
    const other  = (conn.sender_id as string) === senderId ? conn.receiver_id as string : conn.sender_id as string;
    let chatId   = conn.chat_id as string | null;
    if (!chatId) {
      const chatKey = [senderId, other].sort().join('_');
      const { data: c } = await sb.from(T.chats).select('id').eq('chat_key', chatKey).maybeSingle();
      chatId = c?.id ?? null;
    }
    await Promise.all([
      chatId ? sb.from(T.messages).delete().eq('chat_id', chatId) : Promise.resolve(),
      chatId ? sb.from(T.chats).delete().eq('id', chatId)         : Promise.resolve(),
      sb.from(T.notif).delete().or(`and(user_id.eq.${senderId},sender_id.eq.${other}),and(user_id.eq.${other},sender_id.eq.${senderId})`),
      sb.from(T.conn).delete().eq('id', connectionId),
    ]);
    // FIX: bust cache for both so the removed friend reappears in search
    _mc.delete(`m_${senderId}`);
    _mc.delete(`m_${other}`);
    updateCounts(sb, senderId, other);
    return json({ success: true, chatId });
  }

  // ── hide_chat ───────────────────────────────────────────────────────────────
  if (action === 'hide_chat') {
    const { chatId } = body as { chatId?: string };
    if (!chatId) return json({ error: 'Missing chatId' }, 400);
    const { data: chat } = await sb.from(T.chats).select('participants, hidden_for').eq('id', chatId).single();
    if (!chat) return json({ success: true });
    if (!(chat.participants as string[]).includes(senderId)) return json({ error: 'Not a member' }, 403);
    const { error: rpcErr } = await sb.rpc('append_deleted_for', { p_chat_id: chatId, p_user_id: senderId });
    if (rpcErr) {
      const { data: msgs } = await sb.from(T.messages).select('id, deleted_for').eq('chat_id', chatId);
      await Promise.all(
        (msgs ?? []).filter((m: { deleted_for: string[] }) => !(m.deleted_for ?? []).includes(senderId))
          .map((m: { id: string; deleted_for: string[] }) => sb.from(T.messages).update({ deleted_for: [...(m.deleted_for ?? []), senderId] }).eq('id', m.id))
      ).catch(() => {});
    }
    const hidden = (chat.hidden_for as string[]) ?? [];
    const other  = (chat.participants as string[]).find(p => p !== senderId);
    const { data: last } = other
      ? await sb.from(T.messages).select('message, sender_id, created_at').eq('chat_id', chatId)
          .not('deleted_for', 'cs', `{${other}}`).order('created_at', { ascending: false }).limit(1).maybeSingle()
      : { data: null };
    await sb.from(T.chats).update({
      last_message: last?.message ?? '', last_message_at: last?.created_at ?? null,
      last_sender_id: last?.sender_id ?? null, last_message_status: 'sent',
      hidden_for: hidden.includes(senderId) ? hidden : [...hidden, senderId],
    }).eq('id', chatId);
    return json({ success: true });
  }

  // ── mark_chat_read ──────────────────────────────────────────────────────────
  if (action === 'mark_chat_read') {
    const { chatId } = body as { chatId?: string };
    if (!chatId) return json({ error: 'Missing chatId' }, 400);
    const { data: chat } = await sb.from(T.chats).select('participants').eq('id', chatId).single();
    if (!chat) return json({ error: 'Chat not found' }, 404);
    const parts = chat.participants as string[];
    const idx   = parts.indexOf(senderId);
    if (idx === -1) return json({ error: 'Not a member' }, 403);
    const updates: Record<string, unknown> = { last_message_status: 'seen' };
    if (idx === 0) updates.unread_p1 = 0;
    if (idx === 1) updates.unread_p2 = 0;
    await Promise.all([
      sb.from(T.messages).update({ status: 'seen' }).eq('chat_id', chatId).neq('sender_id', senderId),
      sb.from(T.chats).update(updates).eq('id', chatId),
    ]);
    return json({ success: true });
  }

  // ── check_block ─────────────────────────────────────────────────────────────
  if (action === 'check_block') {
    const { otherUserId } = body as { otherUserId?: string };
    if (!otherUserId) return json({ error: 'Missing otherUserId' }, 400);
    const { data: rows } = await sb.from(T.blocks).select('blocker_id')
      .or(`and(blocker_id.eq.${senderId},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${senderId})`);
    const list = (rows ?? []) as { blocker_id: string }[];
    return json({
      success:       true,
      iBlockedThem:  list.some(r => r.blocker_id === senderId),
      theyBlockedMe: list.some(r => r.blocker_id === otherUserId),
      isBlocked:     list.length > 0,
    });
  }

  // ── block_user ──────────────────────────────────────────────────────────────
  if (action === 'block_user') {
    const { blockedId } = body as { blockedId?: string };
    if (!blockedId || blockedId === senderId) return json({ error: 'Invalid blockedId' }, 400);
    const { data: ex } = await sb.from(T.blocks).select('id').eq('blocker_id', senderId).eq('blocked_id', blockedId).maybeSingle();
    if (ex) return json({ success: true, alreadyBlocked: true });
    await sb.from(T.blocks).insert({ blocker_id: senderId, blocked_id: blockedId });
    // FIX: bust cache so blocked user disappears from search immediately
    _mc.delete(`m_${senderId}`);
    return json({ success: true });
  }

  // ── unblock_user ────────────────────────────────────────────────────────────
  if (action === 'unblock_user') {
    const { blockedId } = body as { blockedId?: string };
    if (!blockedId) return json({ error: 'Missing blockedId' }, 400);
    await sb.from(T.blocks).delete().eq('blocker_id', senderId).eq('blocked_id', blockedId);
    // FIX: bust cache so unblocked user reappears in search
    _mc.delete(`m_${senderId}`);
    return json({ success: true });
  }

  // ── edit_message ────────────────────────────────────────────────────────────
  if (action === 'edit_message') {
    const { messageId, newText } = body as { messageId?: string; newText?: string };
    if (!messageId || !newText?.trim()) return json({ error: 'Missing messageId or newText' }, 400);
    const trimmed = newText.trim();
    if (trimmed.length > 4_000) return json({ error: 'Message too long' }, 400);
    const { data: msg } = await sb.from(T.messages).select('sender_id, chat_id, created_at').eq('id', messageId).single();
    if (!msg)                                    return json({ error: 'Message not found' }, 404);
    if ((msg.sender_id as string) !== senderId)  return json({ error: 'Not your message' }, 403);
    await sb.from(T.messages).update({ message: trimmed, edited: true }).eq('id', messageId);
    const { data: ch } = await sb.from(T.chats).select('last_message_at').eq('id', msg.chat_id).single().catch(() => ({ data: null }));
    if (ch && new Date(ch.last_message_at as string).getTime() >= new Date(msg.created_at as string).getTime() - 1_000) {
      await sb.from(T.chats).update({ last_message: trimmed }).eq('id', msg.chat_id).catch(() => {});
    }
    return json({ success: true });
  }

  // ── react_message ───────────────────────────────────────────────────────────
  if (action === 'react_message') {
    const { messageId, emoji } = body as { messageId?: string; emoji?: string };
    if (!messageId || !emoji) return json({ error: 'Missing messageId or emoji' }, 400);
    const { data: msg } = await sb.from(T.messages).select('reactions, chat_id').eq('id', messageId).single();
    if (!msg) return json({ error: 'Message not found' }, 404);
    const { data: chat } = await sb.from(T.chats).select('participants').eq('id', msg.chat_id).single();
    if (!(chat?.participants as string[])?.includes(senderId)) return json({ error: 'Not a member' }, 403);
    let rx: { userId: string; emoji: string }[] = [];
    try { rx = msg.reactions ? JSON.parse(msg.reactions as string) : []; } catch { rx = []; }
    const idx = rx.findIndex(r => r.userId === senderId && r.emoji === emoji);
    if (idx >= 0) rx.splice(idx, 1);
    else { rx = rx.filter(r => r.userId !== senderId); rx.push({ userId: senderId, emoji }); }
    await sb.from(T.messages).update({ reactions: JSON.stringify(rx) }).eq('id', messageId);
    return json({ success: true, reactions: rx });
  }

  // ── delete_account ──────────────────────────────────────────────────────────
  if (action === 'delete_account') {
    const { userId } = body as { userId?: string };
    if (!userId || userId !== senderId) return json({ error: 'Unauthorized' }, 403);
    try {
      const { data: userChats } = await sb.from(T.chats).select('id').contains('participants', [userId]);
      const chatIds = (userChats ?? []).map((c: { id: string }) => c.id);
      await Promise.all([
        chatIds.length ? sb.from(T.messages).delete().in('chat_id', chatIds) : Promise.resolve(),
        chatIds.length ? sb.from(T.chats).delete().in('id', chatIds)         : Promise.resolve(),
        sb.from(T.messages).delete().eq('sender_id', userId),
        sb.from(T.notif).delete().eq('sender_id', userId),
        sb.from(T.notif).delete().eq('user_id', userId),
        sb.from(T.blocks).delete().eq('blocker_id', userId),
        sb.from(T.blocks).delete().eq('blocked_id', userId),
        sb.from(T.conn).delete().eq('sender_id', userId),
        sb.from(T.conn).delete().eq('receiver_id', userId),
        sb.from(T.tokens).delete().eq('user_id', userId),
        sb.from(T.users).delete().eq('user_id', userId),
      ]);
      _mc.delete(`m_${userId}`);
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } });
      await admin.auth.admin.deleteUser(userId).catch(e => console.error('[delete_account] auth:', e?.message));
      return json({ success: true });
    } catch (e: unknown) {
      console.error('[delete_account]', (e as Error)?.message);
      return json({ error: 'Delete failed' }, 500);
    }
  }

  // ── get_chat_id ─────────────────────────────────────────────────────────────
  if (action === 'get_chat_id') {
    const { otherUserId } = body as { otherUserId?: string };
    if (!otherUserId) return json({ error: 'Missing otherUserId' }, 400);
    const chatKey = [senderId, otherUserId].sort().join('_');
    const { data: chat } = await sb.from(T.chats).select('id, hidden_for').eq('chat_key', chatKey).maybeSingle();
    if (!chat) return json({ chatId: null });
    return json({ chatId: chat.id, isHidden: ((chat.hidden_for as string[]) ?? []).includes(senderId) });
  }

  // ── delete_cloudinary_image ─────────────────────────────────────────────────
  if (action === 'delete_cloudinary_image') {
    const { publicId, resourceType = 'image' } = body as { publicId?: string; resourceType?: string };
    if (!publicId) return json({ error: 'Missing publicId' }, 400);
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY'), apiSecret = Deno.env.get('CLOUDINARY_API_SECRET'), cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
    if (!apiKey || !apiSecret || !cloudName) return json({ success: true, skipped: true });
    const ts  = Math.floor(Date.now() / 1000).toString();
    const sig = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`public_id=${publicId}&timestamp=${ts}${apiSecret}`)))).map(b => b.toString(16).padStart(2, '0')).join('');
    const form = new FormData();
    form.append('public_id', publicId); form.append('timestamp', ts); form.append('api_key', apiKey); form.append('signature', sig);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`, { method: 'POST', body: form });
    const r   = await res.json();
    return r.result === 'ok' || r.result === 'not found' ? json({ success: true }) : json({ error: r.result ?? 'Delete failed' }, 500);
  }

  // ── sign_upload ─────────────────────────────────────────────────────────────
  if (action === 'sign_upload') {
    const { userId, resourceType = 'image' } = body as { userId?: string; resourceType?: string };
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY'), apiSecret = Deno.env.get('CLOUDINARY_API_SECRET'), cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
    if (!apiKey || !apiSecret || !cloudName) return json({ error: 'Cloudinary not configured' }, 500);
    if (!userId) return json({ error: 'Missing userId' }, 400);
    const publicId = `mindmates/profiles/profile_${userId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const ts       = Math.floor(Date.now() / 1000).toString();
    const params   = { overwrite: 'true', public_id: publicId, timestamp: ts };
    const sigStr   = Object.keys(params).sort().map(k => `${k}=${(params as Record<string, string>)[k]}`).join('&') + apiSecret;
    const sig      = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(sigStr)))).map(b => b.toString(16).padStart(2, '0')).join('');
    return json({ success: true, signature: sig, timestamp: ts, apiKey, cloudName, publicId, resourceType });
  }

  return json({ error: `Unknown action: ${action}` }, 400);
}

// ─── getMatches ───────────────────────────────────────────────────────────────
async function doGetMatches(
  sb:       ReturnType<typeof createClient>,
  body:     Record<string, unknown>,
  senderId: string | null,
): Promise<Response> {
  const { userId, limit = 20, bust = false } = body as { userId?: string; limit?: number; bust?: boolean };
  if (!userId) return json({ error: 'userId required' }, 400);

  const t0 = Date.now();

  // FIX: fetch connections + blocks IN PARALLEL with the user profile.
  // This means exclusion data is ALWAYS fresh — never skipped for cache hits.
  const [{ data: me }, { data: connRows }, { data: blockRows }] = await Promise.all([
    sb.from(T.users).select('skills, location').eq('user_id', userId).maybeSingle(),

    // All connections any status — pending, accepted, rejected — all excluded
    sb.from(T.conn)
      .select('sender_id, receiver_id')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),

    // Blocks in both directions
    sb.from(T.blocks)
      .select('blocker_id, blocked_id')
      .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`),
  ]);

  if (!me) return json({ error: 'Profile not found' }, 404);

  // Build exclusion Set — O(1) lookup
  const excluded = new Set<string>([userId]); // always exclude self
  for (const r of connRows  ?? []) { excluded.add(r.sender_id as string); excluded.add(r.receiver_id as string); }
  for (const r of blockRows ?? []) { excluded.add(r.blocker_id as string); excluded.add(r.blocked_id as string); }

  const mySkills = parseSkills(me.skills);
  const myCity   = normCity(me.location);
  if (!mySkills.length) return json({ matches: [], total: 0, hasMore: false, ms: Date.now() - t0 });

  const skillsKey = [...mySkills].sort().join(',');
  // FIX: cache key includes a hash of the excluded set so any connection change
  // produces a different key and bypasses the stale cache automatically.
  const connKey  = [...excluded].sort().join(',');
  const cacheKey = `m_${userId}`;

  if (!bust) {
    const h = _mc.get(cacheKey);
    // FIX: validate cache against BOTH skillsKey AND connKey.
    // Previously only skillsKey was checked, so a new connection never
    // invalidated the cache — connected users kept appearing from cache,
    // then disappeared when the next fresh fetch ran. Now any change to
    // connections or blocks produces a different connKey and forces a fresh query.
    if (
      h &&
      Date.now() - h.at < MC_TTL &&
      h.skillsKey === skillsKey &&
      h.connKey   === connKey          // ← THE KEY FIX: stale if connections changed
    ) {
      return json({ ...(h.data as object), src: 'cache', ms: Date.now() - t0 });
    }
  }

  const lim = Math.min(Number(limit), 50);

  const { data: cands } = await sb.from(T.users)
    .select('user_id, full_name, bio, location, profile_image, skills')
    .eq('is_profile_complete', true)
    .neq('user_id', userId)
    .or(mySkills.map(s => `skills.ilike.%${s}%`).join(','))
    .limit(500);

  const ranked = (cands ?? [])
    .filter((u: Record<string, unknown>) => !excluded.has(u.user_id as string))
    .map((u: Record<string, unknown>) => {
      const their  = parseSkills(u.skills);
      const common = mySkills.filter(s => their.includes(s));
      if (!common.length) return null;
      const sc    = normCity(u.location) === myCity && myCity.length > 0;
      const all   = common.length >= mySkills.length;
      const score = common.length * 10 + (all ? 50 : 0) + (sc ? 30 : 0);
      const tier  = all && sc ? 1 : all ? 2 : sc ? 3 : 4;
      return {
        userId: u.user_id, fullName: u.full_name ?? '', bio: u.bio ?? '',
        location: u.location ?? '', profileImage: u.profile_image ?? null,
        skillsArray: their, matchScore: score, commonSkills: common,
        sameCity: sc, allSkillsMatch: all, tier,
      };
    })
    .filter(Boolean)
    .sort((a: unknown, b: unknown) => {
      const aa = a as { tier: number; matchScore: number };
      const bb = b as { tier: number; matchScore: number };
      return aa.tier !== bb.tier ? aa.tier - bb.tier : bb.matchScore - aa.matchScore;
    })
    .slice(0, lim);

  const result = { matches: ranked, total: ranked.length, hasMore: false };
  // FIX: store connKey in cache entry so future requests can detect staleness
  _mc.set(cacheKey, { data: result, at: Date.now(), skillsKey, connKey });
  console.log(`[getMatches] ${userId}: ${ranked.length} matches (excluded ${excluded.size}) in ${Date.now() - t0}ms`);
  return json({ ...result, ms: Date.now() - t0 });
}