'use client'

import { useMemo, useState } from 'react'
import { ArrowUpRight, Check, Flame, LoaderCircle, ShieldAlert, ShieldCheck, X } from 'lucide-react'
import type { CampusIssue, Category, IssueStatus } from '@/lib/campus'
import { DEFAULT_HEAT_THRESHOLDS, getHeatLevel, getHeatThresholds, getIssueRecurrenceCount, HEAT_LABELS, scoreIssueHeat, type HeatThresholds } from '@/lib/campus-heat'
import { statusStyles } from '@/components/campus/issue-card'

type Option = { id: string; name: string; building?: string | null }
type ModeratorOption = { user_id: string; role: string; display_name: string }
type Props = {
  campusId: string
  issues: CampusIssue[]
  categories: Category[]
  locations: Option[]
  departments: Option[]
  moderators: ModeratorOption[]
  thresholds: HeatThresholds
  onOpenIssue: (issueId: string) => void
  onChanged: () => void | Promise<void>
  isAdmin: boolean
}

const statuses: IssueStatus[] = ['reported', 'verified', 'acknowledged', 'in_progress', 'resolved', 'reopened']

async function runWorkflow(payload: Record<string, unknown>) {
  const response = await fetch('/api/issue-intelligence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error ?? 'Could not complete that action.')
  return result
}

function topCounts(issues: CampusIssue[], labelFor: (issue: CampusIssue) => string) {
  const counts = new Map<string, number>()
  for (const issue of issues) {
    const label = labelFor(issue) || 'Unassigned'
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
}

export function ModeratorDashboard({ campusId, issues, categories, locations, departments, moderators, thresholds, onOpenIssue, onChanged, isAdmin }: Props) {
  const [filter, setFilter] = useState<'active' | 'moderation' | 'all'>('active')
  const [mergeTargets, setMergeTargets] = useState<Record<string, string>>({})
  const [draftThresholds, setDraftThresholds] = useState<HeatThresholds>(thresholds ?? DEFAULT_HEAT_THRESHOLDS)
  const [busyId, setBusyId] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const activeIssues = issues.filter((issue) => issue.status !== 'resolved' && issue.moderation_status === 'approved')
  const moderationQueue = issues.filter((issue) => issue.moderation_status === 'pending' || issue.moderation_status === 'rejected')
  const heatRows = useMemo(() => issues.map((issue) => ({ issue, score: scoreIssueHeat(issue, getIssueRecurrenceCount(issue, issues)), level: getHeatLevel(scoreIssueHeat(issue, getIssueRecurrenceCount(issue, issues)), thresholds) })), [issues, thresholds])
  const criticalIssues = heatRows.filter((row) => row.level === 'critical' || row.level === 'blue_flame')
  const resolvedRows = issues.filter((issue) => issue.status === 'resolved' && issue.resolved_at)
  const averageResolutionDays = resolvedRows.length ? resolvedRows.reduce((total, issue) => total + (new Date(issue.resolved_at!).getTime() - new Date(issue.created_at).getTime()) / 86_400_000, 0) / resolvedRows.length : null
  const visibleIssues = filter === 'moderation' ? moderationQueue : filter === 'active' ? activeIssues : issues
  const byCategory = topCounts(issues, (issue) => issue.custom_category || issue.category?.name || categories.find((category) => category.id === issue.category_id)?.name || '')
  const byLocation = topCounts(issues, (issue) => issue.custom_location || issue.location?.name || locations.find((location) => location.id === issue.location_id)?.name || '')
  const byDepartment = topCounts(issues, (issue) => issue.custom_department || issue.department?.name || departments.find((department) => department.id === issue.department_id)?.name || '')

  async function act(issueId: string, payload: Record<string, unknown>, success: string) {
    setBusyId(issueId)
    setError('')
    setNotice('')
    try {
      await runWorkflow({ issueId, ...payload })
      setNotice(success)
      await onChanged()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not complete that action.')
    } finally {
      setBusyId('')
    }
  }

  async function saveThresholds() {
    setBusyId('thresholds')
    setError('')
    setNotice('')
    try {
      await runWorkflow({ action: 'update_heat_settings', campusId, thresholds: draftThresholds })
      setNotice('Heat thresholds updated.')
      await onChanged()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not save heat thresholds.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <section className="content-page moderator-page">
      <div className="page-heading"><span className="eyebrow">CAMPUS OPERATIONS</span><h1>Moderator dashboard</h1><p>Review reports, route work, and keep follow-through visible.</p></div>
      <div className="admin-stat-grid">
        <button className="admin-stat-card" onClick={() => setFilter('active')}><span><Flame size={16} /> Active high heat</span><strong>{heatRows.filter((row) => row.issue.status !== 'resolved' && row.score >= thresholds.hot).length}</strong></button>
        <button className="admin-stat-card critical" onClick={() => setFilter('active')}><span><ShieldAlert size={16} /> Critical / priority</span><strong>{criticalIssues.length}</strong></button>
        <button className="admin-stat-card moderation" onClick={() => setFilter('moderation')}><span><ShieldCheck size={16} /> Needs moderation</span><strong>{moderationQueue.length}</strong></button>
        <div className="admin-stat-card"><span>Average resolution</span><strong>{averageResolutionDays === null ? '—' : `${averageResolutionDays.toFixed(1)}d`}</strong></div>
      </div>

      <div className="admin-breakdown-grid">
        <Breakdown title="By category" rows={byCategory} />
        <Breakdown title="By location" rows={byLocation} />
        <Breakdown title="By department" rows={byDepartment} />
      </div>

      <section className="admin-panel">
        <div className="admin-panel-heading"><div><span className="eyebrow">QUEUE</span><h2>Issue operations</h2></div><div className="admin-filter-tabs"><button className={filter === 'active' ? 'selected' : ''} onClick={() => setFilter('active')}>Active</button><button className={filter === 'moderation' ? 'selected' : ''} onClick={() => setFilter('moderation')}>Moderation</button><button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>All</button></div></div>
        {visibleIssues.length === 0 ? <p className="admin-empty">No issues in this queue right now.</p> : <div className="admin-issue-list">{visibleIssues.map((issue) => {
          const heat = scoreIssueHeat(issue, getIssueRecurrenceCount(issue, issues))
          const level = getHeatLevel(heat, thresholds)
          const mergeTarget = mergeTargets[issue.id] ?? ''
          const candidates = issues.filter((candidate) => candidate.id !== issue.id && candidate.moderation_status === 'approved' && !candidate.duplicate_of)
          return <article className="admin-issue" key={issue.id}>
            <div className="admin-issue-title-row"><div><span className={`admin-heat-badge heat-${level}`}>{level === 'normal' ? null : <Flame size={13} fill="currentColor" />}{HEAT_LABELS[level]} · {heat}</span><button className="admin-issue-title" onClick={() => onOpenIssue(issue.id)}>{issue.title}<ArrowUpRight size={13} /></button><p>{issue.custom_location || issue.location?.name || issue.building_area || 'Campus-wide'} · {issue.custom_category || issue.category?.name || 'Campus issue'} · {issue.severity}</p></div><span className={`status-pill admin-status ${statusStyles[issue.status]}`}>{issue.status.replace('_', ' ')}</span></div>
            {(issue.moderation_status === 'pending' || issue.moderation_status === 'rejected') && <div className="admin-moderation-row"><span>{issue.moderation_reason || 'Awaiting campus review'}</span><button className="button-primary small" disabled={busyId === issue.id} onClick={() => void act(issue.id, { action: 'moderate_issue', outcome: 'approved' }, 'Report approved.')}>{busyId === issue.id ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />} Approve</button><button className="button-secondary small" disabled={busyId === issue.id} onClick={() => void act(issue.id, { action: 'moderate_issue', outcome: 'rejected', reason: 'Rejected by campus moderation.' }, 'Report rejected.')}><X size={14} /> Reject</button></div>}
            <div className="admin-controls-grid">
              <label><span>Status</span><select value={issue.status} disabled={busyId === issue.id} onChange={(event) => void act(issue.id, { action: 'set_status', status: event.target.value as IssueStatus, departmentId: issue.department_id ?? null }, 'Issue status updated.')}>{statuses.map((status) => <option value={status} key={status}>{status.replace('_', ' ')}</option>)}</select></label>
              <label><span>Department assignment</span><select value={issue.department_id ?? ''} disabled={busyId === issue.id} onChange={(event) => void act(issue.id, { action: 'set_status', status: issue.status, departmentId: event.target.value || null }, 'Department assignment updated.')}><option value="">Unassigned</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
              <label><span>Assign moderator</span><select value={issue.assigned_to ?? ''} disabled={busyId === issue.id} onChange={(event) => void act(issue.id, { action: 'set_status', status: issue.status, departmentId: issue.department_id ?? null, assignedTo: event.target.value || null }, 'Issue assignee updated.')}><option value="">Unassigned</option>{moderators.map((moderator) => <option key={moderator.user_id} value={moderator.user_id}>{moderator.display_name}{moderator.role === 'admin' ? ' · admin' : ''}</option>)}</select></label>
              {issue.duplicate_of ? <div className="merged-note">Linked as duplicate</div> : <label><span>Merge duplicate into</span><span className="merge-control"><select value={mergeTarget} onChange={(event) => setMergeTargets((current) => ({ ...current, [issue.id]: event.target.value }))}><option value="">Choose canonical issue</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title}</option>)}</select><button className="button-secondary small" disabled={!mergeTarget || busyId === issue.id} onClick={() => void act(issue.id, { action: 'merge_duplicate', targetIssueId: mergeTarget }, 'Duplicate linked to the canonical report.')}>Merge</button></span></label>}
            </div>
          </article>
        })}</div>}
      </section>

      {isAdmin && <section className="admin-panel heat-settings-panel"><div className="admin-panel-heading"><div><span className="eyebrow">CAMPUS CONFIGURATION</span><h2>Heat score thresholds</h2></div></div><p>Thresholds are applied in order and update issue-card flame levels across this campus.</p><div className="threshold-grid">{([['hot', 'Hot'], ['very_hot', 'Very hot'], ['critical', 'Critical'], ['priority', 'Campus priority']] as const).map(([key, label]) => <label key={key}><span>{label}</span><input type="number" min={1} max={1000} value={draftThresholds[key]} onChange={(event) => setDraftThresholds((current) => ({ ...current, [key]: Number(event.target.value) }))} /></label>)}</div><button className="button-primary small" disabled={busyId === 'thresholds' || !(draftThresholds.hot < draftThresholds.very_hot && draftThresholds.very_hot < draftThresholds.critical && draftThresholds.critical < draftThresholds.priority)} onClick={() => void saveThresholds()}>{busyId === 'thresholds' ? <LoaderCircle size={14} className="spin" /> : null}Save thresholds</button></section>}
      {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="admin-notice" role="status">{notice}</p>}
    </section>
  )
}

function Breakdown({ title, rows }: { title: string; rows: [string, number][] }) {
  return <section className="admin-breakdown"><h3>{title}</h3>{rows.length ? rows.map(([label, count]) => <div key={label}><span>{label}</span><strong>{count}</strong></div>) : <p>No data yet.</p>}</section>
}

export default ModeratorDashboard
