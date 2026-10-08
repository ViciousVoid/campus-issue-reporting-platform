'use client'

import { ArrowDown, ArrowUp, Camera, Flame, MapPin, MessageCircle } from 'lucide-react'
import { CATEGORY_IMAGES, STATUS_LABELS, type CampusIssue } from '@/lib/campus'
import { getHeatLevel, getIssueRecurrenceCount, HEAT_LABELS, scoreIssueHeat, type HeatLevel, type HeatThresholds } from '@/lib/campus-heat'
import { createClient } from '@/lib/supabase/client'

export type IssueCardCallbacks = {
  onOpen: (issue: CampusIssue) => void
  onShowOnMap: (issue: CampusIssue) => void
  onVote: (issue: CampusIssue, value: 1 | -1) => void
  onAuth: () => void
}

type IssueCardProps = IssueCardCallbacks & { issue: CampusIssue; issues?: CampusIssue[]; thresholds?: HeatThresholds; userId: string | null; busy: boolean }

export const statusStyles: Record<string, string> = {
  reported: 'status-reported', verified: 'status-verified', acknowledged: 'status-acknowledged',
  in_progress: 'status-progress', resolved: 'status-resolved', reopened: 'status-reopened',
}

const supabase = createClient()

export function IssueCard({ issue, issues = [], thresholds, userId, busy, onOpen, onShowOnMap, onVote, onAuth }: IssueCardProps) {
  const photos = issue.media?.slice().sort((a, b) => a.display_order - b.display_order) ?? []
  const photo = photos[0]
    ? supabase.storage.from('issue-photos').getPublicUrl(photos[0].storage_path).data.publicUrl
    : `https://images.unsplash.com/${CATEGORY_IMAGES[issue.custom_category || issue.category?.name || 'Other'] ?? CATEGORY_IMAGES.Other}?auto=format&fit=crop&w=960&q=82`
  const upVotes = issue.developer_upvote_override ?? issue.votes?.filter((vote) => vote.value === 1).length ?? 0
  const heatScore = scoreIssueHeat(issue, getIssueRecurrenceCount(issue, issues))
  const heatLevel: HeatLevel = getHeatLevel(heatScore, thresholds)
  const showHeatLevel = heatLevel !== 'normal'
  const flameBorder = upVotes > 40 ? 'issue-card-flame-purple-magenta' : upVotes > 15 && upVotes < 40 ? 'issue-card-flame-ember' : ''
  const downVotes = issue.developer_downvote_override ?? issue.votes?.filter((vote) => vote.value === -1).length ?? 0
  const hasVoted = Boolean(userId && issue.votes?.some((vote) => vote.user_id === userId && vote.value === 1))
  const hasDownVoted = Boolean(userId && issue.votes?.some((vote) => vote.user_id === userId && vote.value === -1))
  const comments = issue.comments?.length ?? 0
  const category = issue.custom_category || issue.category?.name || 'Campus issue'
  const locationName = issue.custom_location || issue.location?.name || issue.building_area || 'Campus-wide'
  const departmentName = issue.custom_department || issue.department?.name

  return (
    <article className={`issue-card${showHeatLevel ? ` heat-card heat-card-${heatLevel}` : ''}${flameBorder ? ` ${flameBorder}` : ''}`}>
      <button className="issue-card-open-overlay" type="button" aria-label={`Open comments and details for ${issue.title}`} onClick={() => onOpen(issue)} />
      {showHeatLevel && <div className={`heat-corners heat-corners-${heatLevel}`} aria-hidden="true">{(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((corner) => <Flame key={corner} className={corner} size={16} fill="currentColor" />)}</div>}
      <div className="issue-card-head"><div className="issue-source"><span className="category-mark">{category.slice(0, 1)}</span><span>{category}</span><span className="source-dot" aria-hidden="true">·</span><time dateTime={issue.created_at}>{relativeTime(issue.created_at)}</time></div>{showHeatLevel && <span className={`heat-placeholder heat-${heatLevel}`} title={`${HEAT_LABELS[heatLevel]} heat score ${heatScore}`} aria-label={`${HEAT_LABELS[heatLevel]}, heat score ${heatScore}`}><Flame size={13} fill="currentColor" /> {HEAT_LABELS[heatLevel]} · {heatScore}</span>}</div>
      <div className="issue-card-title"><h2>{issue.title}</h2></div>
      <p className="issue-excerpt">{issue.description}</p>
      <button className="issue-photo-wrap" type="button" onClick={() => onOpen(issue)} aria-label={`Open post and comments for ${issue.title}`}><img src={photo} alt={`${category} at ${locationName}`} className="issue-photo" /><span className={`status-pill ${statusStyles[issue.status] ?? 'status-reported'}`}><span className="status-dot" />{STATUS_LABELS[issue.status]}</span>{photos.length > 1 && <span className="issue-photo-count"><Camera size={13} />{photos.length}</span>}</button>
      <div className="issue-location-row"><MapPin size={14} aria-hidden="true" /><span>{locationName}</span>{issue.building_area && (issue.location?.name || issue.custom_location) && <><span className="source-dot">·</span><span>{issue.building_area}</span></>}{issue.latitude != null && issue.longitude != null && <button className="issue-card-map-button" type="button" onClick={() => onShowOnMap(issue)} aria-label={`Show ${issue.title} on the campus map`}><MapPin size={13} />Show on map</button>}</div>
      {departmentName && <div className="issue-department-row"><span>ROUTED TO</span><strong>{departmentName}</strong></div>}
      <div className="issue-card-actions">
        <button className={`action-button vote-button${hasVoted ? ' is-active' : ''}`} type="button" aria-label={`Upvote issue, ${upVotes} votes`} aria-pressed={hasVoted} disabled={busy} onClick={() => userId ? onVote(issue, 1) : onAuth()}><ArrowUp size={17} /><span>{upVotes}</span></button>
        <button className={`action-button vote-button-down${hasDownVoted ? ' is-active' : ''}`} type="button" aria-label={`Downvote issue, ${downVotes} votes`} aria-pressed={hasDownVoted} disabled={busy} onClick={() => userId ? onVote(issue, -1) : onAuth()}><ArrowDown size={17} /><span>{downVotes}</span></button>
        <button className="action-button" type="button" onClick={() => onOpen(issue)}><MessageCircle size={17} /><span>{comments} {comments === 1 ? 'comment' : 'comments'}</span></button>
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
  const category = issue.custom_category || issue.category?.name || 'Campus'
  const photo = path ? supabase.storage.from('issue-photos').getPublicUrl(path).data.publicUrl : `https://images.unsplash.com/${CATEGORY_IMAGES[category] ?? CATEGORY_IMAGES.Other}?auto=format&fit=crop&w=1200&q=82`
  return <img className={className} src={photo} alt={`${category} issue at ${issue.custom_location || issue.location?.name || 'campus'}`} />
}

export { STATUS_LABELS }
export type { CampusIssue }
export function CampusIssueCard() { return null }
