import { supabase } from '@/lib/supabase';
import { AppState, AppStateStatus } from 'react-native';

const HEARTBEAT_MS     = 20_000;   
const BACKGROUND_DELAY = 8_000;  
const INIT_RETRY_MS    = 2_000;  
const MAX_INIT_RETRIES = 3;

class PresenceService {
  private userId:         string | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private bgTimer:        ReturnType<typeof setTimeout>  | null = null;
  private appStateSub:    { remove(): void } | null = null;
  private isDestroyed     = false;
  private currentState:   AppStateStatus = 'active';
  private initInProgress  = false;
  async init(userId: string) {
    if (this.userId === userId && !this.isDestroyed) {
      const currentAppState = AppState.currentState;
      if (currentAppState === 'active') {
        this.beat();
      }
      return;
    }
    if (this.initInProgress) return;
    this.initInProgress = true;

    try {
      await this.teardown( true);

      this.isDestroyed = false;
      this.userId      = userId;
      console.log('[Presence] init:', userId.slice(0, 8));

      this.currentState = AppState.currentState as AppStateStatus;

      if (this.currentState === 'active') {
        this.setOnlineWithRetry(true).catch(() => {});
        this.startHeartbeat();
      }
      this.listenAppState();
    } finally {
      this.initInProgress = false;
    }
  }
  async destroy() {
    await this.teardown(false);
    this.userId = null;
  }
  enterChat(chatId: string): void {
    if (!this.userId) return;
    supabase
      .from('users')
      .update({ active_chat_id: chatId })
      .eq('user_id', this.userId)
      .then(({ error }) => {
        if (error) console.warn('[Presence] enterChat failed:', error.message);
      });
  }
  leaveChat(): void {
    if (!this.userId) return;
    supabase
      .from('users')
      .update({ active_chat_id: null })
      .eq('user_id', this.userId)
      .then(({ error }) => {
        if (error) console.warn('[Presence] leaveChat failed:', error.message);
      });
  }
  private async teardown(silent: boolean) {
    this.isDestroyed = true;
    this.stopHeartbeat();
    this.stopBgTimer();
    this.appStateSub?.remove();

    if (!silent && this.userId) {
      this.setFields({ is_online: false, active_chat_id: null }).catch(() => {});
    }
  }
  private async setOnlineWithRetry(online: boolean, attempt = 0): Promise<void> {
    if (this.isDestroyed || !this.userId) return;
    if (attempt >= MAX_INIT_RETRIES) return;

    try {
      await this.setOnline(online);
    } catch (e: any) {
      if (attempt < MAX_INIT_RETRIES) {
        console.warn(`[Presence] setOnline retry ${attempt + 1}:`, e?.message);
        await new Promise(r => setTimeout(r, INIT_RETRY_MS * (attempt + 1)));
        return this.setOnlineWithRetry(online, attempt + 1);
      }
      console.warn('[Presence] setOnline failed after retries:', e?.message);
    }
  }
  private async setOnline(online: boolean) {
    await this.setFields({
      is_online: online,
      last_seen: new Date().toISOString(),
      ...(online ? {} : { active_chat_id: null }),
    });
  }

  private async setFields(fields: Record<string, any>) {
    if (!this.userId) return;
    const uid = this.userId;
    const { error } = await supabase
      .from('users')
      .update(fields)
      .eq('user_id', uid);
    if (error) throw new Error(error.message);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.isDestroyed && this.currentState === 'active') {
        this.beat();
      }
    }, HEARTBEAT_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async beat() {
    if (!this.userId || this.isDestroyed) return;
    const uid = this.userId;
    try {
      await supabase
        .from('users')
        .update({ is_online: true, last_seen: new Date().toISOString() })
        .eq('user_id', uid);
    } catch {}
  }

  private stopBgTimer() {
    if (this.bgTimer) {
      clearTimeout(this.bgTimer);
      this.bgTimer = null;
    }
  }

  private listenAppState() {
    this.appStateSub?.remove();
    this.appStateSub = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (this.isDestroyed) return;
        if (nextState === this.currentState) return;
        const prevState   = this.currentState;
        this.currentState = nextState;

        if (nextState === 'active') {
          this.stopBgTimer();
          this.stopHeartbeat();         
          this.setOnlineWithRetry(true);
          this.startHeartbeat();

        } else if (nextState === 'background') {
          this.stopHeartbeat();
          this.stopBgTimer();
          if (this.userId) {
            supabase
              .from('users')
              .update({ active_chat_id: null, is_online: false })
              .eq('user_id', this.userId)
              .then(({ error }) => {
                if (error) console.warn('[Presence] bg sync failed');
              });
          }
          this.bgTimer = setTimeout(() => {
            if (this.currentState === 'background' && !this.isDestroyed) {
              this.setOnline(false).catch(() => {});
            }
          }, BACKGROUND_DELAY);

        } else if (nextState === 'inactive') {
          if (prevState === 'active') {
          }
        }
      }
    );
  }
}

export const presenceService = new PresenceService();