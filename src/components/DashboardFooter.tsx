export function DashboardFooter() {
  return (
    <footer className="flex items-center justify-between px-6 py-3 bg-gray-900 border-t border-gray-800">
      <div className="flex items-center gap-3">
        {/* QR Code placeholder SVG */}
        <svg
          width="64"
          height="64"
          viewBox="0 0 64 64"
          className="bg-white p-1"
          aria-label="QR Code"
        >
          <rect x="4" y="4" width="20" height="20" fill="black" />
          <rect x="8" y="8" width="12" height="12" fill="white" />
          <rect x="10" y="10" width="8" height="8" fill="black" />
          <rect x="40" y="4" width="20" height="20" fill="black" />
          <rect x="44" y="8" width="12" height="12" fill="white" />
          <rect x="46" y="10" width="8" height="8" fill="black" />
          <rect x="4" y="40" width="20" height="20" fill="black" />
          <rect x="8" y="44" width="12" height="12" fill="white" />
          <rect x="10" y="46" width="8" height="8" fill="black" />
          <rect x="28" y="4" width="8" height="4" fill="black" />
          <rect x="28" y="12" width="4" height="4" fill="black" />
          <rect x="28" y="28" width="8" height="8" fill="black" />
          <rect x="40" y="28" width="4" height="8" fill="black" />
          <rect x="48" y="40" width="4" height="8" fill="black" />
          <rect x="28" y="44" width="8" height="4" fill="black" />
          <rect x="40" y="48" width="8" height="4" fill="black" />
          <rect x="52" y="52" width="8" height="8" fill="black" />
        </svg>
        <span className="text-lg text-gray-400">Scan QR to connect</span>
      </div>
      <div className="text-xl text-gray-300">
        http://localhost:3000
      </div>
    </footer>
  );
}
