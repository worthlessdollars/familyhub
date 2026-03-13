'use client';

import { useEffect, useState, useCallback } from 'react';

interface AgendaPerson {
  id: number;
  name: string;
  avatar_color: string;
}

interface AgendaItem {
  id: number;
  title: string;
  date: string;
  time: string | null;
  person: AgendaPerson | null;
  notes: string | null;
  created_by: { id: number; name: string } | null;
}

function getTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function isPast(time: string | null): boolean {
  if (!time) return false;
  return time < getCurrentTime();
}

export function AgendaPanel() {
  const [date, setDate] = useState('');
  const [displayDate, setDisplayDate] = useState('');
  const [items, setItems] = useState<AgendaItem[]>([]);

  const fetchItems = useCallback(async (dateStr: string) => {
    try {
      const res = await fetch(`/api/agenda?date=${dateStr}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch {
      // silently fail on fetch errors
    }
  }, []);

  useEffect(() => {
    const today = getTodayDate();
    setDate(today);
    setDisplayDate(
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    );
    fetchItems(today);

    // Refresh every 60 seconds
    const interval = setInterval(() => fetchItems(today), 60000);
    return () => clearInterval(interval);
  }, [fetchItems]);

  return (
    <section className="bg-gray-900 rounded-xl p-5 overflow-y-auto">
      <h2 className="text-4xl font-bold mb-4">Agenda</h2>
      <p className="text-2xl text-gray-400 mb-4">{displayDate}</p>
      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="text-2xl text-gray-500">No agenda items for today</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 p-3 rounded-lg bg-gray-800 ${
                isPast(item.time) ? 'opacity-40' : ''
              }`}
            >
              <div className="text-xl font-mono text-gray-400 w-20 shrink-0">
                {item.time ? item.time : 'ALL DAY'}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-2xl font-semibold">{item.title}</span>
              </div>
              {item.person && (
                <div
                  className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-sm font-bold text-white"
                  style={{ backgroundColor: item.person.avatar_color }}
                  title={item.person.name}
                >
                  {item.person.name.charAt(0)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
