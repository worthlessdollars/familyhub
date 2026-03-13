/**
 * Unit tests: Event Bus (REQ-011)
 *
 * In-memory EventEmitter singleton with typed events.
 * Fire-and-forget — no persistence, events dropped if no listeners.
 *
 * Spec: 07-api-realtime.md
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// This import will fail until src/lib/event-bus.ts is implemented
import { eventBus } from '@/lib/event-bus';

describe('eventBus', () => {
  beforeEach(() => {
    eventBus.removeAllListeners();
  });

  // --- Core pub/sub ---

  it('emits chore:updated events to subscribers', () => {
    const handler = vi.fn();
    eventBus.on('chore:updated', handler);

    eventBus.emit('chore:updated', {
      instance_id: 42,
      status: 'done',
      completed_at: '2026-03-13T19:32:00Z',
      family_date: '2026-03-13',
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ instance_id: 42, status: 'done' })
    );
  });

  it('emits agenda:updated events to subscribers', () => {
    const handler = vi.fn();
    eventBus.on('agenda:updated', handler);

    eventBus.emit('agenda:updated', {
      action: 'created',
      item_id: 5,
      date: '2026-03-13',
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'created', item_id: 5 })
    );
  });

  it('emits streak:updated events to subscribers', () => {
    const handler = vi.fn();
    eventBus.on('streak:updated', handler);

    eventBus.emit('streak:updated', {
      user_id: 3,
      chore_id: 1,
      current_streak: 6,
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('emits day:rollover events to subscribers', () => {
    const handler = vi.fn();
    eventBus.on('day:rollover', handler);

    eventBus.emit('day:rollover', {
      new_family_date: '2026-03-14',
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ new_family_date: '2026-03-14' })
    );
  });

  // --- Multiple subscribers ---

  it('delivers events to all subscribers', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    eventBus.on('chore:updated', handler1);
    eventBus.on('chore:updated', handler2);

    eventBus.emit('chore:updated', { instance_id: 42, status: 'done' });

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('does not cross-deliver between event types', () => {
    const choreHandler = vi.fn();
    const agendaHandler = vi.fn();
    eventBus.on('chore:updated', choreHandler);
    eventBus.on('agenda:updated', agendaHandler);

    eventBus.emit('chore:updated', { instance_id: 42 });

    expect(choreHandler).toHaveBeenCalledTimes(1);
    expect(agendaHandler).not.toHaveBeenCalled();
  });

  // --- Unsubscribe ---

  it('stops delivering after unsubscribe', () => {
    const handler = vi.fn();
    eventBus.on('chore:updated', handler);
    eventBus.off('chore:updated', handler);

    eventBus.emit('chore:updated', { instance_id: 42 });

    expect(handler).not.toHaveBeenCalled();
  });

  // --- Fire and forget ---

  it('does not throw when emitting with no subscribers', () => {
    expect(() => {
      eventBus.emit('chore:updated', { instance_id: 42 });
    }).not.toThrow();
  });

  // --- Singleton ---

  it('is a singleton (same instance across imports)', async () => {
    const { eventBus: bus2 } = await import('@/lib/event-bus');
    expect(eventBus).toBe(bus2);
  });
});
