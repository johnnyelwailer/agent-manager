// Server entry point. Combines the REST API and WebSocket transport into a
// single HTTP server that the UI connects to.

import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import { SessionManager } from '../core/session-manager.ts';
import { ApiHandler } from './api.ts';
import { WsTransport } from './ws.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ServerOptions {
  /** The session manager to expose (if omitted, a new one is created) */
  manager?: SessionManager;
  /** Port to listen on (default: 3000) */
  port?: number;
  /** Host to bind to (default: "127.0.0.1") */
  host?: string;
  /** WebSocket path (default: "/ws") */
  wsPath?: string;
}

export interface AgentServer {
  /** The HTTP server */
  http: HttpServer;
  /** The WebSocket transport */
  ws: WsTransport;
  /** The REST API handler */
  api: ApiHandler;
  /** The session manager */
  manager: SessionManager;
  /** The port the server is listening on */
  port: number;
  /** Shut down the server */
  close(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

/**
 * Create and start the agent manager server.
 *
 * Returns an `AgentServer` handle with the HTTP server, WS transport,
 * API handler, and session manager — plus a `close()` method.
 */
export async function createServer(options: ServerOptions = {}): Promise<AgentServer> {
  const manager = options.manager ?? new SessionManager();
  const port = options.port ?? 3000;
  const host = options.host ?? '127.0.0.1';
  const wsPath = options.wsPath ?? '/ws';

  // Create HTTP server
  const api = new ApiHandler(manager);
  const http = createHttpServer(async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    // Try REST API routes
    const handled = await api.handle(req, res);
    if (!handled) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });

  // Attach WebSocket transport
  const ws = new WsTransport({
    server: http,
    bus: manager.bus,
    path: wsPath,
  });

  // Start listening
  await new Promise<void>((resolve) => {
    http.listen(port, host, () => resolve());
  });

  const address = http.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;

  return {
    http,
    ws,
    api,
    manager,
    port: actualPort,
    async close() {
      ws.close();
      manager.terminateAll();
      await new Promise<void>((resolve, reject) => {
        http.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}
