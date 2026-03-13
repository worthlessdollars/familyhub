'use client';

import { useState, useEffect, useCallback } from 'react';
import { PinOverlay } from './PinOverlay';

interface ChoreUser {
  id: number;
  name: string;
  avatar_color: string;
}

interface ChoreInstance {
  id: number;
  chore_id: number;
  chore_name?: string;
  name?: string;
  assigned_to: number | null;
  assigned_user: ChoreUser | null;
  status: string;
  due_time?: string;
  family_date?: string;
}

export function ChoresPanel() {
  const [chores, setChores] = useState<ChoreInstance[]>([]);
  const [familyDate, setFamilyDate] = useState('');
  const [selectedChore, setSelectedChore] = useState<ChoreInstance | null>(null);

  const fetchChores = useCallback(async () => {
    try {
      const res = await fetch('/api/chores/today');
      if (res.ok) {
        const data = await res.json();
        setFamilyDate(data.family_date || '');
        setChores(data.instances || data.chores || []);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchChores();
  }, [fetchChores]);

  // Listen for custom refetch events from SSE
  useEffect(() => {
    const handler = () => fetchChores();
    window.addEventListener('sse:chore-update', handler);
    return () => window.removeEventListener('sse:chore-update', handler);
  }, [fetchChores]);

  const sortedChores = [...chores].sort((a, b) => {
    const order: Record<string, number> = { overdue: 0, pending: 1, done: 2, skipped: 3 };
    return (order[a.status] ?? 1) - (order[b.status] ?? 1);
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case 'done':
        return <span className="inline-flex items-center px-2 py-1 rounded bg-green-700 text-green-100 text-lg">&#10003; Done</span>;
      case 'overdue':
        return <span className="inline-flex items-center px-2 py-1 rounded bg-amber-700 text-amber-100 text-lg">Overdue</span>;
      case 'skipped':
        return <span className="inline-flex items-center px-2 py-1 rounded bg-gray-700 text-gray-400 text-lg">Skipped</span>;
      default:
        return <span className="inline-flex items-center px-2 py-1 rounded bg-gray-700 text-gray-200 text-lg">Pending</span>;
    }
  };

  const handleDone = (chore: ChoreInstance) => {
    setSelectedChore(chore);
  };

  const handlePinSuccess = () => {
    setSelectedChore(null);
    fetchChores();
  };

  return (
    <section className="bg-gray-900 rounded-xl p-5 overflow-y-auto">
      <h2 className="text-4xl font-bold mb-4">Chores</h2>
      {familyDate && <p className="text-xl text-gray-400 mb-4">{familyDate}</p>}
      {sortedChores.length === 0 ? (
        <p className="text-2xl text-gray-500">No chores for today</p>
      ) : (
        <ul className="space-y-3">
          {sortedChores.map((chore) => (
            <li
              key={chore.id}
              className="flex items-center justify-between bg-gray-800 rounded-lg p-4"
            >
              <div className="flex items-center gap-3">
                {chore.assigned_user && (
                  <span
                    className="w-5 h-5 rounded-full inline-block"
                    style={{ backgroundColor: chore.assigned_user.avatar_color || '#888' }}
                  />
                )}
                <div>
                  <span className="text-2xl font-semibold">
                    {chore.name || chore.chore_name || `Chore #${chore.chore_id}`}
                  </span>
                  {chore.assigned_user && (
                    <span className="text-xl text-gray-400 ml-3">{chore.assigned_user.name}</span>
                  )}
                  {chore.due_time && (
                    <span className="text-lg text-gray-500 ml-3">{chore.due_time}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {statusBadge(chore.status)}
                {(chore.status === 'pending' || chore.status === 'overdue') && (
                  <button
                    onClick={() => handleDone(chore)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xl rounded-lg"
                  >
                    Mark Done
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {selectedChore && (
        <PinOverlay
          choreInstanceId={selectedChore.id}
          onSuccess={handlePinSuccess}
          onClose={() => setSelectedChore(null)}
        />
      )}
    </section>
  );
}
