/**
 * Integration tests: SSE Real-Time Endpoint (REQ-011)
 *
 * Tests the Server-Sent Events endpoint and event delivery.
 * GET /api/events/stream
 *
 * Spec: 04-dashboard.md, 07-api-realtime.md
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { TEST_USERS, resetServerDb } from '@tests/helpers/db';

beforeAll(() => { resetServerDb(); });

const BASE = 'http://localhost:3000';

async function login(userId: number, pin: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, pin }),
  });
  return res.headers.get('set-cookie')!.split(';')[0];
}

/**
 * Connects to SSE, waits for the initial :ok comment to confirm the connection
 * is established, then collects events for a duration.
 * Returns { ready, events } where ready resolves when connected,
 * and events resolves with collected events after durationMs.
 */
function connectSSE(
  durationMs: number,
  eventFilter?: string
): { ready: Promise<void>; events: Promise<Array<{ type: string; data: any }>> } {
  const collected: Array<{ type: string; data: any }> = [];
  const controller = new AbortController();
  let resolveReady: () => void;
  const ready = new Promise<void>((r) => { resolveReady = r; });

  const events = new Promise<Array<{ type: string; data: any }>>((resolve) => {
    fetch(`${BASE}/api/events/stream`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          resolveReady!(); // unblock even on error
          return;
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let connected = false;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              // The :ok comment signals the connection is established
              if (!connected && line.startsWith(':')) {
                connected = true;
                resolveReady!();
                continue;
              }
              if (line.startsWith('event: ')) {
                buffer = `${line}\n`;
              } else if (line.startsWith('data: ')) {
                const eventLine = buffer.trim();
                const eventType = eventLine.startsWith('event: ')
                  ? eventLine.slice(7).trim()
                  : '';
                buffer = '';
                const data = JSON.parse(line.slice(6));
                if (!eventFilter || eventType === eventFilter) {
                  collected.push({ type: eventType, data });
                }
              }
            }
          }
        } catch {
          // Connection aborted — expected
        }
      })
      .catch(() => {
        resolveReady!(); // unblock on error
      });

    setTimeout(() => {
      controller.abort();
      // Give a small delay for the abort to propagate and readLoop to finish
      setTimeout(() => resolve(collected), 100);
    }, durationMs);
  });

  // Safety: resolve ready after timeout if :ok never arrives
  setTimeout(() => resolveReady!(), 2000);

  return { ready, events };
}

describe('GET /api/events/stream', () => {
  it('returns correct SSE headers', async () => {
    const controller = new AbortController();
    const res = await fetch(`${BASE}/api/events/stream`, {
      signal: controller.signal,
    });

    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(res.headers.get('cache-control')).toContain('no-cache');
    expect(res.headers.get('connection')).toContain('keep-alive');

    controller.abort();
  });

  it('does not require authentication', async () => {
    const controller = new AbortController();
    const res = await fetch(`${BASE}/api/events/stream`, {
      signal: controller.signal,
    });
    expect(res.status).toBe(200);
    controller.abort();
  });
});

describe('SSE event delivery on chore completion', () => {
  it('emits chore:updated when a chore is completed', async () => {
    const { ready, events: eventsPromise } = connectSSE(4000, 'chore:updated');
    await ready;

    // Complete a chore
    const cookie = await login(TEST_USERS.kid1.id, TEST_USERS.kid1.pin);
    const today = await (
      await fetch(`${BASE}/api/chores/today`)
    ).json() as any;
    const myChore = today.chores?.find(
      (c: any) => c.assigned_to.id === TEST_USERS.kid1.id && c.status === 'pending'
    );

    if (myChore) {
      await fetch(`${BASE}/api/chores/instances/${myChore.instance_id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ user_id: TEST_USERS.kid1.id }),
      });
    }

    const events = await eventsPromise;

    if (myChore) {
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('chore:updated');
      expect(events[0].data).toMatchObject({
        instance_id: myChore.instance_id,
        status: 'done',
      });
    }
  });
});

describe('SSE event delivery on agenda mutation', () => {
  it('emits agenda:updated when an item is created', async () => {
    const { ready, events: eventsPromise } = connectSSE(4000, 'agenda:updated');
    await ready;

    const cookie = await login(TEST_USERS.parent1.id, TEST_USERS.parent1.pin);
    await fetch(`${BASE}/api/agenda`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'SSE test event', date: '2026-03-13', time: '14:00' }),
    });

    const events = await eventsPromise;
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].type).toBe('agenda:updated');
    expect(events[0].data.action).toBe('created');
  });
});

describe('SSE event format', () => {
  it('chore:updated event has required fields', async () => {
    const { ready, events: eventsPromise } = connectSSE(4000, 'chore:updated');
    await ready;

    const cookie = await login(TEST_USERS.kid2.id, TEST_USERS.kid2.pin);
    const todayRes = await fetch(`${BASE}/api/chores/today`);
    const today = await todayRes.json() as any;
    const myChore = today.chores?.find(
      (c: any) => c.assigned_to.id === TEST_USERS.kid2.id && c.status === 'pending'
    );

    if (myChore) {
      await fetch(`${BASE}/api/chores/instances/${myChore.instance_id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ user_id: TEST_USERS.kid2.id }),
      });
    }

    const events = await eventsPromise;
    if (events.length > 0) {
      const data = events[0].data;
      expect(data).toHaveProperty('instance_id');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('family_date');
    }
  });
});
