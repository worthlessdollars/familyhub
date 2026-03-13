'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewUserPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [role, setRole] = useState('kid');
  const [avatarColor, setAvatarColor] = useState('#3498DB');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, role, avatar_color: avatarColor, pin }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Failed to create user');
      return;
    }

    router.push('/admin/users');
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">Add Family Member</h1>
      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded px-3 py-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="kid">Kid</option>
            <option value="parent">Parent</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Avatar Color</label>
          <input
            type="color"
            value={avatarColor}
            onChange={(e) => setAvatarColor(e.target.value)}
            className="w-16 h-10"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">PIN (4 digits)</label>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            maxLength={4}
            pattern="\d{4}"
            className="w-full border rounded px-3 py-2"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Create
        </button>
      </form>
    </div>
  );
}
