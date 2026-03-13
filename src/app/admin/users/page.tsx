'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface User {
  id: number;
  name: string;
  role: string;
  avatar_color: string;
}

export default function UsersListPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/users')
      .then((res) => res.json())
      .then((data) => {
        setUsers(data.users);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Family Members</h1>
        <Link
          href="/admin/users/new"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Add Member
        </Link>
      </div>
      <ul className="space-y-3">
        {users.map((user) => (
          <li key={user.id}>
            <Link
              href={`/admin/users/${user.id}`}
              className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50"
            >
              <div
                className="w-10 h-10 rounded-full"
                style={{ backgroundColor: user.avatar_color }}
              />
              <div>
                <div className="font-medium">{user.name}</div>
                <div className="text-sm text-gray-500 capitalize">{user.role}</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
