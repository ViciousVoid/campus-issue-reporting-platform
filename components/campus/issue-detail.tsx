'use client'

import { useState, type FormEvent } from 'react'
import useSWR, { mutate } from 'swr'
import { ArrowDown, ArrowUp, Bell, Check, Clock3, LoaderCircle, MapPin, MessageCircle, Send, Sparkles, Users, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { STATUS_LABELS, type CampusIssue } from '@/lib/campus'
import { IssueImage, relativeTime, statusStyles } from '@/components/campus/issue-card'

type Comment = { id: string; issue_id: string; user_id: string | null; parent_id: string | null; body: string; created_at: string; author: { display_name: string } | null }
type IssueEvent = { id: string; event_type: string; message: string | null; previous_value: string | null; new_value: string | null; created_at: string }
type ResolutionCheck = { user_id: string; result: 'fixed' | 'still_a_problem'; note: string | null }
type IssueDetailProps = {
  issue: CampusIssue
  userId: string | null
  onClose: () => void
  onVote: (issue: CampusIssue, value: 1 | -1) => void
  onAffected: (issue: CampusIssue) => void
  onFollow: (issue: CampusIssue) => void
  onComment: (issueId: string, body: string, parentId?: string) => Promise<boolean>
  busy: boolean
  isModerator?: boolean
  onRequireAuth: () => void
}

async function runWorkflow(payload: Record<string, unknown>) {
  const response = await fetch('/api/issue-intelligence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error ?? 'Could not complete that action.')
  return result
}

const supabase = createClient()

export function IssueDetail({ issue, userId, onClose, onVote, onAffected, onFollow, onComment, busy, isModerator = false, onRequireAuth }: IssueDetailProps) {
  const [body, setBody] = useState('')
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [summary, setSummary] = useState(issue.ai_summary ?? '')
  const [workflowBusy, setWorkflowBusy] = useState(false)
  const [officialMessage, setOfficialMessage] = useState('')
  const [workflowError, setWorkflowError] = useState('')
  const [workflowNotice, setWorkflowNotice] = useState('')
  const [verification, setVerification] = useState<'fixed' | 'still_a_problem' | null>(null)
  const [verificationNote, setVerificationNote] = useState('')
  const { data: comments = [], isLoading } = useSWR(['comments', issue.id], async ([, id]) => {
    const { data, error } = await supabase.from('comments').select('id,issue_id,user_id,parent_id,body,created_at,author:profiles(display_name)').eq('issue_id', id).order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []) as unknown as Comment[]
  })
  const { data: events = [] } = useSWR(['issue-events', issue.id], async ([, issueId]) => {
    const { data, error } = await supabase.from('issue_events').select('id,event_type,message,previous_value,new_value,created_at').eq('issue_id', issueId).order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []) as IssueEvent[]
  })
  const { data: resolutionChecks = [] } = useSWR(['resolution-checks', issue.id], async ([, issueId]) => {
    const { data, error } = await supabase.from('issue_resolution_checks').select('user_id,result,note').eq('issue_id', issueId)
    if (error) throw error
    return (data ?? []) as ResolutionCheck[]
  })
  const myVerification = resolutionChecks.find((check) => check.user_id === userId)?.result ?? verification
  const { data: followerRows = [] } = useSWR(userId ? ['followers', issue.id, userId] : null, async ([, issueId, uid]) => {
    const { data, error } = await supabase.from('issue_followers').select('user_id').eq('issue_id', issueId).eq('user_id', uid)
    if (error) throw error
    return data ?? []
  })
  const { data: voteRows = [] } = useSWR(userId ? ['my-vote', issue.id, userId] : null, async ([, issueId, uid]) => {
    const { data, error } = await supabase.from('votes').select('value').eq('issue_id', issueId).eq('user_id', uid).maybeSingle()
    if (error) throw error
    return data
  })
  const parentComments = comments.filter((comment) => !comment.parent_id)
  const repliesFor = (parentId: string) => comments.filter((comment) => comment.parent_id === parentId)
  const upVotes = issue.developer_upvote_override ?? issue.votes.filter((vote) => vote.value === 1).length
  const downVotes = issue.developer_downvote_override ?? issue.votes.filter((vote) => vote.value === -1).length
  const affected = issue.affected_users.some((entry) => entry.user_id === userId)

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!userId) { onRequireAuth(); return }
    const text = body.trim()
    if (!text) return
    const posted = await onComment(issue.id, text, replyTo?.id)
    if (posted) {
      setBody('')
      setReplyTo(null)
      await mutate(['comments', issue.id])
    }
  }

  async function summarizeDiscussion() {
    if (!userId) { onRequireAuth(); return }
    setWorkflowBusy(true)
    setWorkflowError('')
    try {
      const result = await runWorkflow({ action: 'summarize', issueId: issue.id })
      setSummary(result.summary)
      await mutate(['comments', issue.id])
    } catch (error) {
      setWorkflowError(error instanceof Error ? error.message : 'Could not summarize this discussion.')
    } finally {
      setWorkflowBusy(false)
    }
  }

  async function verifyResolution(result: 'fixed' | 'still_a_problem') {
    if (!userId) { onRequireAuth(); return }
    setWorkflowBusy(true)
    setWorkflowError('')
    setWorkflowNotice('')
    try {
      await runWorkflow({ action: 'verify_resolution', issueId: issue.id, result, note: verificationNote.trim() || undefined })
      setVerification(result)
      setWorkflowNotice(result === 'fixed' ? 'Your resolution check was recorded.' : 'The issue was reopened for campus follow-up.')
      await Promise.all([mutate(['resolution-checks', issue.id]), mutate(['issue-events', issue.id]), mutate(['issues', issue.campus_id])])
    } catch (error) {
      setWorkflowError(error instanceof Error ? error.message : 'Your verification could not be saved.')
    } finally {
      setWorkflowBusy(false)
    }
  }

  async function postOfficialResponse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!userId) { onRequireAuth(); return }
    const message = officialMessage.trim()
    if (message.length < 4) return
    setWorkflowBusy(true)
    setWorkflowError('')
    setWorkflowNotice('')
    try {
      await runWorkflow({ action: 'official_response', issueId: issue.id, message })
      setOfficialMessage('')
      setWorkflowNotice('Official response posted.')
      await mutate(['issue-events', issue.id])
    } catch (error) {
      setWorkflowError(error instanceof Error ? error.message : 'Official response could not be posted.')
    } finally {
      setWorkflowBusy(false)
    }
  }

  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="issue-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <header className="dialog-topbar"><span className="eyebrow">ISSUE DETAILS</span><button className="icon-button" onClick={onClose} aria-label="Close issue details"><X size={20} /></button></header>
        <div className="detail-scroll">
          <div className="detail-image"><IssueImage issue={issue} className="detail-photo" /><span className={`status-pill ${statusStyles[issue.status]}`}><span className="status-dot" />{STATUS_LABELS[issue.status]}</span></div>
          <div className="detail-body">
            <div className="detail-meta"><span className="category-mark">{(issue.custom_category || issue.category?.name)?.slice(0, 1) ?? 'C'}</span><strong>{issue.custom_category || issue.category?.name || 'Campus issue'}</strong><span>·</span><span>{relativeTime(issue.created_at)}</span></div>
            <h1 id="detail-title">{issue.title}</h1>
            <p className="detail-description">{issue.description}</p>
            <div className="detail-location"><MapPin size={16} /><span>{issue.custom_location || issue.location?.name || issue.building_area || 'Campus-wide'}</span>{issue.building_area && (issue.location?.name || issue.custom_location) && <span>· {issue.building_area}</span>}</div>
            {(issue.custom_department || issue.department?.name) && <div className="department-note"><span>ROUTED TO</span><strong>{issue.custom_department || issue.department?.name}</strong></div>}
            <div className="detail-action-row">
              <button className={`action-button ${voteRows?.value === 1 ? 'is-active' : ''}`} onClick={() => userId ? onVote(issue, 1) : onRequireAuth()} disabled={busy} aria-pressed={voteRows?.value === 1}><ArrowUp size={17} /> Upvote <strong>{upVotes}</strong></button>
              <button className={`action-button ${voteRows?.value === -1 ? 'is-active' : ''}`} onClick={() => userId ? onVote(issue, -1) : onRequireAuth()} disabled={busy} aria-pressed={voteRows?.value === -1}><ArrowDown size={17} /> Downvote <strong>{downVotes}</strong></button>
              <button className={`action-button ${affected ? 'is-active' : ''}`} onClick={() => userId ? onAffected(issue) : onRequireAuth()} disabled={busy} aria-pressed={affected}><Users size={17} /> I&apos;m affected <strong>{issue.affected_users.length}</strong></button>
              <button className={`action-button ${followerRows.length ? 'is-active' : ''}`} onClick={() => userId ? onFollow(issue) : onRequireAuth()} disabled={busy} aria-pressed={followerRows.length > 0}><Bell size={16} /> {followerRows.length ? 'Following' : 'Follow'}</button>
            </div>
            <div className="comment-section">
              <div className="comment-heading"><div><span className="eyebrow">CAMPUS CONVERSATION</span><h2><MessageCircle size={18} /> Updates & comments <span className="count-pill">{comments.length}</span></h2></div></div>
              <form className="comment-form" onSubmit={submitComment}>
                {replyTo && <div className="reply-context">Replying to {replyTo.author?.display_name ?? 'a student'}<button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply"><X size={14} /></button></div>}
                <label className="sr-only" htmlFor="issue-comment">Add a comment</label><textarea id="issue-comment" rows={3} maxLength={2000} value={body} onChange={(event) => setBody(event.target.value)} placeholder={userId ? 'Share an update or helpful detail…' : 'Sign in to join the conversation'} onFocus={() => { if (!userId) onRequireAuth() }} />
                <div className="comment-form-foot"><span>Keep it kind and constructive</span><button className="button-primary small" disabled={busy || !body.trim()}><Send size={14} /> Post</button></div>
              </form>
              {isLoading ? <div className="loading-state"><Clock3 size={18} />Loading conversation…</div> : parentComments.length === 0 ? <div className="comment-empty">No comments yet. Add the first helpful update.</div> : <div className="comments-list">{parentComments.map((comment) => <article className="comment-item" key={comment.id}><span className="avatar avatar-small">{comment.author?.display_name?.slice(0, 1).toUpperCase() ?? 'S'}</span><div className="comment-content"><div className="comment-author"><strong>{comment.author?.display_name ?? 'Campus student'}</strong><time>{relativeTime(comment.created_at)}</time></div><p>{comment.body}</p><button className="reply-button" onClick={() => { setReplyTo(comment); document.getElementById('issue-comment')?.focus() }}>Reply</button>{repliesFor(comment.id).map((reply) => <div className="comment-reply" key={reply.id}><span className="avatar avatar-tiny">{reply.author?.display_name?.slice(0, 1).toUpperCase() ?? 'S'}</span><div><div className="comment-author"><strong>{reply.author?.display_name ?? 'Campus student'}</strong><time>{relativeTime(reply.created_at)}</time></div><p>{reply.body}</p></div></div>)}</div></article>)}</div>}
            </div>
            <section className="discussion-summary" aria-label="AI discussion summary">
              <div className="accountability-heading"><div><span className="eyebrow">AI DISCUSSION BRIEF</span><h2><Sparkles size={16} /> Community summary</h2></div><button type="button" className="button-secondary small" disabled={workflowBusy || comments.length < 8} onClick={() => void summarizeDiscussion()}>{workflowBusy ? <LoaderCircle size={14} className="spin" /> : null}{summary ? 'Refresh summary' : 'Summarize'}</button></div>
              {summary ? <p>{summary}</p> : <small>{comments.length < 8 ? `Available after ${8 - comments.length} more ${8 - comments.length === 1 ? 'comment' : 'comments'}.` : 'Create a concise summary of the discussion so far.'}</small>}
            </section>
            {issue.status === 'resolved' || issue.status === 'reopened' ? <section className="resolution-check-panel"><div className="accountability-heading"><div><span className="eyebrow">COMMUNITY VERIFICATION</span><h2>Is it actually fixed?</h2></div><span className="resolution-counts">{resolutionChecks.filter((check) => check.result === 'fixed').length} fixed · {resolutionChecks.filter((check) => check.result === 'still_a_problem').length} still open</span></div><p>Help the campus team verify the resolution. Three community confirmations are needed to mark it verified.</p><label className="form-field"><span>Optional note</span><textarea rows={2} maxLength={1000} value={verificationNote} onChange={(event) => setVerificationNote(event.target.value)} placeholder="Share what you observed" /></label><div className="verification-actions"><button type="button" className={`button-secondary small${myVerification === 'fixed' ? ' selected' : ''}`} disabled={workflowBusy} onClick={() => void verifyResolution('fixed')}><Check size={14} /> Fixed</button><button type="button" className={`button-secondary small${myVerification === 'still_a_problem' ? ' selected' : ''}`} disabled={workflowBusy} onClick={() => void verifyResolution('still_a_problem')}><X size={14} /> Still a problem</button></div></section> : null}
            {isModerator && <form className="official-response-form" onSubmit={postOfficialResponse}><span className="eyebrow">CAMPUS TEAM RESPONSE</span><label className="sr-only" htmlFor="official-response">Post an official response</label><textarea id="official-response" rows={3} maxLength={2000} value={officialMessage} onChange={(event) => setOfficialMessage(event.target.value)} placeholder="Share an official update or next step…" /><button className="button-primary small" disabled={workflowBusy || officialMessage.trim().length < 4}>{workflowBusy ? <LoaderCircle size={14} className="spin" /> : <Send size={14} />} Post official response</button></form>}
            {workflowError && <p className="form-error" role="alert">{workflowError}</p>}{workflowNotice && <p className="accountability-notice" role="status">{workflowNotice}</p>}
            <section className="resolution-timeline"><div className="accountability-heading"><div><span className="eyebrow">ACCOUNTABILITY</span><h2>Resolution timeline</h2></div><span className={`status-pill ${statusStyles[issue.status]}`}><span className="status-dot" />{STATUS_LABELS[issue.status]}</span></div>{events.length ? <ol>{events.map((event) => <li key={event.id}><span className="timeline-marker" /><div><strong>{event.event_type.replaceAll('_', ' ')}</strong><p>{event.message || `${event.previous_value ?? 'Update'} → ${event.new_value ?? 'Recorded'}`}</p><time dateTime={event.created_at}>{relativeTime(event.created_at)}</time></div></li>)}</ol> : <p>Campus updates will appear here as this issue moves forward.</p>}</section>
          </div>
        </div>
      </section>
    </div>
  )
}

export default IssueDetail
