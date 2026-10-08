'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import useSWR, { mutate } from 'swr'
import {
  ArrowDown, ArrowLeft, ArrowUp, Bell, BookOpen, Building2, Camera, Check, ChevronDown,
  CircleHelp, Clock3, Compass, Flame, Heart, ImagePlus, LoaderCircle, LogIn, MapPin,
  MessageCircle, Plus, Search, Send, ShieldCheck, Sparkles, ThumbsUp, Users, X,
  type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import {
  CATEGORY_IMAGES, STATUS_LABELS, type AppView, type Campus, type CampusIssue,
  type Category, type IssueStatus,
} from '@/lib/campus'
import { IssueCard } from '@/components/campus/issue-card'
import { IssueDetail } from '@/components/campus/issue-detail'
import { ReportDialog } from '@/components/campus/report-dialog'
import { AuthDialog } from '@/components/campus/auth-dialog'

const supabase = createClient()
const ISSUE_SELECT = 'id,campus_id,reporter_id,category_id,location_id,department_id,title,description,building_area,faculty_tag,anonymous_public,status,created_at,updated_at,category:categories(name,icon,color),location:locations(name,building),department:departments(name),reporter:profiles(display_name,avatar_url),media:issue_media(storage_path,display_order),votes(value,user_id),affected_users(user_id),followers:issue_followers(user_id),comments(id)'

type ActivityItem = { id: string; title: string; body: string | null; kind: string; created_at: string; read_at: string | null; issue_id: string | null }
type Profile = { id: string; display_name: string; avatar_url: string | null; campus_id: string | null }

async function loadCampuses(): Promise<Campus[]> {
  const { data, error } = await supabase.from('campuses').select('id,name,city,region,slug').order('name')
  if (error) throw error
  return (data ?? []) as Campus[]
}

async function loadCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('id,name,icon,color').order('name')
  if (error) throw error
  return (data ?? []) as Category[]
}

async function loadIssues(campusId: string): Promise<CampusIssue[]> {
  const { data, error } = await supabase.from('issues').select(ISSUE_SELECT).eq('campus_id', campusId).order('created_at', { ascending: false }).limit(60)
  if (error) throw error
  return (data ?? []) as unknown as CampusIssue[]
}

function timeAgo(value: string) {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days < 7 ? `${days}d ago` : new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const navItems: { id: AppView; label: string; icon: LucideIcon }[] = [
  { id: 'home', label: 'Home', icon: Flame },
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'activity', label: 'Activity', icon: Bell },
  { id: 'profile', label: 'Profile', icon: Users },
]

