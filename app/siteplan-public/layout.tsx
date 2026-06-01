import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Public Siteplan - Denah Property",
  description: "Lihat ketersediaan kavling dan progress pembangunan perumahan secara real-time.",
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8F3] text-[#243028]">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-[#D6DED2] bg-white/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#DDE8D8] flex items-center justify-center text-[#4F6F52]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
                <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
            </div>
            <div>
              <span className="font-bold text-base tracking-wide text-[#243028] uppercase">
                Denah Property
              </span>
              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#DDE8D8] text-[#4F6F52] uppercase tracking-wider">
                Public View
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 flex flex-col min-h-0">
        {children}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-[#D6DED2] bg-white py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#66736A]">
          <div>
            &copy; {new Date().getFullYear()} Denah Property. All rights reserved.
          </div>
          <div className="font-semibold text-[#4F6F52]">
            Powered by Denah Property ERP
          </div>
        </div>
      </footer>
    </div>
  );
}
