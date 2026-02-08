import { describe, it, expect } from 'bun:test';
import { EventBus } from '../../src/core/event-bus.js';
import type { AgentEvent } from '@agent-manager/shared';

function makeEvent(overrides: Partial<AgentEvent> = {}): AgentEvent {
  return {
    id: '1',
    sessionId: 'test-session',
    timestamp: new Date().toISOString(),
    type: 'text_delta',
    text: 'hello',
    ...overrides,
  } as AgentEvent;
}

describe('EventBus', () => {
  it('delivers events to global handlers', () => {
    const bus = new EventBus();
    const received: AgentEvent[] = [];
    bus.onAll((event) => received.push(event));

    const event = makeEvent();
    bus.emit(event);

    expect(received).toHaveLength(1);
    expect(received[0]).toBe(event);
  });

  it('delivers events to session-specific handlers', () => {
    const bus = new EventBus();
    const received: AgentEvent[] = [];
    bus.on('test-session', (event) => received.push(event));

    bus.emit(makeEvent({ sessionId: 'test-session' }));
    bus.emit(makeEvent({ sessionId: 'other-session' }));

    expect(received).toHaveLength(1);
    expect(received[0]!.sessionId).toBe('test-session');
  });

  it('delivers to both global and session handlers', () => {
    const bus = new EventBus();
    const globalEvents: AgentEvent[] = [];
    const sessionEvents: AgentEvent[] = [];

    bus.onAll((event) => globalEvents.push(event));
    bus.on('test-session', (event) => sessionEvents.push(event));

    bus.emit(makeEvent({ sessionId: 'test-session' }));

    expect(globalEvents).toHaveLength(1);
    expect(sessionEvents).toHaveLength(1);
  });

  it('unsubscribes global handlers', () => {
    const bus = new EventBus();
    const received: AgentEvent[] = [];
    const unsub = bus.onAll((event) => received.push(event));

    bus.emit(makeEvent());
    expect(received).toHaveLength(1);

    unsub();
    bus.emit(makeEvent());
    expect(received).toHaveLength(1);
  });

  it('unsubscribes session handlers', () => {
    const bus = new EventBus();
    const received: AgentEvent[] = [];
    const unsub = bus.on('test-session', (event) => received.push(event));

    bus.emit(makeEvent());
    expect(received).toHaveLength(1);

    unsub();
    bus.emit(makeEvent());
    expect(received).toHaveLength(1);
  });

  it('removeSession clears all session handlers', () => {
    const bus = new EventBus();
    const received: AgentEvent[] = [];
    bus.on('test-session', (event) => received.push(event));
    bus.on('test-session', (event) => received.push(event));

    bus.removeSession('test-session');
    bus.emit(makeEvent());
    expect(received).toHaveLength(0);
  });

  it('clear removes all handlers', () => {
    const bus = new EventBus();
    const global: AgentEvent[] = [];
    const session: AgentEvent[] = [];
    bus.onAll((event) => global.push(event));
    bus.on('test-session', (event) => session.push(event));

    bus.clear();
    bus.emit(makeEvent());
    expect(global).toHaveLength(0);
    expect(session).toHaveLength(0);
  });

  it('handler errors do not break the bus', () => {
    const bus = new EventBus();
    const received: AgentEvent[] = [];

    bus.onAll(() => { throw new Error('boom'); });
    bus.onAll((event) => received.push(event));

    bus.emit(makeEvent());
    expect(received).toHaveLength(1);
  });
});
