import createMiddleware from 'next-intl/middleware'
import { type NextRequest, NextResponse } from 'next/server'
import { routing } from './i18n/routing'

const intlMiddleware = createMiddleware(routing)

const PUBLIC_PATHS = ['/login']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.endsWith(p))
}

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Run intl middleware first
  const intlResponse = intlMiddleware(req)

  // Allow login page without auth
  if (isPublicPath(pathname)) return intlResponse

  // Check auth cookie set by auth.ts setToken()
  const authCookie = req.cookies.get('ds_auth')
  if (!authCookie) {
    const locale = pathname.split('/')[1] || 'tr'
    const loginUrl = new URL(`/${locale}/login`, req.url)
    return NextResponse.redirect(loginUrl)
  }

  return intlResponse
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
