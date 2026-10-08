import { notFound } from 'next/navigation'
import { CampusApp } from '@/components/campus/campus-app'
import { createClient } from '@/lib/supabase/server'
import { isHiddenCampus } from '@/lib/campus'

type CampusPageProps = { params: Promise<{ slug: string }> }

export default async function CampusPage({ params }: CampusPageProps) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: campus, error } = await supabase.from('campuses').select('id,slug,name').eq('slug', slug).maybeSingle()

  if (error || !campus || isHiddenCampus(campus)) notFound()

  return <CampusApp initialCampusSlug={slug} />
}
