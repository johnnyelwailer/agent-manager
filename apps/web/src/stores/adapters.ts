import { create } from 'zustand';
import type { AdapterManifest } from '@agent-manager/shared';

interface AdapterInfo extends AdapterManifest {
  available: boolean;
}

interface AdaptersState {
  adapters: AdapterInfo[];
  loading: boolean;

  // Actions
  fetchAdapters: () => Promise<void>;
}

export const useAdaptersStore = create<AdaptersState>((set) => ({
  adapters: [],
  loading: false,

  fetchAdapters: async () => {
    set({ loading: true });
    try {
      const res = await fetch('/api/adapters');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const manifests: AdapterManifest[] = await res.json();

      // Check availability for each adapter
      const adapters = await Promise.all(
        manifests.map(async (m) => {
          try {
            const avRes = await fetch(`/api/adapters/${m.id}/available`);
            const { available } = await avRes.json();
            return { ...m, available: available as boolean };
          } catch {
            return { ...m, available: false };
          }
        }),
      );
      set({ adapters, loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));
