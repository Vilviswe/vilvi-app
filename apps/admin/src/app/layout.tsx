import './globals.css'
import { Inter } from 'next/font/google'
const inter = Inter({ subsets: ['latin'] })

export const metadata = { title: 'Vilvi – Admin', description: 'Vilvi – admin' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='sv'>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
