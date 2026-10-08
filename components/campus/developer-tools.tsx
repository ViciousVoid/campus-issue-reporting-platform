'use client'

import { useEffect, useMemo, useState } from 'react'
import useSWR, { mutate } from 'swr'
import { ArrowDown, ArrowUp, LoaderCircle, ShieldCheck, Trash2, Undo2, Wrench } from 'lucide-react'
type DeveloperIssue = {
  id: string
  title: string
  created_at: string
  severity: string | null
  developer_upvote_override: number | null
  developer_downvote_override: number | null
  votes: { value: number }[]
}

async function loadDeveloperIssues(campusId: string): Promise<DeveloperIssue[]> {
  const response = await fetch(`/api/developer/issues?campusId=${encodeURIComponent(campusId)}`)
  const result = await response.json().catch(() => null)
  if (!response.ok) throw new Error(result?.error ?? 'Campus reports could not be loaded.')
  return result as DeveloperIssue[]
}

export function DeveloperTools({ campusId }: { campusId: string }) {
  const { data: issues = [], error, isLoading } = useSWR(campusId ? ['developer-issues', campusId] : null, ([, id]) => loadDeveloperIssues(id))
  const [selectedId, setSelectedId] = useState('')
  const [upvotes, setUpvotes] = useState('0')
  const [downvotes, setDownvotes] = useState('0')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const selected = issues.find((issue) => issue.id === selectedId) ?? issues[0]
  const actualUpvotes = useMemo(() => selected?.votes.filter((vote) => vote.value === 1).length ?? 0, [selected])
  const actualDownvotes = useMemo(() => selected?.votes.filter((vote) => vote.value === -1).length ?? 0, [selected])

  useEffect(() => {
    if (!selected) return
    setSelectedId(selected.id)
    setUpvotes(String(selected.developer_upvote_override ?? actualUpvotes))
    setDownvotes(String(selected.developer_downvote_override ?? actualDownvotes))
  }, [actualDownvotes, actualUpvotes, selected])

  async function save(action: 'set_vote_counts' | 'reset_vote_counts' | 'delete_issue') {
    if (!selected) return
    if (action === 'delete_issue' && !window.confirm(`Delete “${selected.title}”? This permanently removes the report and its related activity.`)) return
    setBusy(true)
    setNotice('')
    try {
      const body = action === 'set_vote_counts'
        ? { action, issueId: selected.id, upvotes: Number(upvotes), downvotes: Number(downvotes) }
        : { action, issueId: selected.id }
      const response = await fetch('/api/developer/issues', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error ?? 'That developer action could not be saved.')
      await Promise.all([
        mutate(['developer-issues', campusId]),
        mutate(['issues', campusId]),
        mutate((key) => Array.isArray(key) && key[0] === 'my-issues' && key[2] === campusId),
      ])
      setNotice(result.warning ?? (action === 'delete_issue' ? 'Report deleted.' : action === 'reset_vote_counts' ? 'Real vote totals restored.' : 'Display vote counts updated.'))
      if (action === 'delete_issue') setSelectedId('')
    } catch (saveError) {
      setNotice(saveError instanceof Error ? saveError.message : 'That developer action could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="content-page developer-page">
      <div className="page-heading"><span className="eyebrow">ADMIN-ONLY SANDBOX</span><h1>Developer options</h1><p>Test report states and interface counts without changing real community votes.</p></div>
      <div className="developer-security-note"><ShieldCheck size={17} /><span>Protected by a server-side campus administrator check. Changes apply only to this campus.</span></div>
      {isLoading ? <div className="loading-state"><LoaderCircle size={20} className="spin" /><span>Loading campus reports…</span></div> : error ? <div className="empty-state" role="alert"><h3>Couldn&apos;t load developer controls</h3><p>{error.message}</p></div> : issues.length === 0 ? <div className="empty-state"><Wrench size={20} /><h3>No reports to test yet</h3><p>Campus reports will appear here when they&apos;re available.</p></div> : (
        <div className="developer-panel">
          <label className="form-field"><span>Select a report</span><select value={selected?.id ?? ''} onChange={(event) => setSelectedId(event.target.value)}>{issues.map((issue) => <option key={issue.id} value={issue.id}>{issue.title}</option>)}</select></label>
          {selected && <>
            <div className="developer-selected-meta"><span>{selected.severity ?? 'medium'} severity</span><time dateTime={selected.created_at}>{new Date(selected.created_at).toLocaleString()}</time></div>
            <div className="developer-count-grid">
              <label><span>Upvotes to display</span><div><ArrowUp size={16} /><input type="number" min="0" max="1000000" step="1" value={upvotes} onChange={(event) => setUpvotes(event.target.value)} /></div><small>Actual: {actualUpvotes}{selected.developer_upvote_override !== null ? ' · override active' : ''}</small></label>
              <label><span>Downvotes to display</span><div><ArrowDown size={16} /><input type="number" min="0" max="1000000" step="1" value={downvotes} onChange={(event) => setDownvotes(event.target.value)} /></div><small>Actual: {actualDownvotes}{selected.developer_downvote_override !== null ? ' · override active' : ''}</small></label>
            </div>
            <div className="developer-actions"><button type="button" className="button-primary small" disabled={busy || !upvotes.trim() || !downvotes.trim() || !Number.isInteger(Number(upvotes)) || !Number.isInteger(Number(downvotes)) || Number(upvotes) < 0 || Number(downvotes) < 0 || Number(upvotes) > 1000000 || Number(downvotes) > 1000000} onClick={() => void save('set_vote_counts')}>{busy ? <LoaderCircle size={15} className="spin" /> : <Wrench size={15} />}Save test counts</button><button type="button" className="button-secondary" disabled={busy || (selected.developer_upvote_override === null && selected.developer_downvote_override === null)} onClick={() => void save('reset_vote_counts')}><Undo2 size={15} /> Restore real counts</button></div>
            <div className="developer-delete-row"><div><strong>Remove this report</strong><span>Deletes this report and its related comments, votes, and updates.</span></div><button type="button" className="developer-delete-button" disabled={busy} onClick={() => void save('delete_issue')}><Trash2 size={15} />Delete report</button></div>
          </>}
        </div>
      )}
      {notice && <p className="developer-notice" role="status">{notice}</p>}
    </section>
  )
}
