import { SupabaseSetup } from '@/components/campus/supabase-setup'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export default async function Page() {
  if (!isSupabaseConfigured()) return <SupabaseSetup />

  // Defer module evaluation: campus components initialize Supabase on import.
  const { CampusApp } = await import('@/components/campus/campus-app')
  return <CampusApp />
}
