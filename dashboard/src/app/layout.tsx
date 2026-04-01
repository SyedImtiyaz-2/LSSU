import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "LSSU BFX Dashboard",
  description: "Lake Superior State University — Laker Chatbot Admin Dashboard",
};

const nav = [
  { href: "/",          label: "Overview"  },
  { href: "/leads",     label: "Leads"     },
  { href: "/sessions",  label: "Sessions"  },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          {/* Top nav */}
          <header className="bg-[#003F6B] text-white shadow-md">
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-[#C8992A]">LSSU</span>
                <span className="text-sm text-white/70 hidden sm:block">BFX Admissions Dashboard</span>
              </div>
              <nav className="flex gap-6">
                {nav.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="text-sm font-medium text-white/80 hover:text-[#C8992A] transition-colors"
                  >
                    {n.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
            {children}
          </main>

          <footer className="text-center text-xs text-gray-400 py-4">
            LSSU Laker Chatbot &copy; {new Date().getFullYear()}
          </footer>
        </div>
      </body>
    </html>
  );
}
