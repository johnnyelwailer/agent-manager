import { create } from 'zustand';
import { WsManager } from '../lib/ws.js';
import type { AgentEvent } from '@agent-manager/shared';

interface ConnectionState {
  connected: boolean;
  wsManager: WsManager | null;

  // Actions
  connect: () => void;
  disconnect: () => void;
  onEvent: (handler: (event: AgentEvent) => void) => () => void;
}

const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;

export const useConnectionStore = create<ConnectionState>((set, get) => {
  const wsManager = new WsManager(wsUrl);

  return {
    connected: false,
    wsManager,

    connect: () => {
      wsManager.connect();
      // Poll connection status
      const interval = setInterval(() => {
        set({ connected: wsManager.connected });
      }, 1000);
      // Store interval for cleanup (simplified)
      set({ connected: wsManager.connected });
      // Clean up on disconnect
      const origDisconnect = get().disconnect;
      set({
        disconnect: () => {
          clearInterval(interval);
          wsManager.disconnect();
          set({ connected: false });
        },
      });
    },

    disconnect: () => {
      wsManager.disconnect();
      set({ connected: false });
    },

    onEvent: (handler) => wsManager.subscribe(handler),
  };
});
