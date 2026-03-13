import { eventBus, type EventMap } from '@/lib/event-bus';

const EVENT_TYPES: (keyof EventMap)[] = [
  'chore:updated',
  'agenda:updated',
  'streak:updated',
  'day:rollover',
];

export const dynamic = 'force-dynamic';

export function GET(request: Request): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send an initial comment to flush headers immediately
      controller.enqueue(encoder.encode(':ok\n\n'));

      const listeners = new Map<keyof EventMap, (payload: Record<string, unknown>) => void>();

      for (const eventType of EVENT_TYPES) {
        const handler = (payload: Record<string, unknown>) => {
          const message = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
          try {
            controller.enqueue(encoder.encode(message));
          } catch {
            // Stream already closed — clean up listeners
            cleanup();
          }
        };
        listeners.set(eventType, handler);
        eventBus.on(eventType, handler);
      }

      function cleanup() {
        for (const [eventType, handler] of listeners) {
          eventBus.off(eventType, handler);
        }
        listeners.clear();
      }

      // Clean up when the client disconnects
      request.signal.addEventListener('abort', () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // Stream may already be closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
