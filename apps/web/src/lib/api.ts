import { hc } from 'hono/client';
import type { AppType } from '@agent-manager/server/src/app.js';

// Typed Hono RPC client — provides autocomplete for all server routes
export const api = hc<AppType>('/');
