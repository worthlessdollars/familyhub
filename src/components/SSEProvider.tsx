'use client';

import { useEffect } from 'react';

export function SSEProvider() {
  useEffect(() => {
    // Connect to SSE endpoint for real-time updates
    const source = new EventSource('/api/events/stream');

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'chore-completed' || data.type === 'chore-update' || data.type === 'chore_update') {
          window.dispatchEvent(new CustomEvent('sse:chore-update'));
        }
        if (data.type === 'streak-update' || data.type === 'streak_update') {
          window.dispatchEvent(new CustomEvent('sse:streak-update'));
        }
      } catch {
        // ignore parse errors
      }
    };

    source.onerror = () => {
      // EventSource will auto-reconnect
    };

    // 3 AM auto-refresh: check every 60 seconds
    const refreshInterval = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 3 && now.getMinutes() < 5) {
        location.reload();
      }
    }, 60_000);

    return () => {
      source.close();
      clearInterval(refreshInterval);
    };
  }, []);

  return null;
}
