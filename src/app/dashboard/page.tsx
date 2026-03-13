import { ChoresPanel } from '@/components/ChoresPanel';
import { AgendaPanel } from '@/components/AgendaPanel';
import { StreaksPanel } from '@/components/StreaksPanel';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DashboardFooter } from '@/components/DashboardFooter';
import { SSEProvider } from '@/components/SSEProvider';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <DashboardHeader />
      <main className="flex-1 grid grid-cols-[4fr_3fr_3fr] gap-4 p-4 overflow-hidden">
        <ChoresPanel />
        <AgendaPanel />
        <StreaksPanel />
      </main>
      <DashboardFooter />
      <SSEProvider />
      {/* SSE and auto-refresh config for TV mode */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            // TV Dashboard: connect to EventSource at /api/events/stream
            // Auto-refresh via setInterval checking for 3 AM, then location.reload()
          `,
        }}
      />
    </div>
  );
}
