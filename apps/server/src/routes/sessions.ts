import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { startSessionBodySchema } from '@agent-manager/shared';
import type { SessionManager } from '../core/session-manager.js';

export function createSessionRoutes(manager: SessionManager) {
  const app = new Hono();

  app.get('/', (c) => {
    const sessions = manager.listSessions().map((s) => ({
      sessionId: s.sessionId,
      adapterId: s.adapterId,
      prompt: s.prompt,
      cwd: s.cwd,
      model: s.model,
      status: s.status,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      costUsd: s.costUsd,
      tokensIn: s.tokensIn,
      tokensOut: s.tokensOut,
      eventCount: s.events.length,
    }));
    return c.json({ sessions });
  });

  app.get('/:id', (c) => {
    const session = manager.getSession(c.req.param('id'));
    if (!session) {
      return c.json({ error: `Session "${c.req.param('id')}" not found` }, 404);
    }
    return c.json({ session });
  });

  app.post(
    '/',
    zValidator('json', startSessionBodySchema),
    async (c) => {
      const body = c.req.valid('json');
      try {
        const session = await manager.startSession(body.adapterId, {
          prompt: body.prompt,
          cwd: body.cwd,
          model: body.model,
          maxBudgetUsd: body.maxBudgetUsd,
          allowedTools: body.allowedTools,
          disallowedTools: body.disallowedTools,
          permissionMode: body.permissionMode,
          resumeSessionId: body.resumeSessionId,
        });
        return c.json({
          session: {
            sessionId: session.sessionId,
            adapterId: session.adapterId,
            prompt: session.prompt,
            cwd: session.cwd,
            model: session.model,
            status: session.status,
            startedAt: session.startedAt,
            costUsd: session.costUsd,
            tokensIn: session.tokensIn,
            tokensOut: session.tokensOut,
            eventCount: 0,
          },
        }, 201);
      } catch (err) {
        return c.json({ error: err instanceof Error ? err.message : 'Failed to start session' }, 500);
      }
    },
  );

  app.post('/:id/interrupt', (c) => {
    const ok = manager.interruptSession(c.req.param('id'));
    if (!ok) {
      return c.json({ error: `Session "${c.req.param('id')}" not found or not running` }, 404);
    }
    return c.json({ ok: true });
  });

  app.post('/:id/terminate', (c) => {
    const ok = manager.terminateSession(c.req.param('id'));
    if (!ok) {
      return c.json({ error: `Session "${c.req.param('id')}" not found or not running` }, 404);
    }
    return c.json({ ok: true });
  });

  app.post('/:id/kill', (c) => {
    const ok = manager.killSession(c.req.param('id'));
    if (!ok) {
      return c.json({ error: `Session "${c.req.param('id')}" not found or not running` }, 404);
    }
    return c.json({ ok: true });
  });

  return app;
}
