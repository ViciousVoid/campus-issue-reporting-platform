export function SupabaseSetup() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 py-12 text-foreground">
      <section aria-labelledby="setup-title" className="w-full max-w-lg rounded-xl border border-border bg-card p-8 text-card-foreground shadow-sm">
        <p className="mb-3 text-sm font-semibold text-primary">CampusHeat</p>
        <h1 id="setup-title" className="text-2xl font-bold tracking-tight">Connect Supabase to get started</h1>
        <p className="mt-4 text-sm leading-6">
          Campus data and sign-in are unavailable until this project is connected to Supabase.
        </p>
        <p className="mt-4 text-sm leading-6">
          In v0, open Settings and connect the existing Supabase project. Confirm these public environment variables are available under Vars:
        </p>
        <ul className="mt-4 list-inside list-disc space-y-2 text-sm">
          <li><code className="break-all">NEXT_PUBLIC_SUPABASE_URL</code></li>
          <li><code className="break-all">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> or <code className="break-all">NEXT_PUBLIC_SUPABASE_ANON_KEY</code></li>
        </ul>
        <p className="mt-4 text-sm leading-6">Then reload the preview. No sample data or temporary sign-in is being used.</p>
      </section>
    </main>
  )
}
