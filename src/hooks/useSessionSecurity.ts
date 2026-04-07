import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { AuthSession } from '@supabase/supabase-js';

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const DEVICE_TOKEN_KEY = 'vaulta_device_token';

export function getDeviceToken(): string {
  let token = localStorage.getItem(DEVICE_TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(DEVICE_TOKEN_KEY, token);
  }
  return token;
}

export async function registerDeviceSession(userId: string) {
  const token = getDeviceToken();
  await supabase.from('user_sessions').upsert({
    user_id: userId,
    session_token: token,
    last_active_at: new Date().toISOString()
  });
}

export function useSessionSecurity(session: AuthSession | null, timeoutMs: number = DEFAULT_TIMEOUT_MS) {
  const timeoutRef = useRef<number | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const isCheckingRef = useRef(false);

  const clearTimers = () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
  };

  const handleSignOut = async (reason: string) => {
    console.log(`[Auth] Signing out. Reason: ${reason}`);
    clearTimers();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const sendHeartbeat = async () => {
    if (!session?.user) return;
    try {
      await supabase.from('user_sessions').update({
        last_active_at: new Date().toISOString()
      }).eq('user_id', session.user.id);
    } catch (e) {
      console.warn('Failed to send session heartbeat', e);
    }
  };

  const resetIdleTimer = () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      handleSignOut('Idle timeout reached');
    }, timeoutMs);
  };

  useEffect(() => {
    if (!session?.user) {
      clearTimers();
      return;
    }

    const userId = session.user.id;
    const currentToken = getDeviceToken();

    const verifySession = async () => {
      if (isCheckingRef.current) return;
      isCheckingRef.current = true;
      try {
        const { data, error } = await supabase
          .from('user_sessions')
          .select('session_token, last_active_at')
          .eq('user_id', userId)
          .single();

        if (error || !data) {
          // No session found, register this device
          await registerDeviceSession(userId);
          return;
        }

        // Single device check
        if (data.session_token !== currentToken) {
          handleSignOut('Logged in from another device');
          return;
        }

        // Cross-tab / Server-side timeout check
        if (data.last_active_at) {
          const lastActive = new Date(data.last_active_at).getTime();
          const now = Date.now();
          if (now - lastActive > timeoutMs) {
            handleSignOut('Session expired due to inactivity across tabs');
            return;
          }
        }
      } finally {
        isCheckingRef.current = false;
      }
    };

    verifySession();

    // Start single-session realtime subscription
    const subscription = supabase.channel('unique_device_session')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_sessions', filter: `user_id=eq.${userId}` },
        (payload) => {
          const newSessionToken = payload.new.session_token;
          if (newSessionToken && newSessionToken !== currentToken) {
            handleSignOut('Logged in from another device immediately');
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_sessions', filter: `user_id=eq.${userId}` },
        (payload) => {
          const newSessionToken = payload.new.session_token;
          if (newSessionToken && newSessionToken !== currentToken) {
            handleSignOut('Logged in from another device immediately');
          }
        }
      )
      .subscribe();

    // Start client idle timers
    resetIdleTimer();
    heartbeatRef.current = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    const handleActivity = () => {
      resetIdleTimer();
    };

    events.forEach(event => window.addEventListener(event, handleActivity));

    return () => {
      clearTimers();
      subscription.unsubscribe();
      events.forEach(event => window.removeEventListener(event, handleActivity));
    };
  }, [session, timeoutMs]);
}
