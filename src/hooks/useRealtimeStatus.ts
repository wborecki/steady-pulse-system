import { createContext, useContext } from 'react';

/** Whether the Supabase Realtime channel is currently connected. */
export const RealtimeConnectedContext = createContext(false);

export function useRealtimeConnected() {
  return useContext(RealtimeConnectedContext);
}
