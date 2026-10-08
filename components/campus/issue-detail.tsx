'use client'

import { useState, type FormEvent } from 'react'
import useSWR, { mutate } from 'swr'
import { ArrowDown, ArrowUp, Bell, Check, Clock3, MapPin, MessageCircle, Send, Users, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { STATUS_LABELS, type CampusIssue } from '@/lib/campus'
import { IssueImage, relativeTime, statusStyles } from '@/components/campus/issue-card'

type Comment = { id: string; issue_id: string; user_id: string | null; parent_id: string | null; body: string; created_at: string; author: { display_name: string } | null }
type IssueDetailProps = {
  issue: CampusIssue
  userId: string | null
  onClose: () => void
  onVote: (issue: CampusIssue, value: 1 | -1) => void
  onAffected: (issue: CampusIssue) => void
  onFollow: (issue: CampusIssue) => void
  onComment: (issueId: string, body: string, parentId?: string) => Promise<boolean>
  busy: boolean
  onRequireAuth: () => void
}

const supabase = createClient()

export function IssueDetail({ issue, userId, onClose, onVote, onAffected, onFollow, onComment, busy, onRequireAuth }: IssueDetailProps) {
  const [body, setBody] = useState('')
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const { data: comments = [], isLoading } = useSWR(['comments', issue.id], async ([, id]) => {
    const { data, error } = await supabase.from('comments').select('id,issue_id,user_id,parent_id,body,created_at,author:profiles(display_name)').eq('issue_id', id).order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []) as unknown as Comment[]
  })
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
  const voteScore = issue.votes.reduce((total, vote) => total + vote.value, 0)
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

  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="issue-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <header className="dialog-topbar"><span className="eyebrow">ISSUE DETAILS</span><button className="icon-button" onClick={onClose} aria-label="Close issue details"><X size={20} /></button></header>
        <div className="detail-scroll">
          <div className="detail-image"><IssueImage issue={issue} className="detail-photo" /><span className={`status-pill ${statusStyles[issue.status]}`}><span className="status-dot" />{STATUS_LABELS[issue.status]}</span></div>
          <div className="detail-body">
            <div className="detail-meta"><span className="category-mark">{issue.category?.name.slice(0, 1) ?? 'C'}</span><strong>{issue.category?.name ?? 'Campus issue'}</strong><span>·</span><span>{relativeTime(issue.created_at)}</span></div>
            <h1 id="detail-title">{issue.title}</h1>
            <p className="detail-description">{issue.description}</p>
            <div className="detail-location"><MapPin size={16} /><span>{issue.location?.name ?? issue.building_area ?? 'Campus-wide'}</span>{issue.building_area && issue.location?.name && <span>· {issue.building_area}</span>}</div>
            {issue.department?.name && <div className="department-note"><span>ROUTED TO</span><strong>{issue.department.name}</strong></div>}
            <div className="detail-action-row">
              <button className={`action-button ${voteRows?.value === 1 ? 'is-active' : ''}`} onClick={() => userId ? onVote(issue, 1) : onRequireAuth()} disabled={busy}><ArrowUp size={17} /> Support <strong>{voteScore}</strong></button>
              <button className={`action-button ${affected ? 'is-active' : ''}`} onClick={() => userId ? onAffected(issue) : onRequireAuth()} disabled={busy}><Users size={17} /> I&apos;m affected <strong>{issue.affected_users.length}</strong></button>
              <button className={`action-button ${followerRows.length ? 'is-active' : ''}`} onClick={() => userId ? onFollow(issue) : onRequireAuth()} disabled={busy}><Bell size={16} /> {followerRows.length ? 'Following' : 'Follow'}</button>
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
            <div className="timeline-note"><Check size={15} /><span>Status is currently <strong>{STATUS_LABELS[issue.status]}</strong>. Campus updates appear here as the issue moves forward.</span></div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default IssueDetail
