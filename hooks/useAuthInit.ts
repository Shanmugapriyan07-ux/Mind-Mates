// import { supabase } from '@/lib/supabase';
// import { logout, restoreSession } from '@/services/authServices';
// import { useAuthStore } from '@/stores/authStore';
// import { useEffect, useRef } from 'react';
// import { AppState, AppStateStatus } from 'react-native';
// export function useAuthInit(): void {
//   const initialized = useRef(false);
//   useEffect(() => {
//     if (initialized.current) return;
//     initialized.current = true;
//     restoreSession();
//     const { data: { subscription } } = supabase.auth.onAuthStateChange(
//       async (event, session) => {
//         console.info('[useAuthInit] Auth event:', event);
//         if (event === 'SIGNED_OUT' || !session) {
//           useAuthStore.getState().clearSession();
//         }
//         if (event === 'TOKEN_REFRESHED' && session) {
//           console.info('[useAuthInit] Token refreshed silently');
//         }
//       }
//     );
//     let prevState: AppStateStatus = AppState.currentState;
//     const appStateSub = AppState.addEventListener('change', (nextState) => {
//       if (nextState === 'active' && prevState !== 'active') {
//         supabase.auth.getSession().then(({ data: { session } }) => {
//           if (!session && useAuthStore.getState().phase === 'authenticated') {
//             console.warn('[useAuthInit] Session expired in background — signing out');
//             logout();
//           }
//         });
//       }
//       prevState = nextState;
//     });
//     return () => {
//       subscription.unsubscribe();
//       appStateSub.remove();
//     };
//   }, []);
// }