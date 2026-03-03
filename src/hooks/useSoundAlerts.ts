import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotificationSettings } from './useNotificationSettings';

/**
 * Plays a short notification beep using the Web Audio API
 * when new alerts arrive and sound_alerts is enabled in settings.
 */
function playAlertBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    // Two-tone alert beep
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);         // A5
    osc.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.12); // C6
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);

    osc.onended = () => ctx.close();
  } catch {
    // Silently ignore — browser may block AudioContext before user interaction
  }
}

export function useSoundAlerts() {
  const { data: settings } = useNotificationSettings();
  const qc = useQueryClient();
  const prevCountRef = useRef<number | null>(null);

  useEffect(() => {
    if (!settings?.sound_alerts) return;

    const unsubscribe = qc.getQueryCache().subscribe((event) => {
      if (
        event.type === 'updated' &&
        event.action.type === 'success' &&
        event.query.queryKey[0] === 'alerts'
      ) {
        const result = event.query.state.data as { data?: { acknowledged: boolean }[]; count?: number } | undefined;
        if (!result?.data) return;

        const unackCount = result.data.filter(a => !a.acknowledged).length;

        if (prevCountRef.current !== null && unackCount > prevCountRef.current) {
          playAlertBeep();
        }
        prevCountRef.current = unackCount;
      }
    });

    return () => unsubscribe();
  }, [settings?.sound_alerts, qc]);
}
