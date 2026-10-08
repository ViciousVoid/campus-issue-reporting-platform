'use client'

import { ArrowDown, ArrowUp, Bell, Bookmark, Flame, MapPin, MessageCircle, MoreHorizontal, Users } from 'lucide-react'
import { CATEGORY_IMAGES, STATUS_LABELS, type CampusIssue } from '@/lib/campus'
import { createClient } from '@/lib/supabase/client'

export type IssueCardCallbacks = {
  onOpen: (issue: CampusIssue) => void
  onVote: (issue: CampusIssue, value: 1 | -1) => void
  onAffected: (issue: CampusIssue) => void
  onFollow: (issue: CampusIssue) => void
  onAuth: () => void
}

type IssueCardProps = IssueCardCallbacks & { issue: CampusIssue; userId: string | null; busy: boolean }

export const statusStyles: Record<string, string> = {
  reported: 'status-reported', verified: 'status-verified', acknowledged: 'status-acknowledged',
  in_progress: 'status-progress', resolved: 'status-resolved', reopened: 'status-reopened',
}

const supabase = createClient()

export function IssueCard({ issue, userId, busy, onOpen, onVote, onAffected, onFollow, onAuth }: IssueCardProps) {
  const path = issue.media?.slice().sort((a, b) => a.display_order - b.display_order)[0]?.storage_path
  const photo = path
    ? supabase.storage.from('issue-photos').getPublicUrl(path).data.publicUrl
    : `https://images.unsplash.com/${CATEGORY_IMAGES[issue.category?.name ?? 'Other'] ?? CATEGORY_IMAGES.Other}?auto=format&fit=crop&w=960&q=82`
  const upVotes = issue.votes?.filter((vote) => vote.value === 1).length ?? 0
  const downVotes = issue.votes?.filter((vote) => vote.value === -1).length ?? 0
  const hasVoted = Boolean(userId && issue.votes?.some((vote) => vote.user_id === userId && vote.value === 1))
  const hasDownVoted = Boolean(userId && issue.votes?.some((vote) => vote.user_id === userId && vote.value === -1))
  const isFollowing = Boolean(userId && issue.followers?.some((follower) => follower.user_id === userId))
  const isAffected = Boolean(userId && issue.affected_users?.some((entry) => entry.user_id === userId))
  const comments = issue.comments?.length ?? 0
  const category = issue.category?.name ?? 'Campus issue'

  return (
    <article className="issue-card">
      <div className="issue-card-head"><div className="issue-source"><span className="category-mark">{category.slice(0, 1)}</span><span>{category}</span><span className="source-dot" aria-hidden="true">·</span><time dateTime={issue.created_at}>{relativeTime(issue.created_at)}</time></div><span className="heat-placeholder" title="Heat scoring is coming later"><Flame size={13} /> Heat soon</span><button className="icon-button quiet-icon" type="button" aria-label={`More about ${issue.title}`} onClick={() => onOpen(issue)}><MoreHorizontal size={19} /></button></div>
      <button className="issue-card-title" type="button" onClick={() => onOpen(issue)}><h2>{issue.title}</h2></button>
      <p className="issue-excerpt">{issue.description}</p>
      <button className="issue-photo-wrap" type="button" onClick={() => onOpen(issue)} aria-label={`Open issue: ${issue.title}`}><img src={photo} alt={`${category} at ${issue.location?.name ?? 'campus'}`} className="issue-photo" /><span className={`status-pill ${statusStyles[issue.status] ?? 'status-reported'}`}><span className="status-dot" />{STATUS_LABELS[issue.status]}</span></button>
      <div className="issue-location-row"><MapPin size={14} aria-hidden="true" /><span>{issue.location?.name ?? issue.building_area ?? 'Campus-wide'}</span>{issue.building_area && issue.location?.name && <><span className="source-dot">·</span><span>{issue.building_area}</span></>}</div>
      {issue.department?.name && <div className="issue-department-row"><span>ROUTED TO</span><strong>{issue.department.name}</strong></div>}
      <div className="issue-card-actions">
        <button className={`action-button vote-button${hasVoted ? ' is-active' : ''}`} type="button" aria-label={`Upvote issue, ${upVotes} votes`} aria-pressed={hasVoted} disabled={busy} onClick={() => userId ? onVote(issue, 1) : onAuth()}><ArrowUp size={17} /><span>{upVotes}</span></button>
        <button className={`action-button vote-button-down${hasDownVoted ? ' is-active' : ''}`} type="button" aria-label={`Downvote issue, ${downVotes} votes`} aria-pressed={hasDownVoted} disabled={busy} onClick={() => userId ? onVote(issue, -1) : onAuth()}><ArrowDown size={17} /><span>{downVotes}</span></button>
        <button className={`action-button${isAffected ? ' is-active' : ''}`} type="button" aria-pressed={isAffected} disabled={busy} onClick={() => userId ? onAffected(issue) : onAuth()}><Users size={16} /><span>{issue.affected_users.length} affected</span></button>
        <button className="action-button" type="button" onClick={() => onOpen(issue)}><MessageCircle size={17} /><span>{comments} {comments === 1 ? 'comment' : 'comments'}</span></button>
        <button className={`action-button action-follow${isFollowing ? ' is-active' : ''}`} type="button" aria-label={isFollowing ? 'Unfollow issue updates' : 'Follow issue updates'} aria-pressed={isFollowing} disabled={busy} onClick={() => userId ? onFollow(issue) : onAuth()}>{isFollowing ? <Bookmark size={16} fill="currentColor" /> : <Bell size={16} />}<span>{isFollowing ? 'Following' : 'Follow'}</span></button>
      </div>
    </article>
  )
}

export function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value))
}

export function IssueImage({ issue, className = '' }: { issue: CampusIssue; className?: string }) {
  const path = issue.media?.slice().sort((a, b) => a.display_order - b.display_order)[0]?.storage_path
  const photo = path ? supabase.storage.from('issue-photos').getPublicUrl(path).data.publicUrl : `https://images.unsplash.com/${CATEGORY_IMAGES[issue.category?.name ?? 'Other'] ?? CATEGORY_IMAGES.Other}?auto=format&fit=crop&w=1200&q=82`
  return <img className={className} src={photo} alt={`${issue.category?.name ?? 'Campus'} issue at ${issue.location?.name ?? 'campus'}`} />
}

export { STATUS_LABELS }
export type { CampusIssue }
export function CampusIssueCard() { return null }
