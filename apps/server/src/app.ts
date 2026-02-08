import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createSessionRoutes } from './routes/sessions.js';
import { createAdapterRoutes } from './routes/adapters.js';
import type { SessionManager } from './core/session-manager.js';

export function createApp(manager: SessionManager) {
  const app = new Hono()
    .use('*', cors())
    .route('/api/sessions', createSessionRoutes(manager))
    .route('/api/adapters', createAdapterRoutes(manager));

  return app;
}

export type AppType = ReturnType<typeof createApp>;
