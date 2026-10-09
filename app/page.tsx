import { CampusApp } from '@/components/campus/campus-app'
import { SupabaseSetupNotice } from '@/components/campus/supabase-setup-notice'
import { isSupabaseConfigured } from '@/lib/supabase/client'

export default function Page() {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />
  }

  return <CampusApp />
}
