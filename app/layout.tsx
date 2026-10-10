import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'The Humor Project — Funnier than you.', description: 'Upload a photo. Let AI find the punchline. A comedy club hosted by a baby with unreasonable confidence.' };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
