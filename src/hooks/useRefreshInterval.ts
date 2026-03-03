import { useNotificationSettings } from './useNotificationSettings';

const DEFAULT_INTERVAL = 30000;

/**
 * Returns the global dashboard refresh interval (in ms) from notification_settings.
 * Returns `false` when auto_refresh is disabled.
 * Falls back to DEFAULT_INTERVAL (30s) while settings are loading.
 */
export function useRefreshInterval(fallback = DEFAULT_INTERVAL): number | false {
  const { data: settings } = useNotificationSettings();

  if (!settings) return fallback;
  if (!settings.auto_refresh) return false;

  return settings.check_interval_seconds * 1000;
}
