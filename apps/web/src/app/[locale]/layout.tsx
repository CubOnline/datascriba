import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import type { Metadata } from 'next'
import { Providers } from '@/components/providers'
import '../globals.css'

export const metadata: Metadata = {
  title: 'DataScriba',
  description: 'AI-powered reporting platform',
}

interface LocaleLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages}>
          <Providers>
            {children}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
