import { db } from '@/db';
import { users } from '@/db/schema';
import LoginClient from './login-client';

export default function LoginPage() {
  const allUsers = db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      avatar_color: users.avatarColor,
    })
    .from(users)
    .all();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      <h1 className="text-2xl font-bold mb-8">Family Hub</h1>
      <LoginClient users={allUsers} />
    </main>
  );
}
