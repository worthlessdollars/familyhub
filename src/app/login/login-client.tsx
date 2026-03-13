'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  name: string;
  role: string;
  avatar_color: string;
}

export default function LoginClient({ users }: { users: User[] }) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handlePinDigit = async (digit: string) => {
    const newPin = pin + digit;
    setPin(newPin);
    setError('');

    if (newPin.length === 4) {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: selectedUser!.id,
            pin: newPin,
          }),
        });

        if (res.ok) {
          router.push('/my');
        } else {
          const data = await res.json();
          setError(data.error || 'Invalid PIN');
          setPin('');
        }
      } catch {
        setError('Something went wrong');
        setPin('');
      }
    }
  };

  const handleBack = () => {
    setSelectedUser(null);
    setPin('');
    setError('');
  };

  if (!selectedUser) {
    return (
      <div className="w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4 text-center">Who are you?</h2>
        <div className="grid grid-cols-2 gap-4">
          {users.map((user) => (
            <button
              key={user.id}
              onClick={() => setSelectedUser(user)}
              className="flex flex-col items-center p-4 rounded-xl border-2 border-gray-200 hover:border-blue-400 transition-colors"
            >
              <div
                className="w-16 h-16 rounded-full mb-2 flex items-center justify-center text-white text-xl font-bold"
                style={{ backgroundColor: user.avatar_color }}
              >
                {user.name[0]}
              </div>
              <span className="font-medium">{user.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xs">
      <button onClick={handleBack} className="mb-4 text-blue-500 hover:underline">
        &larr; Back
      </button>
      <div className="text-center mb-6">
        <div
          className="w-20 h-20 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-2xl font-bold"
          style={{ backgroundColor: selectedUser.avatar_color }}
        >
          {selectedUser.name[0]}
        </div>
        <h2 className="text-lg font-semibold">{selectedUser.name}</h2>
        <p className="text-gray-500 text-sm">Enter your PIN</p>
      </div>

      {/* PIN dots */}
      <div className="flex justify-center gap-3 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full ${
              i < pin.length ? 'bg-blue-500' : 'bg-gray-300'
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="text-red-500 text-center text-sm mb-4">{error}</p>
      )}

      {/* PIN pad */}
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', ''].map(
          (digit, idx) =>
            digit ? (
              <button
                key={idx}
                onClick={() => handlePinDigit(digit)}
                className="h-14 w-14 mx-auto rounded-full bg-gray-200 hover:bg-gray-300 text-xl font-semibold flex items-center justify-center"
                style={{ minWidth: '48px', minHeight: '48px' }}
              >
                {digit}
              </button>
            ) : (
              <div key={idx} />
            )
        )}
      </div>
    </div>
  );
}
