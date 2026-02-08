import { SessionManager } from './core/session-manager.js';
import { ClaudeCliAdapter } from './adapters/claude-cli.js';
import { createApp } from './app.js';
import { WsHandler, type WsClientState } from './routes/ws.js';

const port = parseInt(process.env.PORT ?? '3000', 10);
const host = process.env.HOST ?? '127.0.0.1';

const manager = new SessionManager();
manager.registerAdapter(new ClaudeCliAdapter());

const app = createApp(manager);
const wsHandler = new WsHandler(manager.bus);

const server = Bun.serve({
  port,
  hostname: host,
  fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      const upgraded = server.upgrade(req, { data: {} });
      if (upgraded) return undefined;
      return new Response('WebSocket upgrade failed', { status: 400 });
    }
    return app.fetch(req, { ip: server.requestIP(req) });
  },
  websocket: {
    open(ws) {
      wsHandler.onOpen(ws);
    },
    message(ws, message) {
      wsHandler.onMessage(ws, message);
    },
    close(ws) {
      wsHandler.onClose(ws);
    },
  },
});

console.log(`Agent Manager server listening on http://${host}:${server.port}`);
console.log(`WebSocket available at ws://${host}:${server.port}/ws`);
