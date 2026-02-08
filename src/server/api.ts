// REST API handler. Provides HTTP endpoints for session and adapter management.
//
// Routes:
//   GET  /api/adapters                — list registered adapters
//   GET  /api/adapters/:id/available  — check if an adapter is available
//   GET  /api/sessions                — list all sessions
//   GET  /api/sessions/:id            — get a specific session
//   POST /api/sessions                — start a new session
//   POST /api/sessions/:id/interrupt  — interrupt a session
//   POST /api/sessions/:id/terminate  — terminate a session
//   POST /api/sessions/:id/kill       — kill a session

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { SessionManager } from '../core/session-manager.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StartSessionBody {
  adapterId: string;
  prompt: string;
  cwd: string;
  model?: string;
  maxBudgetUsd?: number;
  allowedTools?: string[];
  disallowedTools?: string[];
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
  resumeSessionId?: string;
}

type Route = {
  method: string;
  pattern: RegExp;
  handler: (req: IncomingMessage, res: ServerResponse, match: RegExpExecArray) => Promise<void>;
};

// ---------------------------------------------------------------------------
// API handler
// ---------------------------------------------------------------------------

export class ApiHandler {
  private manager: SessionManager;
  private routes: Route[];

  constructor(manager: SessionManager) {
    this.manager = manager;
    this.routes = [
      { method: 'GET', pattern: /^\/api\/adapters$/, handler: this.listAdapters.bind(this) },
      { method: 'GET', pattern: /^\/api\/adapters\/([^/]+)\/available$/, handler: this.checkAdapter.bind(this) },
      { method: 'GET', pattern: /^\/api\/sessions$/, handler: this.listSessions.bind(this) },
      { method: 'GET', pattern: /^\/api\/sessions\/([^/]+)$/, handler: this.getSession.bind(this) },
      { method: 'POST', pattern: /^\/api\/sessions$/, handler: this.startSession.bind(this) },
      { method: 'POST', pattern: /^\/api\/sessions\/([^/]+)\/interrupt$/, handler: this.interruptSession.bind(this) },
      { method: 'POST', pattern: /^\/api\/sessions\/([^/]+)\/terminate$/, handler: this.terminateSession.bind(this) },
      { method: 'POST', pattern: /^\/api\/sessions\/([^/]+)\/kill$/, handler: this.killSession.bind(this) },
    ];
  }

  /** Handle an incoming HTTP request. Returns true if a route matched. */
  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const method = req.method ?? 'GET';
    const url = req.url ?? '/';

    // Strip query string
    const path = url.split('?')[0];

    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = route.pattern.exec(path);
      if (match) {
        try {
          await route.handler(req, res, match);
        } catch (err) {
          this.json(res, 500, {
            error: err instanceof Error ? err.message : 'Internal server error',
          });
        }
        return true;
      }
    }

    return false;
  }

  // -------------------------------------------------------------------------
  // Route handlers
  // -------------------------------------------------------------------------

  private async listAdapters(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    const adapterIds = this.manager.listAdapters();
    const adapters = adapterIds.map((id) => {
      const adapter = this.manager.getAdapter(id);
      return adapter ? adapter.manifest : { id };
    });
    this.json(res, 200, { adapters });
  }

  private async checkAdapter(_req: IncomingMessage, res: ServerResponse, match: RegExpExecArray): Promise<void> {
    const adapterId = decodeURIComponent(match[1]);
    const adapter = this.manager.getAdapter(adapterId);
    if (!adapter) {
      this.json(res, 404, { error: `Adapter "${adapterId}" not found` });
      return;
    }
    const error = await adapter.checkAvailability();
    this.json(res, 200, { available: error === null, error });
  }

  private async listSessions(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    const sessions = this.manager.listSessions().map((s) => ({
      ...s,
      events: undefined,  // omit events from list view (too large)
      eventCount: s.events.length,
    }));
    this.json(res, 200, { sessions });
  }

  private async getSession(_req: IncomingMessage, res: ServerResponse, match: RegExpExecArray): Promise<void> {
    const sessionId = decodeURIComponent(match[1]);
    const session = this.manager.getSession(sessionId);
    if (!session) {
      this.json(res, 404, { error: `Session "${sessionId}" not found` });
      return;
    }
    this.json(res, 200, { session });
  }

  private async startSession(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await this.readBody<StartSessionBody>(req);
    if (!body) {
      this.json(res, 400, { error: 'Request body is required' });
      return;
    }
    if (!body.adapterId || !body.prompt || !body.cwd) {
      this.json(res, 400, { error: 'adapterId, prompt, and cwd are required' });
      return;
    }

    const session = await this.manager.startSession(body.adapterId, {
      prompt: body.prompt,
      cwd: body.cwd,
      model: body.model,
      maxBudgetUsd: body.maxBudgetUsd,
      allowedTools: body.allowedTools,
      disallowedTools: body.disallowedTools,
      permissionMode: body.permissionMode,
      resumeSessionId: body.resumeSessionId,
    });

    this.json(res, 201, { session: { ...session, events: undefined, eventCount: 0 } });
  }

  private async interruptSession(_req: IncomingMessage, res: ServerResponse, match: RegExpExecArray): Promise<void> {
    const sessionId = decodeURIComponent(match[1]);
    const ok = this.manager.interruptSession(sessionId);
    if (!ok) {
      this.json(res, 404, { error: `Session "${sessionId}" not found or not running` });
      return;
    }
    this.json(res, 200, { ok: true });
  }

  private async terminateSession(_req: IncomingMessage, res: ServerResponse, match: RegExpExecArray): Promise<void> {
    const sessionId = decodeURIComponent(match[1]);
    const ok = this.manager.terminateSession(sessionId);
    if (!ok) {
      this.json(res, 404, { error: `Session "${sessionId}" not found or not running` });
      return;
    }
    this.json(res, 200, { ok: true });
  }

  private async killSession(_req: IncomingMessage, res: ServerResponse, match: RegExpExecArray): Promise<void> {
    const sessionId = decodeURIComponent(match[1]);
    const ok = this.manager.killSession(sessionId);
    if (!ok) {
      this.json(res, 404, { error: `Session "${sessionId}" not found or not running` });
      return;
    }
    this.json(res, 200, { ok: true });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private json(res: ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end(JSON.stringify(data));
  }

  private readBody<T>(req: IncomingMessage): Promise<T | null> {
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8');
        if (!raw) {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(raw) as T);
        } catch {
          resolve(null);
        }
      });
      req.on('error', () => resolve(null));
    });
  }
}
