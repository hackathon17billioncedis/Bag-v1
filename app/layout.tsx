import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bag-v1 | Vercel-ready AI assistant',
  description: 'A Next.js and TypeScript upgrade of the Bag-v1 assistant for Vercel.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}
