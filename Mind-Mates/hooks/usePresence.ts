// // hooks/usePresence.ts
// //
// // TEACHING: How presence (online/offline) works
// //
// // CONCEPT: "Heartbeat" pattern
// //   Your app sends a "I'm alive" signal every 3 minutes
// //   This updates lastSeen timestamp in your user doc
// //   Other users check: if lastSeen < 5 min ago → online
// //
// // WHY 3 minutes update + 5 minute threshold?
// //   3 min update interval → battery friendly (not every second)
// //   5 min threshold → small buffer so user doesn't flicker
// //   offline while still using app (network delay etc)
// //
// // TEACHING: AppState — React Native's way to know if app is
// //   active (foreground) or in background
// //   AppState.currentState === 'active' → app is open
// //   AppState.currentState === 'background' → app is minimized
// //
// // USAGE:
// //   // In your root layout or main screen:
// //   usePresence(); // just call it — runs automatically

// import { useEffect, useRef, useCallback }  from 'react';
// import { AppState, AppStateStatus }        from 'react-native';
// import { supabase, config }               from '@/lib/supabase';
 
// import { useAuth }                         from '@/Contexts/authContext';

// const DB              = config.databaseId;
// const USERS           = config.usersCollectionId;
// const UPDATE_INTERVAL = 3 * 60 * 1000;  // update every 3 minutes
// const ONLINE_WINDOW   = 5 * 60 * 1000;  // online if seen in last 5 minutes

// // ─── HOOK 1: usePresence ──────────────────────────────────────────
// // Call this ONCE in your root layout or home screen
// // It keeps YOUR lastSeen updated while app is open
// export const usePresence = () => {
//   const { user }  = useAuth();
//   const docIdRef  = useRef<string | null>(null);
//   const timerRef  = useRef<NodeJS.Timeout | null>(null);

//   // ── Update lastSeen in Appwrite ───────────────────────────────
//   const updateLastSeen = useCallback(async () => {
//     if (!user?.id) return;

//     try {
//       // Find my doc $id if we don't have it cached
//       if (!docIdRef.current) {
//         const { data } = await supabase
//           .from(USERS)
//           .select('id')
//           .eq('user_id', user.id)
//           .single();
          
//         if (data) docIdRef.current = data.id;
//         else return;
//       }

//       const docId = docIdRef.current;
//       if (!docId) return;

//       // Update lastSeen to now (ISO datetime string)
//       await supabase
//         .from(USERS)
//         .update({ lastSeen: new Date().toISOString() })
//         .eq('id', docId);

//     } catch (e: any) {
//       // Don't throw — presence is non-critical
//       // If it fails, user just shows as offline — not a big deal
//       if (e?.code !== 401) { // ignore auth errors silently
//         console.log('⚠️ Presence update failed (non-critical):', e?.message);
//       }
//     }
//   }, [user?.id]);

//   // ── Start heartbeat when app is active ───────────────────────
//   const startHeartbeat = useCallback(() => {
//     // Update immediately when app opens
//     updateLastSeen();

//     // Then update every 3 minutes
//     timerRef.current = setInterval(updateLastSeen, UPDATE_INTERVAL);
//   }, [updateLastSeen]);

//   // ── Stop heartbeat when app goes to background ───────────────
//   const stopHeartbeat = useCallback(() => {
//     if (timerRef.current) {
//       clearInterval(timerRef.current);
//       timerRef.current = null;
//     }
//   }, []);

//   useEffect(() => {
//     if (!user?.id) return;

//     // Start immediately
//     startHeartbeat();

//     // TEACHING: AppState tells us when app goes to background/foreground
//     // When user minimizes app → stop updating (save battery)
//     // When user reopens app → update immediately + restart timer
//     const subscription = AppState.addEventListener(
//       'change',
//       (nextState: AppStateStatus) => {
//         if (nextState === 'active') {
//           startHeartbeat();    // app came to foreground
//         } else {
//           stopHeartbeat();     // app went to background
//         }
//       }
//     );

//     return () => {
//       stopHeartbeat();
//       subscription.remove();
//     };
//   }, [user?.id, startHeartbeat, stopHeartbeat]);
// };

// // ─── HOOK 2: useOnlineStatus ──────────────────────────────────────
// // Use this to check if a SPECIFIC user is online
// // TEACHING: Simple utility — just compares timestamps
// //
// // Usage:
// //   const isOnline = useOnlineStatus(friend.lastSeen);
// export const useOnlineStatus = (lastSeen: string | null | undefined): boolean => {
//   if (!lastSeen) return false;
//   const lastSeenMs = new Date(lastSeen).getTime();
//   return Date.now() - lastSeenMs < ONLINE_WINDOW;
// };

// // ─── UTILITY: isOnline function ───────────────────────────────────
// // Non-hook version for use inside map/filter
// export const isOnline = (lastSeen: string | null | undefined): boolean => {
//   if (!lastSeen) return false;
//   const lastSeenMs = new Date(lastSeen).getTime();
//   return Date.now() - lastSeenMs < ONLINE_WINDOW;
// };

// // Export the threshold so ChatList can use same logic
// export { ONLINE_WINDOW };

// hooks/usePresence.ts
// Call this in _layout.tsx so presence is always active while app is open

import { useEffect, useRef } from 'react';
import { AppState }          from 'react-native';
import { supabase }          from '@/lib/supabase';
import { useAuth }           from '@/Contexts/authContext';

export const usePresence = () => {
  const { user } = useAuth();
  const timer = useRef<any>(null);

  const beat = async (uid: string) => {
    await supabase.from('users')
      .update({ last_seen: new Date().toISOString() })
      .eq('user_id', uid)
      .match(() => {});
  };

  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;

    beat(uid);
    timer.current = setInterval(() => beat(uid), 30_000);

    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') beat(uid);
    });

    return () => {
      clearInterval(timer.current);
      sub.remove();
    };
  }, [user?.id]);
};