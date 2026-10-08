import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'campusheat — Campus issue reports',
  description: 'View campus issue reports, track their status, and report maintenance, safety, and other campus concerns.',
  applicationName: 'campusheat',
  openGraph: {
    title: 'campusheat — Campus issue reports',
    description: 'View and submit maintenance, safety, and other campus issue reports.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: '#f6f7f4',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
