import { notFound } from 'next/navigation'
import { SupabaseSetup } from '@/components/campus/supabase-setup'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'
import { isHiddenCampus } from '@/lib/campus'

type CampusPageProps = { params: Promise<{ slug: string }> }

export default async function CampusPage({ params }: CampusPageProps) {
  if (!isSupabaseConfigured()) return <SupabaseSetup />

  const { slug } = await params
  const supabase = await createClient()
  const { data: campus, error } = await supabase.from('campuses').select('id,slug,name').eq('slug', slug).maybeSingle()

  if (error || !campus || isHiddenCampus(campus)) notFound()

  const { CampusApp } = await import('@/components/campus/campus-app')
  return <CampusApp initialCampusSlug={slug} />
}
