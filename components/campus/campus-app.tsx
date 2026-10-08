'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import useSWR, { mutate } from 'swr'
import {
  ArrowDown, ArrowLeft, ArrowUp, Bell, BookOpen, Building2, Camera, Check, ChevronDown,
  CircleHelp, Clock3, Compass, Flame, ImagePlus, LoaderCircle, LogIn, MapPin, MessageCircle,
  Moon, Plus, Search, Send, ShieldCheck, Sun, ThumbsUp, Users, Wrench, X,
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
import { CampusChat } from '@/components/campus/campus-chat'
import { ReportDialog } from '@/components/campus/report-dialog'
import { AuthDialog } from '@/components/campus/auth-dialog'
import { ModeratorDashboard } from '@/components/campus/moderator-dashboard'
import { DEFAULT_HEAT_THRESHOLDS, getHeatLevel, getHeatThresholds, getIssueRecurrenceCount, scoreIssueHeat, type HeatThresholds } from '@/lib/campus-heat'
import { CampusMap } from '@/components/campus/campus-map'
import { DeveloperTools } from '@/components/campus/developer-tools'
import { CampusHeroArt } from '@/components/campus/campus-hero-art'

const supabase = createClient()
const ISSUE_SELECT = 'id,campus_id,reporter_id,category_id,location_id,department_id,title,description,building_area,faculty_tag,anonymous_public,status,severity,latitude,longitude,developer_upvote_override,developer_downvote_override,moderation_status,moderation_reason,duplicate_of,custom_category,custom_location,custom_department,problem_type,assigned_to,resolved_at,resolution_verification,created_at,updated_at,category:categories(name,icon,color),location:locations(name,building),department:departments(name),media:issue_media(storage_path,display_order,uploaded_by),votes(value,user_id),affected_users(user_id),followers:issue_followers(user_id),comments(id,created_at)'

type ActivityItem = { id: string; title: string; body: string | null; kind: string; created_at: string; read_at: string | null; issue_id: string | null }
type Profile = { id: string; display_name: string; avatar_url: string | null; campus_id: string | null }
type CampusLocation = { id: string; name: string; building: string | null }

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

const mobileNavItems: { id: AppView; label: string; icon: LucideIcon }[] = [
  { id: 'home', label: 'Home', icon: Flame },
  { id: 'activity', label: 'Activity', icon: Bell },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
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
  const [chatExpanded, setChatExpanded] = useState(false)
  const [chatHeight, setChatHeight] = useState(84)
  const [mapFocusIssueId, setMapFocusIssueId] = useState<string | null>(null)
  const [mapScrollIssueId, setMapScrollIssueId] = useState<string | null>(null)
  const mapPanelRef = useRef<HTMLElement | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [fireOnly, setFireOnly] = useState(false)
  const [campusMenuOpen, setCampusMenuOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [heroImageUploading, setHeroImageUploading] = useState(false)
  const [notice, setNotice] = useState('')
  const [isDarkMode, setIsDarkMode] = useState(false)

  const { data: campuses = [], error: campusError } = useSWR('campuses', loadCampuses)
  const { data: categories = [] } = useSWR('categories', loadCategories)
  const { data: campusHeroImagePath } = useSWR(campusId ? ['campus-hero-image', campusId] : null, async ([, id]) => {
    const { data, error } = await supabase.from('campus_hero_images').select('storage_path').eq('campus_id', id).maybeSingle()
    if (error) throw error
    return data?.storage_path ?? null
  })
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
    return (data ?? []) as CampusLocation[]
  })
  const { data: departments = [] } = useSWR(campusId ? ['departments', campusId] : null, async ([, cid]) => {
    const { data, error } = await supabase.from('departments').select('id,name').eq('campus_id', cid).order('name')
    if (error) throw error
    return data ?? []
  })
  const { data: moderatorMembership } = useSWR(userId && campusId ? ['campus-moderator', userId, campusId] : null, async ([, uid, cid]) => {
    const { data, error } = await supabase.from('campus_moderators').select('role').eq('user_id', uid).eq('campus_id', cid).maybeSingle()
    if (error) return null
    return data as { role: string } | null
  })
  const { data: heatSettings } = useSWR(campusId ? ['issue-heat-settings', campusId] : null, async ([, cid]) => {
    const { data, error } = await supabase.from('issue_heat_settings').select('thresholds').eq('campus_id', cid).maybeSingle()
    if (error) return null
    return data as { thresholds: unknown } | null
  })
  const feedIssues = useMemo(() => issues.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)), [issues])
  const thresholds: HeatThresholds = getHeatThresholds(heatSettings?.thresholds ?? DEFAULT_HEAT_THRESHOLDS)
  const isModerator = moderatorMembership?.role === 'moderator' || moderatorMembership?.role === 'admin'
  const isAdmin = moderatorMembership?.role === 'admin'
  const { data: campusModerators = [] } = useSWR(isModerator && campusId ? ['campus-assignable-moderators', campusId] : null, async ([, cid]) => {
    const { data: memberships, error: membershipError } = await supabase.from('campus_moderators').select('user_id,role').eq('campus_id', cid)
    if (membershipError || !memberships?.length) return []
    const assignedMembers = memberships as { user_id: string; role: string }[]
    const { data: profiles, error: profileError } = await supabase.from('profiles').select('id,display_name').in('id', assignedMembers.map((membership) => membership.user_id))
    if (profileError) return []
    const profileRows = (profiles ?? []) as { id: string; display_name: string }[]
    return assignedMembers.map((membership) => ({ user_id: membership.user_id, role: membership.role, display_name: profileRows.find((profile) => profile.id === membership.user_id)?.display_name ?? 'Campus moderator' }))
  })

  useEffect(() => {
    const savedTheme = document.cookie.split('; ').find((cookie) => cookie.startsWith('campusheat-theme='))?.split('=')[1]
    const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches
    setIsDarkMode(savedTheme ? savedTheme === 'dark' : prefersDarkMode)
  }, [])

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
    if (!campusId && campuses.length) {
      setCampusId(campuses.find((item) => item.slug === 'sgsits-indore')?.id ?? campuses[0].id)
    }
  }, [campusId, campuses])

  const campus = campuses.find((item) => item.id === campusId) ?? campuses[0]
  const campusHeroImageUrl = campusHeroImagePath ? supabase.storage.from('campus-assets').getPublicUrl(campusHeroImagePath).data.publicUrl : null
  const selectedIssue = issues.find((issue) => issue.id === selectedIssueId) ?? userIssues.find((issue) => issue.id === selectedIssueId) ?? null
  const orderedCategories = useMemo(() => categories.slice().sort((a, b) => {
    const priority = (name: string) => name.toLowerCase() === 'classroom' ? 0 : name.toLowerCase() === 'hostel' ? 1 : 2
    return priority(a.name) - priority(b.name) || a.name.localeCompare(b.name)
  }), [categories])
  const selectedLocation = locations.find((location) => location.id === locationFilter)
  const filteredIssues = useMemo(() => {
    const base = view === 'profile' ? userIssues : feedIssues
    const normalized = query.trim().toLowerCase()
    return base.filter((issue) => {
      const matchesText = !normalized || [issue.title, issue.description, issue.custom_category, issue.category?.name, issue.custom_location, issue.location?.name, issue.building_area, issue.custom_department, issue.department?.name, issue.problem_type].some((value) => value?.toLowerCase().includes(normalized))
      const matchesStatus = statusFilter === 'all' || issue.status === statusFilter
      const matchesCategory = categoryFilter === 'all' || (issue.custom_category || issue.category?.name) === categoryFilter
      const matchesLocation = locationFilter === 'all' || issue.location_id === locationFilter || Boolean(selectedLocation && [issue.location?.name, issue.custom_location].some((name) => name?.trim().toLowerCase() === selectedLocation.name.trim().toLowerCase()))
      const matchesFire = !fireOnly || (Boolean(selectedLocation) && getHeatLevel(scoreIssueHeat(issue, getIssueRecurrenceCount(issue, feedIssues)), thresholds) !== 'normal')
      return matchesText && matchesStatus && matchesCategory && matchesLocation && matchesFire
    })
  }, [categoryFilter, feedIssues, fireOnly, locationFilter, query, selectedLocation, statusFilter, thresholds, userIssues, view])

  const refreshIssues = useCallback(async () => {
    await mutate(['issues', campusId])
    if (userId) await mutate(['my-issues', userId, campusId])
  }, [campusId, userId])

  function evaluateEscalation(issueId: string) {
    if (!userId) return
    void fetch('/api/issue-intelligence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'evaluate_escalation', issueId }),
    }).then(async (response) => {
      if (response.ok) await mutate(['issue-events', issueId])
    }).catch(() => undefined)
  }

  function openIssue(issueId: string) {
    setMapFocusIssueId(issueId)
    setSelectedIssueId(issueId)
    evaluateEscalation(issueId)
  }

  function showIssueOnMap(issue: CampusIssue) {
    setMapFocusIssueId(issue.id)
    setMapScrollIssueId(issue.id)
    setSelectedIssueId(null)
    setView('home')
  }

  useEffect(() => {
    if (!mapScrollIssueId || view !== 'home') return
    const frame = window.requestAnimationFrame(() => {
      mapPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setMapScrollIssueId((issueId) => issueId === mapScrollIssueId ? null : issueId)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [mapScrollIssueId, view])

  function toggleTheme() {
    const nextIsDarkMode = !isDarkMode
    setIsDarkMode(nextIsDarkMode)
    document.cookie = `campusheat-theme=${nextIsDarkMode ? 'dark' : 'light'}; Path=/; Max-Age=31536000; SameSite=Lax`
  }

  async function requireUser() {
    if (userId) return true
    setAuthOpen(true)
    return false
  }

  async function replaceCampusHeroImage(file: File) {
    if (!await requireUser()) return

    const allowedTypes: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    }
    const extension = allowedTypes[file.type]
    if (!extension) {
      setNotice('Choose a JPG, PNG, or WebP image.')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setNotice('Choose an image smaller than 8 MB.')
      return
    }

    setHeroImageUploading(true)
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        setAuthOpen(true)
        return
      }

      const storagePath = `${campusId}/${crypto.randomUUID()}.${extension}`
      const { error: uploadError } = await supabase.storage.from('campus-assets').upload(storagePath, file, {
        contentType: file.type,
        cacheControl: '31536000',
        upsert: false,
      })
      if (uploadError) {
        setNotice('The image could not be uploaded. Please try again.')
        return
      }

      const { error: saveError } = await supabase.from('campus_hero_images').upsert({
        campus_id: campusId,
        storage_path: storagePath,
        updated_by: user.id,
      }, { onConflict: 'campus_id' })
      if (saveError) {
        setNotice('The image uploaded, but could not be shared. Please try again.')
        return
      }

      await mutate(['campus-hero-image', campusId])
      setNotice('Campus image updated for everyone.')
    } catch {
      setNotice('The image could not be updated. Please try again.')
    } finally {
      setHeroImageUploading(false)
      window.setTimeout(() => setNotice(''), 3200)
    }
  }

  async function handleCampusChange(nextCampusId: string) {
    setCampusId(nextCampusId)
    setMapFocusIssueId(null)
    setMapScrollIssueId(null)
    setLocationFilter('all')
    setFireOnly(false)
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
      evaluateEscalation(issue.id)
      await mutate(['my-vote', issue.id, userId])
    }
  }

  async function addComment(issueId: string, body: string, parentId?: string) {
    if (!await requireUser()) return false
    setBusy(true)
    let insertFailed = false
    try {
      const { error } = await supabase.from('comments').insert({ issue_id: issueId, user_id: userId!, body, parent_id: parentId ?? null })
      insertFailed = Boolean(error)
    } catch {
      insertFailed = true
    } finally {
      setBusy(false)
    }
    if (insertFailed) {
      setNotice('Your comment could not be posted. Please try again.')
      return false
    }
    void refreshIssues().catch(() => undefined)
    evaluateEscalation(issueId)
    void mutate(['comments', issueId]).catch(() => undefined)
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

  const pageTitle = view === 'home' ? 'Campus feed' : view === 'explore' ? 'Explore issues' : view === 'activity' ? 'Activity' : view === 'chat' ? 'Campus chat' : view === 'moderator' ? 'Campus operations' : view === 'developer' ? 'Developer options' : 'Your profile'
  const mapCenterIssue = issues.find((issue) => issue.latitude != null && issue.longitude != null)
  const mapCenter = useMemo(() => mapCenterIssue
    ? { latitude: mapCenterIssue.latitude!, longitude: mapCenterIssue.longitude! }
    : campus?.slug === 'sgsits-indore'
      ? { latitude: 22.7252, longitude: 75.8713 }
      : null, [campus?.slug, mapCenterIssue?.latitude, mapCenterIssue?.longitude])
  const mappedIssueCount = feedIssues.filter((issue) => issue.latitude != null && issue.longitude != null).length

  return (
    <div className={`campus-app${isDarkMode ? ' dark-theme' : ''}${chatExpanded ? ' chat-expanded' : ''}`}>
      <aside className="campus-sidebar" aria-label="Main navigation">
        <a className="brand-lockup" href="#home" onClick={(event) => { event.preventDefault(); setView('home') }}>
          <span className="brand-symbol"><Flame size={21} fill="currentColor" /></span>
          <span><strong>campus<span className="brand-hot">heat</span></strong></span>
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
          {isAdmin && <button className={`side-link ${view === 'developer' ? 'active' : ''}`} onClick={() => setView('developer')}><Wrench size={19} /><span>Developer options</span></button>}
        </nav>
        <button className="theme-toggle sidebar-theme-toggle" type="button" onClick={toggleTheme} aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'} aria-pressed={isDarkMode}>{isDarkMode ? <Sun size={17} /> : <Moon size={17} />}<span>{isDarkMode ? 'Light mode' : 'Dark mode'}</span></button>
        <button className="sidebar-report" onClick={openReport}><Plus size={18} /> Report an issue</button>
        <div className="sidebar-bottom">
          <button className="user-mini" onClick={() => userId ? setView('profile') : setAuthOpen(true)}><span className="avatar avatar-small">{profile?.display_name?.slice(0, 1).toUpperCase() ?? <Users size={15} />}</span><span><strong>{profile?.display_name ?? 'Sign in'}</strong><small>{userId ? 'Student account' : 'Sign in or create an account'}</small></span><ChevronDown size={15} /></button>
        </div>
      </aside>

      <main className="main-column">
        <header className="mobile-header">
          <a className="brand-lockup compact" href="#home" onClick={(event) => { event.preventDefault(); setView('home') }}><span className="brand-symbol"><Flame size={19} fill="currentColor" /></span><strong>campus<span className="brand-hot">heat</span></strong></a>
          <button className="mobile-campus" onClick={() => setCampusMenuOpen(!campusMenuOpen)} aria-label={`Campus: ${campus?.name ?? 'Choose campus'}`}><MapPin size={15} /><span>{campus?.city ?? 'Campus'}</span><ChevronDown size={14} /></button>
          {isAdmin && <button className="icon-button mobile-dev-button" onClick={() => setView('developer')} aria-label="Developer options"><Wrench size={18} /></button>}
          <button className="icon-button mobile-notifications" onClick={() => userId ? setView('activity') : setAuthOpen(true)} aria-label="Notifications"><Bell size={19} /></button>
          <button className="icon-button mobile-theme-toggle" type="button" onClick={toggleTheme} aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'} aria-pressed={isDarkMode}>{isDarkMode ? <Sun size={18} /> : <Moon size={18} />}</button>
          {campusMenuOpen && <div className="campus-menu mobile-campus-menu" role="listbox" aria-label="Choose campus">{campuses.map((item) => <button key={item.id} role="option" aria-selected={item.id === campusId} onClick={() => void handleCampusChange(item.id)}><span>{item.name}</span><small>{item.city}</small></button>)}</div>}
        </header>

        {view === 'chat' ? (
          <section className="content-page mobile-chat-page">
            <PageHeading eyebrow="CAMPUS COMMUNITY" title="Campus chat" description={`Join the conversation with people at ${campus?.name ?? 'your campus'}.`} />
            <CampusChat campusId={campusId} campusName={campus?.name ?? 'Your college'} userId={userId} expanded={false} height={chatHeight} onHeightChange={setChatHeight} onToggleExpanded={() => setChatExpanded(false)} onRequireAuth={() => setAuthOpen(true)} />
          </section>
        ) : view === 'activity' ? (
          <section className="content-page activity-page">
            <PageHeading eyebrow="STAY IN THE LOOP" title={pageTitle} description="The latest updates on the issues you care about." />
            {!userId ? <SignInPrompt onSignIn={() => setAuthOpen(true)} /> : activityLoading ? <LoadingState /> : activity.length === 0 ? <EmptyState icon={Bell} title="You're all caught up" body="Updates about reports you follow will show up here." /> : <div className="activity-list">{activity.map((item) => <button key={item.id} className={`activity-item ${item.read_at ? '' : 'unread'}`} onClick={() => { if (item.issue_id) openIssue(item.issue_id); if (!item.read_at) void markRead(item.id) }}><span className="activity-icon"><Bell size={18} /></span><span className="activity-copy"><strong>{item.title}</strong>{item.body && <span>{item.body}</span>}<small>{timeAgo(item.created_at)}</small></span>{!item.read_at && <span className="unread-dot" />}</button>)}</div>}
          </section>
        ) : view === 'moderator' ? (
          isModerator ? <ModeratorDashboard key={campusId} campusId={campusId} issues={issues} categories={categories} locations={locations} departments={departments} moderators={campusModerators} thresholds={thresholds} onOpenIssue={openIssue} onChanged={async () => { await refreshIssues(); await mutate(['issue-heat-settings', campusId]) }} isAdmin={isAdmin} /> : <section className="content-page"><PageHeading eyebrow="CAMPUS OPERATIONS" title="Moderator access required" description="This workspace is available to authorized campus moderators." /><EmptyState icon={ShieldCheck} title="This area is restricted" body="Ask a campus administrator to add you to the campus moderator team." /></section>
        ) : view === 'developer' ? (
          isAdmin ? <DeveloperTools key={campusId} campusId={campusId} /> : <section className="content-page"><PageHeading eyebrow="ADMIN-ONLY SANDBOX" title="Developer access required" description="These testing controls are restricted to campus administrators." /><EmptyState icon={ShieldCheck} title="This area is restricted" body="Switch to a campus where you have administrator access." /></section>
        ) : view === 'profile' ? (
          <section className="content-page profile-page">
          <PageHeading eyebrow="ACCOUNT OVERVIEW" title={pageTitle} description="View your account details and submitted reports." />
          {!userId ? <SignInPrompt onSignIn={() => setAuthOpen(true)} /> : <><div className="profile-card"><span className="avatar avatar-large">{profile?.display_name?.slice(0, 1).toUpperCase() ?? 'S'}</span><div><h2>{profile?.display_name ?? 'Campus student'}</h2><p>{campus?.name} · {campus?.city}</p><button className="text-button" onClick={() => void supabase.auth.signOut()}>Sign out</button></div></div><div className="section-title-row"><div><span className="eyebrow">YOUR REPORTS</span><h2>My reports <span className="count-pill">{userIssues.length}</span></h2></div><button className="text-button" onClick={openReport}><Plus size={15} /> New report</button></div>{filteredIssues.length === 0 ? <EmptyState icon={Camera} title="No reports yet" body="Reports you submit to this campus will appear here." action={<button className="button-primary small" onClick={openReport}>Report an issue</button>} /> : <div className="feed-list">{filteredIssues.map((issue) => <IssueCard key={issue.id} issue={issue} onOpen={() => openIssue(issue.id)} onShowOnMap={showIssueOnMap} onVote={(item, value) => castVote(item, value)} onAuth={() => setAuthOpen(true)} issues={issues} thresholds={thresholds} userId={userId} busy={busy} />)}</div>}</>}

          </section>
        ) : (
          <>
            <section className="welcome-panel">
              <div className="welcome-copy"><span className="welcome-kicker"><span className="live-dot" /> CAMPUS ISSUE REPORTING</span><h1>Report a<br /><em>campus problem.</em></h1><p>Submit maintenance, safety, and other campus concerns for review.</p><button className="button-primary welcome-cta" onClick={openReport}><Plus size={18} /> Report a problem</button></div>
              <CampusHeroArt imageUrl={campusHeroImageUrl} uploading={heroImageUploading} canEdit={Boolean(userId)} onChooseFile={replaceCampusHeroImage} onRequireAuth={() => setAuthOpen(true)} />
            </section>

            <section ref={mapPanelRef} id="campus-map-panel" className="campus-map-panel" aria-label="Map of campus issues"><div className="campus-map-heading"><div><span className="eyebrow">CAMPUS MAP</span><h2>Issues on campus <span>{mappedIssueCount}</span></h2></div><span className="map-heading-note">Use +/− or scroll over the map to zoom · drag to explore</span></div><CampusMap issues={feedIssues} center={mapCenter} focusedIssueId={mapFocusIssueId} onIssueSelect={(issue) => openIssue(issue.id)} /><MapLegend /><p className="campus-map-caption">Map pins are approximate; open a report to review its location.</p></section>

            <section className="feed-content">
              <div className="feed-heading"><div><span className="eyebrow">{view === 'explore' ? 'SEARCH AND FILTER REPORTS' : 'CAMPUS REPORTS'}</span><h2>{view === 'explore' ? 'Explore campus' : 'The campus pulse'} <span className="flame-count"><Flame size={17} fill="currentColor" /> {feedIssues.length}</span></h2><p>{view === 'explore' ? 'Search reports, browse categories, and filter by status or location.' : 'Recent reports and their current status.'}</p></div><button className="desktop-report-inline" onClick={openReport}><Plus size={17} /> New report</button></div>
              <div className="feed-toolbar">
                <div className="feed-tabs" role="tablist" aria-label="Feed type"><button role="tab" aria-selected={statusFilter === 'all'} className={statusFilter === 'all' ? 'selected' : ''} onClick={() => setStatusFilter('all')}>For you</button><button role="tab" aria-selected={statusFilter === 'in_progress'} className={statusFilter === 'in_progress' ? 'selected' : ''} onClick={() => setStatusFilter('in_progress')}>In progress</button><button role="tab" aria-selected={statusFilter === 'resolved'} className={statusFilter === 'resolved' ? 'selected' : ''} onClick={() => setStatusFilter('resolved')}>Resolved</button></div>
                <div className="search-wrap"><Search size={16} /><input aria-label="Search campus issues" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search issues" /></div>
              </div>
              <div className="place-filter-row">
                <label className="place-filter-select"><MapPin size={15} aria-hidden="true" /><span className="sr-only">Filter issues by place</span><select aria-label="Filter issues by place" value={locationFilter} onChange={(event) => { setLocationFilter(event.target.value); if (event.target.value === 'all') setFireOnly(false) }}><option value="all">All places</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}{location.building ? ` · ${location.building}` : ''}</option>)}</select><ChevronDown size={14} aria-hidden="true" /></label>
                {selectedLocation && <button type="button" className={`fire-filter${fireOnly ? ' chosen' : ''}`} aria-pressed={fireOnly} onClick={() => setFireOnly(!fireOnly)}><Flame size={15} fill="currentColor" /> Fire</button>}
              </div>
              <div className="category-chips" aria-label="Filter by category"><button className={categoryFilter === 'all' ? 'chosen' : ''} onClick={() => setCategoryFilter('all')}>All issues</button>{orderedCategories.map((item) => <button key={item.id} className={categoryFilter === item.name ? 'chosen' : ''} onClick={() => setCategoryFilter(categoryFilter === item.name ? 'all' : item.name)}>{item.name}</button>)}</div>
              {issueError ? <EmptyState icon={CircleHelp} title="Couldn't load the campus feed" body="Check your connection and try again." action={<button className="text-button" onClick={() => void mutate(['issues', campusId])}>Try again</button>} /> : issuesLoading ? <LoadingState /> : filteredIssues.length === 0 ? <EmptyState icon={Search} title="No issues found" body={query || categoryFilter !== 'all' || statusFilter !== 'all' || locationFilter !== 'all' || fireOnly ? 'Try another search or clear your filters.' : 'Be the first to report something that needs attention.'} action={query || categoryFilter !== 'all' || statusFilter !== 'all' || locationFilter !== 'all' || fireOnly ? <button className="text-button" onClick={() => { setQuery(''); setCategoryFilter('all'); setStatusFilter('all'); setLocationFilter('all'); setFireOnly(false) }}>Clear filters</button> : <button className="button-primary small" onClick={openReport}>Report an issue</button>} /> : <div className="feed-list">{filteredIssues.map((issue) => <IssueCard key={issue.id} issue={issue} onOpen={() => openIssue(issue.id)} onShowOnMap={showIssueOnMap} onVote={(item, value) => castVote(item, value)} onAuth={() => setAuthOpen(true)} issues={issues} thresholds={thresholds} userId={userId} busy={busy} />)}</div>}
              <div className="feed-footer"><span>Showing {filteredIssues.length} of {feedIssues.length} reports</span></div>
            </section>
          </>
        )}
      </main>

      <aside className={`right-column${view === 'chat' ? ' chat-view-hidden' : ''}`} aria-label="Campus chat and account" style={{ height: `${chatHeight}vh` }}>
        <div className="right-top"><button className="icon-button notification-button" onClick={() => userId ? setView('activity') : setAuthOpen(true)} aria-label="Open activity"><Bell size={18} /></button>{userId ? <div className="account-menu-wrap"><button className="user-chip" type="button" aria-label={`Open account menu for ${profile?.display_name ?? 'Student'}`} aria-expanded={profileMenuOpen} aria-controls="account-menu" onClick={() => setProfileMenuOpen((open) => !open)}><span className="avatar avatar-tiny">{profile?.display_name?.slice(0, 1).toUpperCase() ?? 'S'}</span>{profile?.display_name ?? 'Student'}<ChevronDown size={13} /></button>{profileMenuOpen && <div className="account-menu" id="account-menu" aria-label="Account actions"><span className="account-menu-label">Signed in as</span><strong>{profile?.display_name ?? 'Student'}</strong><button onClick={() => { setView('profile'); setProfileMenuOpen(false) }}><Users size={15} /> My profile</button><button onClick={() => { setProfileMenuOpen(false); setView('home'); void supabase.auth.signOut() }}><LogIn size={15} /> Sign out</button></div>}</div> : <button className="sign-in-button" onClick={() => setAuthOpen(true)}><LogIn size={15} /> Sign in</button>}</div>
        {view !== 'chat' && <CampusChat campusId={campusId} campusName={campus?.name ?? 'Your college'} userId={userId} expanded={chatExpanded} height={chatHeight} onHeightChange={setChatHeight} onToggleExpanded={() => setChatExpanded((expanded) => !expanded)} onRequireAuth={() => setAuthOpen(true)} />}
      </aside>

      <nav className="mobile-nav" aria-label="Mobile navigation">{mobileNavItems.slice(0, 2).map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? 'active' : ''} aria-current={view === id ? 'page' : undefined} onClick={() => id === 'activity' && !userId ? setAuthOpen(true) : setView(id)}><Icon size={20} /><span>{label}</span></button>)}<button className="mobile-report-button" onClick={openReport} aria-label="Report an issue"><span><Plus size={23} /></span><small>Report</small></button>{mobileNavItems.slice(2).map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? 'active' : ''} aria-current={view === id ? 'page' : undefined} onClick={() => id === 'chat' ? setView(id) : userId ? setView(id) : setAuthOpen(true)}><Icon size={20} /><span>{label}</span></button>)}</nav>

      {notice && <div className="toast-message" role="status">{notice}</div>}
      {reportOpen && <ReportDialog campusId={campusId} categories={categories} locations={locations} departments={departments} initialMapCenter={mapCenter} onClose={() => setReportOpen(false)} onRequireAuth={() => setAuthOpen(true)} onCreated={async (warning) => { setReportOpen(false); setView('home'); await refreshIssues(); setNotice(warning ?? 'Your report is live. Thanks for speaking up.'); window.setTimeout(() => setNotice(''), 3200) }} />}
      {authOpen && <AuthDialog onClose={() => { setAuthOpen(false); setReportAfterAuth(false) }} onAuthenticated={async (uid, displayName) => { setUserId(uid); const { data } = await supabase.from('profiles').select('id,display_name,avatar_url,campus_id').eq('id', uid).maybeSingle(); if (data) { setProfile(data as Profile); if (data.campus_id) setCampusId(data.campus_id) } else if (displayName) setProfile({ id: uid, display_name: displayName, avatar_url: null, campus_id: null }); setAuthOpen(false); if (reportAfterAuth) { setReportAfterAuth(false); setReportOpen(true) } }} />}
      {selectedIssue && <IssueDetail issue={selectedIssue} userId={userId} onClose={() => setSelectedIssueId(null)} onShowOnMap={showIssueOnMap} onPhotosChanged={refreshIssues} onVote={castVote} onComment={addComment} busy={busy} isModerator={isModerator} isAdmin={isAdmin} onAdminChange={async (deleted, message) => { await refreshIssues(); if (deleted) setSelectedIssueId(null); setNotice(message ?? (deleted ? 'Post deleted.' : 'Post updated.')); window.setTimeout(() => setNotice(''), 3000) }} onRequireAuth={() => setAuthOpen(true)} />}
    </div>
  )
}

function MapLegend() {
  return <div className="map-legend" aria-label="Problem severity colors"><span><i className="severity-low" />Low</span><span><i className="severity-medium" />Medium</span><span><i className="severity-high" />High</span><span><i className="severity-critical" />Critical</span></div>
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-heading"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
}

function SignInPrompt({ onSignIn }: { onSignIn: () => void }) {
  return <div className="sign-in-prompt"><span className="prompt-icon large"><Users size={20} /></span><h2>Sign in to view your reports</h2><p>Your profile and submitted reports are available after you sign in.</p><button className="button-primary small" onClick={onSignIn}><LogIn size={15} /> Sign in</button></div>
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
