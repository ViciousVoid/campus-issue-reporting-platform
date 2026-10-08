'use client'

import { ArrowUp, Bell, Bookmark, MessageCircle, MapPin, MoreHorizontal } from 'lucide-react'
import { CATEGORY_IMAGES, STATUS_LABELS, type CampusIssue } from '@/lib/campus'
import { createClient } from '@/lib/supabase/client'

type IssueCardProps = {
  issue: CampusIssue
  userId?: string
  onOpen: (issue: CampusIssue) => void
  onVote: (issue: CampusIssue) => void
  onFollow: (issue: CampusIssue) => void
  onAuth: () => void
}

const statusStyles: Record<string, string> = {
  reported: 'status-reported',
  verified: 'status-verified',
  acknowledged: 'status-acknowledged',
  in_progress: 'status-progress',
  resolved: 'status-resolved',
  reopened: 'status-reopened',
}

export function IssueCard({ issue, userId, onOpen, onVote, onFollow, onAuth }: IssueCardProps) {
  const supabase = createClient()
  const photo = issue.media?.[0]?.storage_path
    ? supabase.storage.from('issue-photos').getPublicUrl(issue.media[0].storage_path).data.publicUrl
    : `https://images.unsplash.com/${CATEGORY_IMAGES[issue.category?.name ?? 'Other'] ?? CATEGORY_IMAGES.Other}?auto=format&fit=crop&w=960&q=82`
  const score = issue.votes?.reduce((sum, vote) => sum + vote.value, 0) ?? 0
  const hasVoted = Boolean(userId && issue.votes?.some((vote) => vote.user_id === userId && vote.value === 1))
  const commentCount = issue.comments?.length ?? 0
  const category = issue.category?.name ?? 'Campus issue'

  return (
    <article className="issue-card">
      <div className="issue-card-head">
        <div className="issue-source">
          <span className="category-mark">{category.slice(0, 1)}</span>
          <span>{category}</span>
          <span className="source-dot" aria-hidden="true">·</span>
          <time dateTime={issue.created_at}>{relativeTime(issue.created_at)}</time>
        </div>
        <button className="icon-button quiet-icon" type="button" aria-label="More issue options" onClick={() => onOpen(issue)}>
          <MoreHorizontal size={19} />
        </button>
      </div>
      <button className="issue-card-title" type="button" onClick={() => onOpen(issue)}>
        <h2>{issue.title}</h2>
      </button>
      <p className="issue-excerpt">{issue.description}</p>
      <button className="issue-photo-wrap" type="button" onClick={() => onOpen(issue)} aria-label={`Open issue: ${issue.title}`}>
        <img src={photo} alt={`${category} issue reported at ${issue.location?.name ?? 'campus'}`} className="issue-photo" />
        <span className={`status-pill ${statusStyles[issue.status] ?? 'status-reported'}`}>
          <span className="status-dot" />{STATUS_LABELS[issue.status]}
        </span>
      </button>
      <div className="issue-location-row">
        <MapPin size={14} aria-hidden="true" />
        <span>{issue.location?.name ?? issue.building_area ?? 'Campus-wide'}</span>
        {issue.building_area && issue.location?.name && <><span className="source-dot">·</span><span>{issue.building_area}</span></>
      </div>
      <div className="issue-card-actions">
        <button className={`action-button vote-button${hasVoted ? ' is-active' : ''}`} type="button" aria-label={`Upvote issue, ${score} votes`} aria-pressed={hasVoted} onClick={() => userId ? onVote(issue) : onAuth()}>
          <ArrowUp size={17} /><span>{score || 'Upvote'}</span>
        </button>
        <button className="action-button" type="button" onClick={() => onOpen(issue)}>
          <MessageCircle size={17} /><span>{commentCount} {commentCount === 1 ? 'comment' : 'comments'}</span>
        </button>
        <button className="action-button action-follow" type="button" onClick={() => userId ? onFollow(issue) : onAuth()} aria-label="Follow issue updates">
          {userId && issue.followers?.some((follower) => follower.user_id === userId) ? <Bookmark size={16} fill="currentColor" /> : <Bell size={16} />}
          <span>Follow</span>
        </button>
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
  const path = issue.media?.[0]?.storage_path
  const photo = path
    ? createClient().storage.from('issue-photos').getPublicUrl(path).data.publicUrl
    : `https://images.unsplash.com/${CATEGORY_IMAGES[issue.category?.name ?? 'Other'] ?? CATEGORY_IMAGES.Other}?auto=format&fit=crop&w=1200&q=82`
  return <img className={className} src={photo} alt={`${issue.category?.name ?? 'Campus'} issue at ${issue.location?.name ?? 'campus'}`} />
}

export function CampusIssueCard() {
  return null
}

export type IssueCardCallbacks = Pick<IssueCardProps, 'onOpen' | 'onVote' | 'onFollow' | 'onAuth'>
export type { CampusIssue }
export { statusStyles }
