import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Vilvi – Site',
  description: 'Start',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='sv'>
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
