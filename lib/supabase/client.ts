import { createBrowserClient } from '@supabase/ssr'

let browserClient: ReturnType<typeof createBrowserClient> | undefined

export function createClient() {
  if (!browserClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    browserClient = createBrowserClient(
      supabaseUrl ?? 'https://placeholder.supabase.co',
      supabaseKey ?? 'placeholder-publishable-key',
      {
      cookieOptions: { secure: process.env.NODE_ENV === 'production' },
    })
  }

  return browserClient
}

export async function ensureAnonymousUser() {
  const client = createClient()
  const { data: current } = await client.auth.getUser()
  if (current.user) return current.user

  const displayName = `Campus Guest ${Math.floor(1000 + Math.random() * 9000)}`
  const { data, error } = await client.auth.signInAnonymously({
    options: { data: { display_name: displayName } },
  })
  if (error) throw error
  return data.user
}
