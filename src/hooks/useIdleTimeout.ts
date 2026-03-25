import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const DEFAULT_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

export function useIdleTimeout(timeoutMs: number = DEFAULT_TIMEOUT) {
  const timeoutRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
  };

  const resetTimer = () => {
    clearTimer();
    timeoutRef.current = window.setTimeout(async () => {
      console.log('[Auth] Session idle timeout reached. Signing out.');
      await supabase.auth.signOut();
      // Force reload to ensure all state is cleared and user is redirected to login
      window.location.href = '/login';
    }, timeoutMs);
  };

  useEffect(() => {
    // Events to monitor for activity
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    const handleActivity = () => {
      resetTimer();
    };

    // Initialize timer
    resetTimer();

    // Add listeners
    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      clearTimer();
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [timeoutMs]);
}
