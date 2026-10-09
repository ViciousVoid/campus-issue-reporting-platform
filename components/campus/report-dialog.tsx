'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Camera, ImagePlus, LoaderCircle, MapPin, Sparkles, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Category } from '@/lib/campus'
import { LocationMapWidget, type Coordinates } from '@/components/campus/map-widgets'

type Option = { id: string; name: string; building?: string | null }
type ReportDialogProps = {
  campusId: string
  categories: Category[]
  locations: Option[]
  departments: Option[]
  onClose: () => void
  onRequireAuth: () => void
  onCreated: (warning?: string) => void | Promise<void>
  initialMapCenter?: Coordinates | null
}
type PhotoSelection = { file: File; preview: string }
const supabase = createClient()
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_PHOTOS = 5
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
const OTHER_OPTION_ID = '__other__'

type IssueSuggestions = {
  suggestions: { categoryId: string | null; categoryName: string | null; problemType: string; severity: 'low' | 'medium' | 'high' | 'critical'; departmentId: string | null; departmentName: string | null }
  duplicate: { id: string; title: string; confidence: number } | null
}

export function ReportDialog({ campusId, categories, locations, departments, onClose, onRequireAuth, onCreated, initialMapCenter }: ReportDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null)
  const [locating, setLocating] = useState(false)
  const [departmentId, setDepartmentId] = useState('')
  const [buildingArea, setBuildingArea] = useState('')
  const [facultyTag, setFacultyTag] = useState('')
  const [customCategory, setCustomCategory] = useState('')
  const [customLocation, setCustomLocation] = useState('')
  const [customDepartment, setCustomDepartment] = useState('')
  const [problemType, setProblemType] = useState('')
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')
  const [anonymous, setAnonymous] = useState(false)
  const [suggestions, setSuggestions] = useState<IssueSuggestions | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [useDuplicate, setUseDuplicate] = useState(true)
  const orderedCategories = categories.slice().sort((left, right) => {
    const priority = (name: string) => name.toLowerCase() === 'classroom' ? 0 : name.toLowerCase() === 'hostel' ? 1 : 2
    return priority(left.name) - priority(right.name) || left.name.localeCompare(right.name)
  })
  const isOtherCategory = categoryId === OTHER_OPTION_ID || categories.find((category) => category.id === categoryId)?.name.toLowerCase() === 'other'
  const isOtherLocation = locationId === OTHER_OPTION_ID
  const isOtherDepartment = departmentId === OTHER_OPTION_ID
  const [photos, setPhotos] = useState<PhotoSelection[]>([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const previewUrls = useRef(new Set<string>())

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url))
    previewUrls.current.clear()
  }, [])

  function selectFiles(selected: FileList | null) {
    if (!selected?.length) return
    const nextFiles = Array.from(selected)
    if (photos.length + nextFiles.length > MAX_PHOTOS) {
      setError(`Choose up to ${MAX_PHOTOS} photos per report.`)
      return
    }
    const invalid = nextFiles.find((next) => !ACCEPTED_TYPES.includes(next.type) || next.size > MAX_IMAGE_BYTES)
    if (invalid) {
      setError('Choose JPG, PNG, WebP, or HEIC photos under 10 MB each.')
      return
    }
    const additions = nextFiles.map((file) => {
      const preview = URL.createObjectURL(file)
      previewUrls.current.add(preview)
      return { file, preview }
    })
    setPhotos((current) => [...current, ...additions])
    setError('')
  }

  function removePhoto(preview: string) {
    URL.revokeObjectURL(preview)
    previewUrls.current.delete(preview)
    setPhotos((current) => current.filter((photo) => photo.preview !== preview))
  }

  async function requestSuggestions() {
    if (title.trim().length < 8 || description.trim().length < 20) {
      setError('Add a title and description before requesting suggestions.')
      return
    }
    setAnalyzing(true)
    setError('')
    try {
      const response = await fetch('/api/issue-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'suggest', campusId, title: title.trim(), description: description.trim() }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error ?? 'AI suggestions are temporarily unavailable.')
      const nextSuggestions = result as IssueSuggestions
      setSuggestions(nextSuggestions)
      setUseDuplicate(true)
      if (nextSuggestions.suggestions.categoryId) setCategoryId(nextSuggestions.suggestions.categoryId)
      if (nextSuggestions.suggestions.departmentId) setDepartmentId(nextSuggestions.suggestions.departmentId)
      if (nextSuggestions.suggestions.problemType) setProblemType(nextSuggestions.suggestions.problemType)
      setSeverity(nextSuggestions.suggestions.severity)
    } catch (suggestionError) {
      setError(suggestionError instanceof Error ? suggestionError.message : 'AI suggestions are temporarily unavailable.')
    } finally {
      setAnalyzing(false)
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError('Location is not available in this browser. Select the location on the map instead.')
      return
    }
    setLocating(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      ({ coords: current }) => {
        setCoordinates({ latitude: current.latitude, longitude: current.longitude })
        setLocating(false)
      },
      () => {
        setError('We couldn’t access your current location. Choose it directly on the map instead.')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    )
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const safeTitle = title.trim()
    const safeDescription = description.trim()
    if (safeTitle.length < 8) { setError('Add a clear title with at least 8 characters.'); return }
    if (safeDescription.length < 20) { setError('Please describe the issue in at least 20 characters.'); return }
    const otherCategoryId = categories.find((category) => category.name.toLowerCase() === 'other')?.id
    const resolvedCategoryId = categoryId === OTHER_OPTION_ID ? otherCategoryId : categoryId
    if (!resolvedCategoryId) { setError('Choose a category, or select Other and enter a label.'); return }
    if (!coordinates) { setError('Choose the exact problem location on the map, or use your current location.'); return }
    setSubmitting(true)
    const { data: authData } = await supabase.auth.getUser()
    const userId = authData.user?.id
    if (!userId) { setSubmitting(false); setError('Your guest session is still starting. Please try again.'); return }
    const response = await fetch('/api/issue-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campusId,
        categoryId: resolvedCategoryId,
        locationId: locationId && locationId !== OTHER_OPTION_ID ? locationId : null,
        departmentId: departmentId && departmentId !== OTHER_OPTION_ID ? departmentId : null,
        duplicateId: useDuplicate ? suggestions?.duplicate?.id : null,
        title: safeTitle,
        description: safeDescription,
        buildingArea: buildingArea.trim() || null,
        facultyTag: facultyTag.trim() || null,
        anonymous,
        customCategory: customCategory.trim() || null,
        customLocation: customLocation.trim() || null,
        customDepartment: customDepartment.trim() || null,
        problemType: problemType.trim() || null,
        severity,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok || !result.id) {
      setError(result.error ?? 'We couldn’t submit your report. Please try again.')
      setSubmitting(false)
      return
    }
    const created = { id: result.id as string }

    let warning: string | undefined = result.warning
    if (!warning && result.moderationStatus === 'pending') warning = 'Your report was submitted for campus moderator review.'
    if (!warning && result.moderationStatus === 'rejected') warning = 'Your report was flagged for review by the campus moderation team.'
    if (photos.length) {
      const uploads = await Promise.all(photos.map(async ({ file: photo }) => {
        const path = `${userId}/${created.id}/${crypto.randomUUID()}-${photo.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`
        const { error: uploadError } = await supabase.storage.from('issue-photos').upload(path, photo, { contentType: photo.type, upsert: false })
        return { path, error: uploadError }
      }))
      const uploadedPaths = uploads.filter((upload) => !upload.error).map((upload) => upload.path)
      const uploadFailed = uploads.some((upload) => upload.error)
      const mediaResult = uploadFailed ? null : await supabase.from('issue_media').insert(
        uploadedPaths.map((path, display_order) => ({ issue_id: created.id, storage_path: path, display_order, uploaded_by: userId })),
      )
      if (uploadFailed || mediaResult?.error) {
        if (uploadedPaths.length) await supabase.storage.from('issue-photos').remove(uploadedPaths)
        warning = 'Report posted, but one or more photos could not be attached.'
      }
    }

    setSubmitting(false)
    await onCreated(warning)
  }

  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-title">
        <header className="dialog-topbar"><div><span className="eyebrow">MAKE CAMPUS BETTER</span><h2 id="report-title">Report an issue</h2></div><button className="icon-button" onClick={onClose} aria-label="Close report form"><X size={20} /></button></header>
        <form className="report-form" onSubmit={submit}>
          <p className="dialog-intro">A clear, specific report helps your campus team take the right next step.</p>
          <label className="form-field"><span>What needs attention? <b>*</b></span><input required minLength={8} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Wi-Fi keeps dropping in the library" /><small>{title.trim().length}/120</small></label>
          <label className="form-field"><span>Tell us a little more <b>*</b></span><textarea required minLength={20} maxLength={5000} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What is happening, when did you notice it, and who is affected?" /><small>{description.trim().length}/5000</small></label>
          <button className="ai-suggest-button" type="button" disabled={analyzing || title.trim().length < 8 || description.trim().length < 20} onClick={() => void requestSuggestions()}>{analyzing ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}{analyzing ? 'Reviewing your report…' : suggestions ? 'Refresh AI suggestions' : 'Suggest details with AI'}</button>
          {suggestions && <p className="suggestion-note" role="status">Suggestions are a starting point. Review and edit every field before submitting.</p>}
          <div className="form-grid-two"><label className="form-field"><span>Category <b>*</b></span><select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Select a category</option>{orderedCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}{!orderedCategories.some((category) => category.name.toLowerCase() === 'other') && <option value={OTHER_OPTION_ID}>Other</option>}</select></label><label className="form-field"><span>Campus area</span><select value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="">Choose a campus area</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}{location.building && location.building !== location.name ? ` · ${location.building}` : ''}</option>)}<option value={OTHER_OPTION_ID}>Other / not listed</option></select></label></div>
          <div className="report-location-picker"><div className="location-picker-heading"><div><strong>Pin the exact problem location <b>*</b></strong><span>Tap the map to place the pin, or use your current location.</span></div><button type="button" className="button-secondary location-button" onClick={useCurrentLocation} disabled={locating}>{locating ? <LoaderCircle size={15} className="spin" /> : <MapPin size={15} />}{locating ? 'Locating…' : 'Use my location'}</button></div><LocationMapWidget selected={coordinates} onSelect={(next) => { setCoordinates(next); setError('') }} initialCenter={initialMapCenter} />{coordinates ? <p className="location-coordinates" role="status">Location pinned · {coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)} <button type="button" onClick={() => setCoordinates(null)}>Clear pin</button></p> : <p className="location-coordinates location-coordinates-empty">A map pin is required to submit this report.</p>}</div>
          {isOtherCategory && <label className="form-field"><span>Category label <small>Optional detail</small></span><input maxLength={100} value={customCategory} onChange={(event) => setCustomCategory(event.target.value)} placeholder="What kind of issue is it?" /></label>}
          {isOtherLocation && <label className="form-field"><span>Campus area <small>Optional detail</small></span><input maxLength={180} value={customLocation} onChange={(event) => setCustomLocation(event.target.value)} placeholder="Name the campus area" /></label>}
          <div className="form-grid-two"><label className="form-field"><span>Specific area</span><input maxLength={180} value={buildingArea} onChange={(event) => setBuildingArea(event.target.value)} placeholder="Floor, room, or nearby landmark" /></label><label className="form-field"><span>Suggested team</span><select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}><option value="">Let campus route it</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}<option value={OTHER_OPTION_ID}>Other team</option></select></label></div>
          {isOtherDepartment && <label className="form-field"><span>Team name <small>Optional detail</small></span><input maxLength={120} value={customDepartment} onChange={(event) => setCustomDepartment(event.target.value)} placeholder="Suggest a responsible team" /></label>}
          <div className="form-grid-two"><label className="form-field"><span>Problem type <small>Optional</small></span><input maxLength={120} value={problemType} onChange={(event) => setProblemType(event.target.value)} placeholder="e.g. Recurring network outage" /></label><label className="form-field"><span>Severity</span><select value={severity} onChange={(event) => setSeverity(event.target.value as typeof severity)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label></div>
          {suggestions?.duplicate && <div className="duplicate-suggestion"><label><input type="checkbox" checked={useDuplicate} onChange={(event) => setUseDuplicate(event.target.checked)} /><span><strong>Possible duplicate</strong><small>{suggestions.duplicate.title}</small></span></label></div>}
          <label className="form-field"><span>Faculty or staff tag <small>Optional</small></span><input maxLength={120} value={facultyTag} onChange={(event) => setFacultyTag(event.target.value)} placeholder="Name or role to notify" /></label>
          <div className="upload-block"><span className="upload-label">Add photos <small>Optional · up to {MAX_PHOTOS}, 10 MB each</small></span>{photos.length > 0 && <div className="upload-photo-grid">{photos.map((photo, index) => <div className="upload-preview" key={photo.preview}><img src={photo.preview} alt={`Selected issue photo ${index + 1}`} /><button type="button" onClick={() => removePhoto(photo.preview)} aria-label={`Remove photo ${index + 1}`}><X size={15} /></button></div>)}</div>}{photos.length < MAX_PHOTOS && <button type="button" className="upload-trigger" onClick={() => inputRef.current?.click()}><ImagePlus size={19} /><span><strong>{photos.length ? 'Add another photo' : 'Choose photos or use camera'}</strong><small>JPG, PNG, WebP, or HEIC</small></span><Camera size={18} /></button>}<input ref={inputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple onChange={(event) => { selectFiles(event.target.files); event.currentTarget.value = '' }} /></div>
          <label className="checkbox-row"><input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} /><span><strong>Post without my name</strong><small>Your identity is still visible to campus moderators.</small></span></label>
          <div className="privacy-note"><MapPin size={15} /><span>Your report and exact map pin will be visible to the <strong>campus community</strong>. Avoid pinning private residences.</span></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <footer className="dialog-actions"><button type="button" className="button-secondary" onClick={onClose}>Cancel</button><button className="button-primary" disabled={submitting}>{submitting ? <LoaderCircle size={16} className="spin" /> : null}{submitting ? 'Submitting…' : 'Submit report'}</button></footer>
        </form>
      </section>
    </div>
  )
}

export default ReportDialog
