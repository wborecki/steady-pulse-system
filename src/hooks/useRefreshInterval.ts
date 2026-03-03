import { useNotificationSettings } from './useNotificationSettings';
import { useRealtimeConnected } from './useRealtimeStatus';

const DEFAULT_INTERVAL = 30000;

/**
 * Returns the global dashboard refresh interval (in ms) from notification_settings.
 * When Realtime is connected, polling is disabled (returns `false`) to avoid duplicates.
 * Returns `false` when auto_refresh is disabled.
 * Falls back to DEFAULT_INTERVAL (30s) while settings are loading.
 */
export function useRefreshInterval(fallback = DEFAULT_INTERVAL): number | false {
  const { data: settings } = useNotificationSettings();
  const realtimeConnected = useRealtimeConnected();

  // When Realtime is pushing updates, disable polling to avoid duplicate requests
  if (realtimeConnected) return false;

  if (!settings) return fallback;
  if (!settings.auto_refresh) return false;

  return settings.check_interval_seconds * 1000;
}
