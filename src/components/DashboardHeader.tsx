'use client';

import { useState, useEffect } from 'react';

export function DashboardHeader() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800">
      <h1 className="text-4xl font-bold tracking-wide">FAMILY HUB</h1>
      <div className="text-2xl text-gray-300">
        {dateStr} &middot; {timeStr}
      </div>
    </header>
  );
}
