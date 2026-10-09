import { createBrowserClient } from '@supabase/ssr'

type BrowserClient = ReturnType<typeof createBrowserClient>

let browserClient: BrowserClient | undefined

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  )
}

function getBrowserClient(): BrowserClient {
  if (!browserClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase client configuration is missing.')
    }

    browserClient = createBrowserClient(supabaseUrl, supabaseKey, {
      cookieOptions: { secure: process.env.NODE_ENV === 'production' },
    })
  }

  return browserClient
}

// Several components call createClient() at module scope, so the real client is
// created on first use rather than on import to avoid crashing when env vars are absent.
export function createClient(): BrowserClient {
  if (browserClient) return browserClient
  return new Proxy({} as BrowserClient, {
    get(_target, prop) {
      const client = getBrowserClient()
      const value = Reflect.get(client, prop, client)
      return typeof value === 'function' ? value.bind(client) : value
    },
  })
}
