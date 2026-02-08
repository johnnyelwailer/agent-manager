import { Hono } from 'hono';
import type { SessionManager } from '../core/session-manager.js';

export function createAdapterRoutes(manager: SessionManager) {
  return new Hono()
    .get('/', (c) => {
      const adapterIds = manager.listAdapters();
      const adapters = adapterIds.map((id) => {
        const adapter = manager.getAdapter(id);
        return adapter ? adapter.manifest : { id };
      });
      return c.json({ adapters });
    })
    .get('/:id/available', async (c) => {
      const adapter = manager.getAdapter(c.req.param('id'));
      if (!adapter) {
        return c.json({ error: `Adapter "${c.req.param('id')}" not found` }, 404);
      }
      const error = await adapter.checkAvailability();
      return c.json({ available: error === null, error });
    });
}
