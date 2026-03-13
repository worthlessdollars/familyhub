export default function MyPage() {
  return (
    <main className="min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-6">My Dashboard</h1>
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">My Chores Today</h2>
        <p className="text-gray-500">Loading chores...</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold mb-2">My Streaks</h2>
        <p className="text-gray-500">Loading streaks...</p>
      </section>
    </main>
  );
}
