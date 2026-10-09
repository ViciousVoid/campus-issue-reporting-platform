export function SupabaseSetupNotice() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <section className="flex max-w-md flex-col gap-3 rounded-lg border border-border bg-card p-6 text-card-foreground">
        <h1 className="text-lg font-semibold text-balance">Connect Supabase to continue</h1>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          This app stores campus issues, photos, and chat in Supabase, but no Supabase project is
          connected yet. Add the Supabase integration from the settings menu in the top right, and
          the app will load once{' '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code>{' '}
          and its key are available.
        </p>
      </section>
    </main>
  )
}
