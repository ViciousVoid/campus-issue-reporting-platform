import type { CampusIssue } from '@/lib/campus'

export type HeatThresholds = { hot: number; very_hot: number; critical: number; priority: number }
export type HeatLevel = 'normal' | 'hot' | 'very_hot' | 'critical' | 'blue_flame'

export const DEFAULT_HEAT_THRESHOLDS: HeatThresholds = {
  hot: 20,
  very_hot: 45,
  critical: 70,
  priority: 100,
}

export const HEAT_LABELS: Record<HeatLevel, string> = {
  normal: 'Normal',
  hot: 'Hot',
  very_hot: 'Very hot',
  critical: 'Critical',
  blue_flame: 'Campus priority',
}

export function scoreIssueHeat(issue: CampusIssue, recurrenceCount = 0, now = Date.now()) {
  const votes = issue.votes ?? []
  const voteScore = Math.max(0, votes.filter((vote) => vote.value === 1).length - votes.filter((vote) => vote.value === -1).length) * 1.5
  const affectedScore = (issue.affected_users?.length ?? 0) * 3
  const severityScore: Record<string, number> = { low: 0, medium: 8, high: 18, critical: 32 }
  const severity = severityScore[issue.severity ?? 'medium'] ?? 8
  const updatedHours = Math.max(0, (now - new Date(issue.updated_at || issue.created_at).getTime()) / 3_600_000)
  const recentActivity = updatedHours < 24 ? 18 : updatedHours < 168 ? 10 : updatedHours < 720 ? 4 : 0
  const unresolvedDays = issue.status === 'resolved' ? 0 : Math.max(0, (now - new Date(issue.created_at).getTime()) / 86_400_000)
  const unresolvedScore = Math.min(28, unresolvedDays * 1.4)
  const recurrenceScore = Math.min(36, Math.max(0, recurrenceCount) * 12)
  return Math.round(voteScore + affectedScore + severity + recentActivity + unresolvedScore + recurrenceScore)
}

export function getHeatLevel(score: number, thresholds: HeatThresholds = DEFAULT_HEAT_THRESHOLDS): HeatLevel {
  if (score >= thresholds.priority) return 'blue_flame'
  if (score >= thresholds.critical) return 'critical'
  if (score >= thresholds.very_hot) return 'very_hot'
  if (score >= thresholds.hot) return 'hot'
  return 'normal'
}

export function getIssueRecurrenceCount(issue: CampusIssue, issues: CampusIssue[]) {
  return issues.filter((other) => other.id !== issue.id && (
    other.duplicate_of === issue.id || issue.duplicate_of === other.id
  )).length
}

export function getHeatThresholds(value: unknown): HeatThresholds {
  if (!value || typeof value !== 'object') return DEFAULT_HEAT_THRESHOLDS
  const candidate = value as Partial<HeatThresholds>
  const thresholds = {
    hot: Number(candidate.hot),
    very_hot: Number(candidate.very_hot),
    critical: Number(candidate.critical),
    priority: Number(candidate.priority),
  }
  const valid = Object.values(thresholds).every((number) => Number.isFinite(number) && number >= 1 && number <= 1000)
  return valid && thresholds.hot < thresholds.very_hot && thresholds.very_hot < thresholds.critical && thresholds.critical < thresholds.priority
    ? thresholds
    : DEFAULT_HEAT_THRESHOLDS
}

export function getHeatValues(score: number, thresholds: HeatThresholds) {
  return { score, level: getHeatLevel(score, thresholds), label: HEAT_LABELS[getHeatLevel(score, thresholds)] }
}

export type { CampusIssue }
