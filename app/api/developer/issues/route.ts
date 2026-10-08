import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const campusQuerySchema = z.string().uuid()
const updateSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('set_vote_counts'), issueId: z.string().uuid(), upvotes: z.number().int().min(0).max(1_000_000), downvotes: z.number().int().min(0).max(1_000_000) }),
  z.object({ action: z.literal('reset_vote_counts'), issueId: z.string().uuid() }),
  z.object({ action: z.literal('update_issue'), issueId: z.string().uuid(), title: z.string().trim().min(8).max(120), description: z.string().trim().min(20).max(5000) }),
  z.object({ action: z.literal('delete_issue'), issueId: z.string().uuid() }),
])

async function getAuthorizedAdmin() {
  const sessionClient = await createClient()
  const { data: authData, error: authError } = await sessionClient.auth.getUser()
  if (authError || !authData.user) return { response: Response.json({ error: 'Sign in required.' }, { status: 401 }) }
  const { data: profile, error: profileError } = await sessionClient.from('profiles').select('campus_id').eq('id', authData.user.id).maybeSingle()
  if (profileError || !profile?.campus_id) return { response: Response.json({ error: 'A campus membership is required.' }, { status: 403 }) }
  return { userId: authData.user.id, campusId: profile.campus_id }
}

async function hasCampusAdminRole(userId: string, campusId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('campus_moderators').select('role').eq('user_id', userId).eq('campus_id', campusId).maybeSingle()
  return data?.role === 'admin'
}

export async function GET(request: Request) {
  const auth = await getAuthorizedAdmin()
  if ('response' in auth) return auth.response
  const campusId = campusQuerySchema.safeParse(new URL(request.url).searchParams.get('campusId'))
  if (!campusId.success) return Response.json({ error: 'A valid campus is required.' }, { status: 400 })
  if (campusId.data !== auth.campusId) return Response.json({ error: 'Developer tools are restricted to your own campus.' }, { status: 403 })
  if (!await hasCampusAdminRole(auth.userId, campusId.data)) return Response.json({ error: 'Developer tools are restricted to campus administrators.' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('issues')
    .select('id,title,created_at,severity,developer_upvote_override,developer_downvote_override,votes(value)')
    .eq('campus_id', campusId.data)
    .order('created_at', { ascending: false })
  if (error) return Response.json({ error: 'Could not load campus reports.' }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(request: Request) {
  const auth = await getAuthorizedAdmin()
  if ('response' in auth) return auth.response
  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Check the developer action and try again.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: issue } = await admin.from('issues').select('id,campus_id').eq('id', parsed.data.issueId).maybeSingle()
  if (!issue || issue.campus_id !== auth.campusId) return Response.json({ error: 'Report not found.' }, { status: 404 })
  if (!await hasCampusAdminRole(auth.userId, issue.campus_id)) return Response.json({ error: 'Developer tools are restricted to campus administrators.' }, { status: 403 })

  if (parsed.data.action === 'delete_issue') {
    const { data: media, error: mediaError } = await admin.from('issue_media').select('storage_path').eq('issue_id', issue.id)
    if (mediaError) return Response.json({ error: 'The report photos could not be checked before deletion.' }, { status: 500 })
    const { error } = await admin.from('issues').delete().eq('id', issue.id).eq('campus_id', issue.campus_id)
    if (error) return Response.json({ error: 'The report could not be deleted.' }, { status: 500 })
    const paths = (media ?? []).map((item) => item.storage_path)
    const { error: storageError } = paths.length ? await admin.storage.from('issue-photos').remove(paths) : { error: null }
    return Response.json({ ok: true, warning: storageError ? 'Post deleted, but photo files could not be removed.' : null })
  }

  if (parsed.data.action === 'update_issue') {
    const { data, error } = await admin.from('issues')
      .update({ title: parsed.data.title, description: parsed.data.description, updated_at: new Date().toISOString() })
      .eq('id', issue.id)
      .eq('campus_id', issue.campus_id)
      .select('id')
      .maybeSingle()
    if (error) return Response.json({ error: 'The post could not be updated.' }, { status: 500 })
    if (!data) return Response.json({ error: 'Post not found.' }, { status: 404 })
    return Response.json({ ok: true })
  }

  const counts = parsed.data.action === 'reset_vote_counts'
    ? { developer_upvote_override: null, developer_downvote_override: null }
    : { developer_upvote_override: parsed.data.upvotes, developer_downvote_override: parsed.data.downvotes }
  const { error } = await admin.from('issues').update(counts).eq('id', issue.id).eq('campus_id', issue.campus_id)
  if (error) return Response.json({ error: 'The report vote counts could not be updated.' }, { status: 500 })
  return Response.json({ ok: true })
}
