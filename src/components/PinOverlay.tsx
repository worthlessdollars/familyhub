'use client';

import { useState, useEffect, useCallback } from 'react';

interface User {
  id: number;
  name: string;
  avatar_color: string;
  role: string;
}

interface PinOverlayProps {
  choreInstanceId: number;
  onSuccess: () => void;
  onClose: () => void;
}

export function PinOverlay({ choreInstanceId, onSuccess, onClose }: PinOverlayProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const submit = useCallback(
    async (fullPin: string) => {
      if (!selectedUser) return;
      setLoading(true);
      setError('');
      try {
        // First authenticate
        const authRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: selectedUser.id, pin: fullPin }),
        });
        if (!authRes.ok) {
          setError('Invalid PIN. Try again.');
          setPin('');
          setLoading(false);
          return;
        }

        // Then complete the chore
        const completeRes = await fetch(`/api/chores/instances/${choreInstanceId}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: selectedUser.id }),
        });
        if (!completeRes.ok) {
          setError('Failed to complete chore.');
          setPin('');
          setLoading(false);
          return;
        }

        onSuccess();
      } catch {
        setError('Network error. Try again.');
        setPin('');
        setLoading(false);
      }
    },
    [selectedUser, choreInstanceId, onSuccess]
  );

  const addDigit = (d: string) => {
    if (pin.length >= 4) return;
    const newPin = pin + d;
    setPin(newPin);
    setError('');
    if (newPin.length === 4) {
      submit(newPin);
    }
  };

  const backspace = () => {
    setPin((p) => p.slice(0, -1));
    setError('');
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-md">
        {!selectedUser ? (
          <>
            <h3 className="text-3xl font-bold mb-6 text-center">Who are you?</h3>
            <div className="grid grid-cols-2 gap-4">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className="flex items-center gap-3 p-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-2xl"
                >
                  <span
                    className="w-8 h-8 rounded-full inline-block"
                    style={{ backgroundColor: user.avatar_color || '#888' }}
                  />
                  {user.name}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="mt-6 w-full py-3 text-xl text-gray-400 hover:text-white"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <h3 className="text-3xl font-bold mb-2 text-center">Enter PIN</h3>
            <p className="text-xl text-gray-400 text-center mb-6">{selectedUser.name}</p>

            {/* Progress dots */}
            <div className="flex justify-center gap-3 mb-6">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-5 h-5 rounded-full ${
                    i < pin.length ? 'bg-blue-500' : 'bg-gray-700'
                  }`}
                />
              ))}
            </div>

            {error && (
              <p className="text-red-400 text-xl text-center mb-4">{error}</p>
            )}

            {/* PIN pad */}
            <div className="grid grid-cols-3 gap-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '←'].map(
                (key) =>
                  key === '' ? (
                    <div key="empty" />
                  ) : key === '←' ? (
                    <button
                      key="back"
                      onClick={backspace}
                      disabled={loading}
                      className="w-16 h-16 mx-auto flex items-center justify-center rounded-xl bg-gray-800 hover:bg-gray-700 text-2xl"
                    >
                      ←
                    </button>
                  ) : (
                    <button
                      key={key}
                      onClick={() => addDigit(key)}
                      disabled={loading || pin.length >= 4}
                      className="w-16 h-16 mx-auto flex items-center justify-center rounded-xl bg-gray-800 hover:bg-gray-700 text-2xl font-bold"
                    >
                      {key}
                    </button>
                  )
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setSelectedUser(null); setPin(''); setError(''); }}
                className="flex-1 py-3 text-xl text-gray-400 hover:text-white"
              >
                Back
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-3 text-xl text-gray-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
