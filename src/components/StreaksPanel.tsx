'use client';

import { useState, useEffect, useCallback } from 'react';

interface Streak {
  id: number;
  user_id: number;
  chore_id: number;
  current_streak: number;
  longest_streak: number;
  user_name: string;
  chore_name: string;
}

export function StreaksPanel() {
  const [streaks, setStreaks] = useState<Streak[]>([]);

  const fetchStreaks = useCallback(async () => {
    try {
      const res = await fetch('/api/streaks');
      if (res.ok) {
        const data = await res.json();
        setStreaks(Array.isArray(data) ? data : []);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchStreaks();
  }, [fetchStreaks]);

  useEffect(() => {
    const handler = () => fetchStreaks();
    window.addEventListener('sse:streak-update', handler);
    return () => window.removeEventListener('sse:streak-update', handler);
  }, [fetchStreaks]);

  const hotStreaks = streaks
    .filter((s) => s.current_streak >= 3)
    .sort((a, b) => b.current_streak - a.current_streak);

  return (
    <section className="bg-gray-900 rounded-xl p-5 overflow-y-auto">
      <h2 className="text-4xl font-bold mb-4">Streaks</h2>
      {hotStreaks.length === 0 ? (
        <div className="text-2xl text-gray-500">
          <p>No hot streaks yet!</p>
          <p className="mt-2 text-xl text-gray-600">
            Complete the same chore 3 days in a row to start a streak.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {hotStreaks.map((streak) => (
            <li
              key={streak.id}
              className="flex items-center justify-between bg-gray-800 rounded-lg p-4"
            >
              <div>
                <span className="text-2xl font-semibold">{streak.chore_name}</span>
                <span className="text-xl text-gray-400 ml-3">{streak.user_name}</span>
              </div>
              <div className="text-3xl">
                🔥 {streak.current_streak} days
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
