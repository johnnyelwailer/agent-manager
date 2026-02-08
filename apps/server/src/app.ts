import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createSessionRoutes } from './routes/sessions.js';
import { createAdapterRoutes } from './routes/adapters.js';
import type { SessionManager } from './core/session-manager.js';

export function createApp(manager: SessionManager) {
  const app = new Hono();

  app.use('*', cors());

  app.route('/api/sessions', createSessionRoutes(manager));
  app.route('/api/adapters', createAdapterRoutes(manager));

  return app;
}
