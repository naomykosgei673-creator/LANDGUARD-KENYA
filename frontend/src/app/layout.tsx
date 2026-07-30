import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'LandGuard Kenya — Secure Land Selling & Ownership Verification',
  description:
    'Enterprise-grade platform that reduces land fraud in Kenya through verification, transparency, secure transactions, government approval and QR-verifiable ownership.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: browser extensions (e.g. Grammarly) inject
    // attributes onto <html>/<body> before React hydrates, which would otherwise
    // trigger a harmless hydration mismatch warning.
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
