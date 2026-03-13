'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface User {
  id: number;
  name: string;
  role: string;
  avatar_color: string;
}

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id;

  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [avatarColor, setAvatarColor] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/users')
      .then((res) => res.json())
      .then((data: { users: User[] }) => {
        const found = data.users.find((u) => u.id === Number(id));
        if (found) {
          setUser(found);
          setName(found.name);
          setAvatarColor(found.avatar_color);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const body: Record<string, string> = { name, avatar_color: avatarColor };
    if (pin) body.pin = pin;

    const res = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Failed to update user');
      return;
    }

    router.push('/admin/users');
  }

  if (loading) return <div className="p-4">Loading...</div>;
  if (!user) return <div className="p-4">User not found</div>;

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">Edit {user.name}</h1>
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
          <label className="block text-sm font-medium mb-1">Avatar Color</label>
          <input
            type="color"
            value={avatarColor}
            onChange={(e) => setAvatarColor(e.target.value)}
            className="w-16 h-10"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">New PIN (leave blank to keep current)</label>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            maxLength={4}
            pattern="\d{4}"
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Save Changes
        </button>
      </form>
    </div>
  );
}
