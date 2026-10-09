import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { EmailOtpType } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const OTP_TYPES: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email']

function redirectWithStatus(origin: string, path: string, status: string) {
  const target = new URL(path, origin)
  target.searchParams.set('auth', status)
  return NextResponse.redirect(target)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const rawType = url.searchParams.get('type')
  const providerError = url.searchParams.get('error_code') ?? url.searchParams.get('error')
  const requestedPath = url.searchParams.get('next') ?? '/'
  const next = requestedPath.startsWith('/') && !requestedPath.startsWith('//') ? requestedPath : '/'

  if (providerError) {
    return redirectWithStatus(url.origin, next, providerError === 'otp_expired' ? 'expired' : 'error')
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return redirectWithStatus(url.origin, '/', 'configuration')

  const cookieStore = await cookies()
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) },
    },
  })

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return redirectWithStatus(url.origin, next, 'confirmed')
    // The PKCE verifier lives in the browser that signed up; opening the link elsewhere still confirms the email.
    return redirectWithStatus(url.origin, next, 'confirmed-signin')
  }

  if (tokenHash && rawType && OTP_TYPES.includes(rawType as EmailOtpType)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: rawType as EmailOtpType })
    if (!error) return redirectWithStatus(url.origin, next, 'confirmed')
    return redirectWithStatus(url.origin, next, error.code === 'otp_expired' ? 'expired' : 'error')
  }

  return redirectWithStatus(url.origin, next, 'error')
}
