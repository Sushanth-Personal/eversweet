import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Eversweet — Handcrafted Mochi, Kochi',
  description:
    'Fresh mochi made daily in our Kochi cloud kitchen. Matcha, strawberry, dark chocolate and more. Order online for same-day delivery.',
  openGraph: {
    title: 'Eversweet Mochi',
    description: 'Handcrafted mochi, fresh from our cloud kitchen in Kochi.',
    images: ['/og.jpg'],
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