export function CampusApp() {
  const [view, setView] = useState<AppView>('home')
  const [campusId, setCampusId] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportAfterAuth, setReportAfterAuth] = useState(false)
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [campusMenuOpen, setCampusMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const { data: campuses = [], error: campusError } = useSWR('campuses', loadCampuses)
  const { data: categories = [] } = useSWR('categories', loadCategories)
  const { data: issues = [], error: issueError, isLoading: issuesLoading } = useSWR(campusId ? ['issues', campusId] : null, ([, id]) => loadIssues(id))
  const { data: userIssues = [] } = useSWR(userId && campusId ? ['my-issues', userId, campusId] : null, async ([, uid, cid]) => {
    const { data, error } = await supabase.from('issues').select(ISSUE_SELECT).eq('reporter_id', uid).eq('campus_id', cid).order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as unknown as CampusIssue[]
  })
  const { data: activity = [], isLoading: activityLoading } = useSWR(userId && view === 'activity' ? ['activity', userId] : null, async ([, uid]) => {
    const { data, error } = await supabase.from('notifications').select('id,title,body,kind,created_at,read_at,issue_id').eq('user_id', uid).order('created_at', { ascending: false }).limit(40)
    if (error) throw error
    return (data ?? []) as ActivityItem[]
  })
  const { data: locations = [] } = useSWR(campusId ? ['locations', campusId] : null, async ([, cid]) => {
    const { data, error } = await supabase.from('locations').select('id,name,building').eq('campus_id', cid).order('name')
    if (error) throw error
    return data ?? []
  })
  const { data: departments = [] } = useSWR(campusId ? ['departments', campusId] : null, async ([, cid]) => {
    const { data, error } = await supabase.from('departments').select('id,name').eq('campus_id', cid).order('name')
    if (error) throw error
    return data ?? []
  })

  useEffect(() => {
    let active = true
    void supabase.auth.getUser().then(async ({ data }: { data: { user: User | null } }) => {
      if (!active) return
      const user = data.user
      setUserId(user?.id ?? null)
      if (!user) return
      const { data: row } = await supabase.from('profiles').select('id,display_name,avatar_url,campus_id').eq('id', user.id).maybeSingle()
      if (!active) return
      if (row) {
        setProfile(row as Profile)
        if (row.campus_id) setCampusId(row.campus_id)
      }
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUserId(session?.user.id ?? null)
      if (!session?.user) setProfile(null)
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!campusId && campuses.length) setCampusId(campuses[0].id)
  }, [campusId, campuses])

  const campus = campuses.find((item) => item.id === campusId) ?? campuses[0]
  const selectedIssue = issues.find((issue) => issue.id === selectedIssueId) ?? userIssues.find((issue) => issue.id === selectedIssueId) ?? null
  const filteredIssues = useMemo(() => {
    const base = view === 'profile' ? userIssues : issues
    const normalized = query.trim().toLowerCase()
    return base.filter((issue) => {
      const matchesText = !normalized || [issue.title, issue.description, issue.category?.name, issue.location?.name, issue.building_area, issue.department?.name].some((value) => value?.toLowerCase().includes(normalized))
      const matchesStatus = statusFilter === 'all' || issue.status === statusFilter
      const matchesCategory = categoryFilter === 'all' || issue.category?.name === categoryFilter
      return matchesText && matchesStatus && matchesCategory
    })
  }, [categoryFilter, issues, query, statusFilter, userIssues, view])

  const refreshIssues = useCallback(async () => {
    await mutate(['issues', campusId])
    if (userId) await mutate(['my-issues', userId, campusId])
  }, [campusId, userId])

  async function requireUser() {
    if (userId) return true
    setAuthOpen(true)
    return false
  }

  async function handleCampusChange(nextCampusId: string) {
    setCampusId(nextCampusId)
    setCampusMenuOpen(false)
    setNotice('Campus feed updated')
    if (userId) {
      const { data, error } = await supabase.from('profiles').update({ campus_id: nextCampusId }).eq('id', userId).select('id,display_name,avatar_url,campus_id').maybeSingle()
      if (!error && data) setProfile(data as Profile)
    }
    window.setTimeout(() => setNotice(''), 2600)
  }

  async function castVote(issue: CampusIssue, value: 1 | -1) {
    if (!await requireUser()) return
    setBusy(true)
    const existing = issue.votes.find((vote) => vote.user_id === userId)
    let error
    if (existing?.value === value) {
      ;({ error } = await supabase.from('votes').delete().eq('issue_id', issue.id).eq('user_id', userId!))
    } else {
      ;({ error } = await supabase.from('votes').upsert({ issue_id: issue.id, user_id: userId!, value }, { onConflict: 'issue_id,user_id' }))
    }
    setBusy(false)
    if (error) setNotice('Could not save your vote. Please try again.')
    else {
      await refreshIssues()
      await mutate(['my-vote', issue.id, userId])
    }
  }

  async function markAffected(issue: CampusIssue) {
    if (!await requireUser()) return
    setBusy(true)
    const affected = issue.affected_users.some((row) => row.user_id === userId)
    const { error } = affected
      ? await supabase.from('affected_users').delete().eq('issue_id', issue.id).eq('user_id', userId!)
      : await supabase.from('affected_users').insert({ issue_id: issue.id, user_id: userId! })
    setBusy(false)
    if (error) setNotice('Could not update your response.')
    else await refreshIssues()
  }

  async function toggleFollow(issue: CampusIssue) {
    if (!await requireUser()) return
    setBusy(true)
    const { data: existing, error: lookupError } = await supabase.from('issue_followers').select('issue_id').eq('issue_id', issue.id).eq('user_id', userId!).maybeSingle()
    if (lookupError) {
      setBusy(false)
      setNotice('Could not update follow status.')
      return
    }
    const { error } = existing
      ? await supabase.from('issue_followers').delete().eq('issue_id', issue.id).eq('user_id', userId!)
      : await supabase.from('issue_followers').insert({ issue_id: issue.id, user_id: userId! })
    setBusy(false)
    setNotice(error ? 'Could not update follow status.' : existing ? 'You unfollowed this report.' : 'You are following this report.')
    if (!error) {
      await refreshIssues()
      await mutate(['followers', issue.id, userId])
    }
    window.setTimeout(() => setNotice(''), 2600)
  }

  async function addComment(issueId: string, body: string, parentId?: string) {
    if (!await requireUser()) return false
    setBusy(true)
    const { error } = await supabase.from('comments').insert({ issue_id: issueId, user_id: userId!, body, parent_id: parentId ?? null })
    setBusy(false)
    if (error) {
      setNotice('Your comment could not be posted.')
      return false
    }
    await refreshIssues()
    await mutate(['comments', issueId])
    return true
  }

  async function markRead(notificationId: string) {
    const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notificationId)
    if (!error) await mutate(['activity', userId])
  }

  function openReport() {
    if (!userId) {
      setReportAfterAuth(true)
      setAuthOpen(true)
    } else if (!campusId) setNotice('Choose a campus before reporting a problem.')
    else setReportOpen(true)
  }

  const pageTitle = view === 'home' ? 'Campus feed' : view === 'explore' ? 'Explore issues' : view === 'activity' ? 'Activity' : 'Your profile'

  return (
    <div className="campus-app">
      <aside className="campus-sidebar" aria-label="Main navigation">
        <a className="brand-lockup" href="#home" onClick={(event) => { event.preventDefault(); setView('home') }}>
          <span className="brand-symbol"><Flame size={21} fill="currentColor" /></span>
          <span><strong>campus<span className="brand-hot">heat</span></strong><small>Better campus, together</small></span>
        </a>
        <div className="sidebar-campus-wrap">
          <span className="eyebrow">YOUR CAMPUS</span>
          <button className="campus-switcher" onClick={() => setCampusMenuOpen(!campusMenuOpen)} aria-expanded={campusMenuOpen}>
            <span className="campus-switcher-icon"><Building2 size={17} /></span>
            <span className="campus-switcher-copy"><strong>{campus?.name ?? 'Choose your campus'}</strong><small>{campus?.city ?? 'Select a campus'}</small></span>
            <ChevronDown size={16} />
          </button>
          {campusMenuOpen && <div className="campus-menu" role="listbox" aria-label="Choose campus">{campuses.map((item) => <button key={item.id} role="option" aria-selected={item.id === campusId} onClick={() => void handleCampusChange(item.id)}><span>{item.name}</span><small>{item.city}</small></button>)}</div>}
          {campusError && <p className="inline-error">Campuses could not be loaded.</p>}
        </div>
        <nav className="side-links" aria-label="Main">
          {navItems.map(({ id, label, icon: Icon }) => <button key={id} className={`side-link ${view === id ? 'active' : ''}`} onClick={() => setView(id)}><Icon size={19} /><span>{label}</span>{id === 'activity' && <span className="nav-dot" />}</button>)}
        </nav>
        <button className="sidebar-report" onClick={openReport}><Plus size={18} /> Report an issue</button>
        <div className="sidebar-bottom"><div className="sidebar-prompt"><span className="prompt-icon"><Sparkles size={17} /></span><strong>Small fixes. Big impact.</strong><span>See something that needs attention? Let your campus know.</span><button onClick={openReport}>Share a report <ArrowUp size={14} /></button></div>
          <button className="user-mini" onClick={() => userId ? setView('profile') : setAuthOpen(true)}><span className="avatar avatar-small">{profile?.display_name?.slice(0, 1).toUpperCase() ?? <Users size={15} />}</span><span><strong>{profile?.display_name ?? 'Join your campus'}</strong><small>{userId ? 'Student account' : 'Sign in or create an account'}</small></span><ChevronDown size={15} /></button>
        </div>
      </aside>

      <main className="main-column">
        <header className="mobile-header">
          <a className="brand-lockup compact" href="#home" onClick={(event) => { event.preventDefault(); setView('home') }}><span className="brand-symbol"><Flame size={19} fill="currentColor" /></span><strong>campus<span className="brand-hot">heat</span></strong></a>
          <button className="mobile-campus" onClick={() => setCampusMenuOpen(!campusMenuOpen)} aria-label={`Campus: ${campus?.name ?? 'Choose campus'}`}><MapPin size={15} />{campus?.city ?? 'Campus'}<ChevronDown size={14} /></button>
          <button className="icon-button mobile-notifications" onClick={() => userId ? setView('activity') : setAuthOpen(true)} aria-label="Notifications"><Bell size={19} /></button>
          {campusMenuOpen && <div className="campus-menu mobile-campus-menu" role="listbox" aria-label="Choose campus">{campuses.map((item) => <button key={item.id} role="option" aria-selected={item.id === campusId} onClick={() => void handleCampusChange(item.id)}><span>{item.name}</span><small>{item.city}</small></button>)}</div>}
        </header>

        {view === 'activity' ? (
          <section className="content-page activity-page">
            <PageHeading eyebrow="STAY IN THE LOOP" title={pageTitle} description="The latest updates on the issues you care about." />
            {!userId ? <SignInPrompt onSignIn={() => setAuthOpen(true)} /> : activityLoading ? <LoadingState /> : activity.length === 0 ? <EmptyState icon={Bell} title="You're all caught up" body="Updates about reports you follow will show up here." /> : <div className="activity-list">{activity.map((item) => <button key={item.id} className={`activity-item ${item.read_at ? '' : 'unread'}`} onClick={() => { if (item.issue_id) setSelectedIssueId(item.issue_id); if (!item.read_at) void markRead(item.id) }}><span className="activity-icon"><Bell size={18} /></span><span className="activity-copy"><strong>{item.title}</strong>{item.body && <span>{item.body}</span>}<small>{timeAgo(item.created_at)}</small></span>{!item.read_at && <span className="unread-dot" />}</button>)}</div>}
          </section>
        ) : view === 'profile' ? (
          <section className="content-page profile-page">
            <PageHeading eyebrow="YOUR CAMPUS FOOTPRINT" title={pageTitle} description="Every report is a step toward a better campus." />
            {!userId ? <SignInPrompt onSignIn={() => setAuthOpen(true)} /> : <><div className="profile-card"><span className="avatar avatar-large">{profile?.display_name?.slice(0, 1).toUpperCase() ?? 'S'}</span><div><h2>{profile?.display_name ?? 'Campus student'}</h2><p>{campus?.name} · {campus?.city}</p><button className="text-button" onClick={() => void supabase.auth.signOut()}>Sign out</button></div></div><div className="section-title-row"><div><span className="eyebrow">YOUR CONTRIBUTIONS</span><h2>My reports <span className="count-pill">{userIssues.length}</span></h2></div><button className="text-button" onClick={openReport}><Plus size={15} /> New report</button></div>{filteredIssues.length === 0 ? <EmptyState icon={Camera} title="Your story starts here" body="Report a campus issue and help get it on the right people's radar." action={<button className="button-primary small" onClick={openReport}>Report an issue</button>} /> : <div className="feed-list">{filteredIssues.map((issue) => <IssueCard key={issue.id} issue={issue} onOpen={() => setSelectedIssueId(issue.id)} onVote={(item, value) => castVote(item, value)} onAffected={markAffected} onFollow={toggleFollow} onAuth={() => setAuthOpen(true)} userId={userId} busy={busy} />)}</div>}</>}
          </section>
        ) : (
          <>
            <section className="welcome-panel">
              <div className="welcome-copy"><span className="welcome-kicker"><span className="live-dot" /> YOUR CAMPUS, YOUR VOICE</span><h1>A better campus<br />starts <em>with us.</em></h1><p>Spot something that needs fixing? Share it with your campus community and help make change happen.</p><button className="button-primary welcome-cta" onClick={openReport}><Plus size={18} /> Report a problem</button></div>
              <div className="welcome-art" aria-hidden="true"><div className="art-sun" /><div className="art-ground ground-back" /><div className="art-ground ground-front" /><div className="art-building building-one"><span /><span /><span /><span /></div><div className="art-building building-two"><span /><span /><span /></div><div className="art-tree tree-one" /><div className="art-tree tree-two" /><div className="art-path" /><span className="art-spark spark-one">✳</span><span className="art-spark spark-two">✳</span><div className="art-note"><span><Flame size={14} fill="currentColor" /></span><strong>Good change<br />is contagious.</strong></div></div>
            </section>

            <section className="feed-content">
              <div className="feed-heading"><div><span className="eyebrow">{view === 'explore' ? 'FIND WHAT NEEDS ATTENTION' : 'HAPPENING AROUND YOU'}</span><h2>{view === 'explore' ? 'Explore campus' : 'The campus pulse'} <span className="flame-count"><Flame size={17} fill="currentColor" /> {issues.length}</span></h2><p>{view === 'explore' ? 'Search reports, browse categories, and find an issue you can help move forward.' : 'Real issues. Real people. Real progress.'}</p></div><button className="desktop-report-inline" onClick={openReport}><Plus size={17} /> New report</button></div>
              <div className="feed-toolbar">
                <div className="feed-tabs" role="tablist" aria-label="Feed type"><button role="tab" aria-selected={statusFilter === 'all'} className={statusFilter === 'all' ? 'selected' : ''} onClick={() => setStatusFilter('all')}>For you</button><button role="tab" aria-selected={statusFilter === 'in_progress'} className={statusFilter === 'in_progress' ? 'selected' : ''} onClick={() => setStatusFilter('in_progress')}>In progress</button><button role="tab" aria-selected={statusFilter === 'resolved'} className={statusFilter === 'resolved' ? 'selected' : ''} onClick={() => setStatusFilter('resolved')}>Resolved</button></div>
                <div className="search-wrap"><Search size={16} /><input aria-label="Search campus issues" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search issues" /></div>
              </div>
              <div className="category-chips" aria-label="Filter by category"><button className={categoryFilter === 'all' ? 'chosen' : ''} onClick={() => setCategoryFilter('all')}>All issues</button>{categories.map((item) => <button key={item.id} className={categoryFilter === item.name ? 'chosen' : ''} onClick={() => setCategoryFilter(categoryFilter === item.name ? 'all' : item.name)}>{item.name}</button>)}</div>
              {issueError ? <EmptyState icon={CircleHelp} title="Couldn't load the campus feed" body="Check your connection and try again." action={<button className="text-button" onClick={() => void mutate(['issues', campusId])}>Try again</button>} /> : issuesLoading ? <LoadingState /> : filteredIssues.length === 0 ? <EmptyState icon={Search} title="No issues found" body={query || categoryFilter !== 'all' || statusFilter !== 'all' ? 'Try another search or clear your filters.' : 'Be the first to report something that needs attention.'} action={query || categoryFilter !== 'all' || statusFilter !== 'all' ? <button className="text-button" onClick={() => { setQuery(''); setCategoryFilter('all'); setStatusFilter('all') }}>Clear filters</button> : <button className="button-primary small" onClick={openReport}>Report an issue</button>} /> : <div className="feed-list">{filteredIssues.map((issue) => <IssueCard key={issue.id} issue={issue} onOpen={() => setSelectedIssueId(issue.id)} onVote={(item, value) => castVote(item, value)} onAffected={markAffected} onFollow={toggleFollow} onAuth={() => setAuthOpen(true)} userId={userId} busy={busy} />)}</div>}
              <div className="feed-footer"><span>Showing {filteredIssues.length} of {issues.length} reports</span><span>Made for students, by students <Heart size={12} fill="currentColor" /></span></div>
            </section>
          </>
        )}
      </main>

      <aside className="right-column" aria-label="Campus highlights">
        <div className="right-top"><button className="icon-button notification-button" onClick={() => userId ? setView('activity') : setAuthOpen(true)} aria-label="Open activity"><Bell size={18} /></button>{userId ? <button className="user-chip" onClick={() => setView('profile')}><span className="avatar avatar-tiny">{profile?.display_name?.slice(0, 1).toUpperCase() ?? 'S'}</span>{profile?.display_name ?? 'Student'}</button> : <button className="sign-in-button" onClick={() => setAuthOpen(true)}><LogIn size={15} /> Sign in</button>}</div>
        <section className="campus-card"><div className="campus-card-top"><span className="campus-card-icon"><Building2 size={17} /></span><span className="eyebrow">YOUR CAMPUS</span><button aria-label="Change campus" onClick={() => setCampusMenuOpen(!campusMenuOpen)}><ChevronDown size={16} /></button></div><h2>{campus?.name ?? 'Campus community'}</h2><p><MapPin size={14} />{campus?.city ?? 'Choose your campus'}</p><div className="campus-stats"><div><strong>{issues.length}</strong><span>open reports</span></div><div><strong>{issues.filter((issue) => issue.status === 'resolved').length}</strong><span>resolved</span></div></div><button className="campus-card-link" onClick={() => setView('explore')}>Explore campus <ArrowUp size={14} /></button></section>
        <section className="progress-card"><div className="side-section-heading"><div><span className="eyebrow">COMMUNITY MOMENTUM</span><h3>Good things move.</h3></div><Sparkles size={17} /></div><div className="progress-metric"><strong>{issues.reduce((total, issue) => total + issue.affected_users.length, 0)}</strong><span>students have spoken up</span></div><div className="progress-bar"><span style={{ width: `${Math.min(100, Math.max(16, issues.length ? (issues.filter((issue) => issue.status === 'resolved').length / issues.length) * 100 : 16))}%` }} /></div><div className="progress-foot"><span>Campus follow-through</span><span>{issues.length ? Math.round((issues.filter((issue) => issue.status === 'resolved').length / issues.length) * 100) : 0}%</span></div></section>
        <section className="trending-section"><div className="side-section-heading"><div><span className="eyebrow">PICKING UP STEAM</span><h3>Most discussed</h3></div><Flame size={17} fill="currentColor" /></div>{issues.slice().sort((a, b) => b.comments.length + b.affected_users.length - a.comments.length - a.affected_users.length).slice(0, 3).map((issue, index) => <button key={issue.id} className="trending-item" onClick={() => setSelectedIssueId(issue.id)}><span className={`trending-rank ${index === 0 ? 'hot' : ''}`}>0{index + 1}</span><span><strong>{issue.title}</strong><small><MessageCircle size={12} /> {issue.comments.length} comments · {timeAgo(issue.created_at)}</small></span><ArrowUp size={14} /></button>)}</section>
        <div className="community-note"><ShieldCheck size={17} /><span><strong>Real people. Real progress.</strong><small>Keep it kind, constructive, and campus-focused.</small></span></div>
        <footer className="right-footer"><span>© 2026 campusheat</span><span>Community first <Flame size={12} /></span></footer>
      </aside>

      <nav className="mobile-nav" aria-label="Mobile navigation">{navItems.slice(0, 2).map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}><Icon size={20} /><span>{label}</span></button>)}<button className="mobile-report-button" onClick={openReport} aria-label="Report an issue"><span><Plus size={23} /></span><small>Report</small></button>{navItems.slice(2).map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? 'active' : ''} onClick={() => userId ? setView(id) : setAuthOpen(true)}><Icon size={20} /><span>{label}</span></button>)}</nav>

      {notice && <div className="toast-message" role="status">{notice}</div>}
      {reportOpen && <ReportDialog campusId={campusId} categories={categories} locations={locations} departments={departments} onClose={() => setReportOpen(false)} onRequireAuth={() => setAuthOpen(true)} onCreated={async (warning) => { setReportOpen(false); setView('home'); await refreshIssues(); setNotice(warning ?? 'Your report is live. Thanks for speaking up.'); window.setTimeout(() => setNotice(''), 3200) }} />}
      {authOpen && <AuthDialog onClose={() => { setAuthOpen(false); setReportAfterAuth(false) }} onAuthenticated={async (uid, displayName) => { setUserId(uid); const { data } = await supabase.from('profiles').select('id,display_name,avatar_url,campus_id').eq('id', uid).maybeSingle(); if (data) setProfile(data as Profile); else if (displayName) setProfile({ id: uid, display_name: displayName, avatar_url: null, campus_id: null }); setAuthOpen(false); if (reportAfterAuth) { setReportAfterAuth(false); setReportOpen(true) } }} />}
      {selectedIssue && <IssueDetail issue={selectedIssue} userId={userId} onClose={() => setSelectedIssueId(null)} onVote={castVote} onAffected={markAffected} onFollow={toggleFollow} onComment={addComment} busy={busy} onRequireAuth={() => setAuthOpen(true)} />}
    </div>
  )
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-heading"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
}

function SignInPrompt({ onSignIn }: { onSignIn: () => void }) {
  return <div className="sign-in-prompt"><span className="prompt-icon large"><Users size={20} /></span><h2>Your campus community is waiting.</h2><p>Sign in to see your contributions, follow updates, and stay connected.</p><button className="button-primary small" onClick={onSignIn}><LogIn size={15} /> Sign in or join</button></div>
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={21} /></span><h3>{title}</h3><p>{body}</p>{action}</div>
}

function LoadingState() {
  return <div className="loading-state" aria-label="Loading issues"><LoaderCircle size={22} className="spin" /><span>Finding the campus pulse…</span></div>
}

export function getIssueImage(issue: CampusIssue) {
  const path = issue.media?.slice().sort((a, b) => a.display_order - b.display_order)[0]?.storage_path
  if (path) return supabase.storage.from('issue-photos').getPublicUrl(path).data.publicUrl
  const photo = CATEGORY_IMAGES[issue.category?.name ?? 'Other'] ?? CATEGORY_IMAGES.Other
  return `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=1000&q=82`
}

export { STATUS_LABELS, timeAgo }
export type { IssueStatus }

export default CampusApp
