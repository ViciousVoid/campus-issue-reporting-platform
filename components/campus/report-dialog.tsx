'use client'

import { useRef, useState, type FormEvent } from 'react'
import { Camera, ImagePlus, LoaderCircle, MapPin, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Category } from '@/lib/campus'

type Option = { id: string; name: string; building?: string | null }
type ReportDialogProps = {
  campusId: string
  categories: Category[]
  locations: Option[]
  departments: Option[]
  onClose: () => void
  onRequireAuth: () => void
  onCreated: () => void | Promise<void>
}
const supabase = createClient()
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

export function ReportDialog({ campusId, categories, locations, departments, onClose, onCreated }: ReportDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [buildingArea, setBuildingArea] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function selectFile(next: File | undefined) {
    if (!next) return
    if (!ACCEPTED_TYPES.includes(next.type) || next.size > MAX_IMAGE_BYTES) {
      setError('Choose a JPG, PNG, WebP, or HEIC photo under 10 MB.')
      return
    }
    setFile(next)
    setPreview(URL.createObjectURL(next))
    setError('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const safeTitle = title.trim()
    const safeDescription = description.trim()
    if (safeTitle.length < 8) { setError('Add a clear title with at least 8 characters.'); return }
    if (safeDescription.length < 20) { setError('Please describe the issue in at least 20 characters.'); return }
    if (!categoryId) { setError('Choose the category that best fits this issue.'); return }
    setSubmitting(true)
    const { data: authData } = await supabase.auth.getUser()
    const userId = authData.user?.id
    if (!userId) { setSubmitting(false); onClose(); return }
    const { data: created, error: insertError } = await supabase.from('issues').insert({
      campus_id: campusId,
      reporter_id: userId,
      category_id: categoryId,
      location_id: locationId || null,
      department_id: departmentId || null,
      title: safeTitle,
      description: safeDescription,
      building_area: buildingArea.trim() || null,
      anonymous_public: anonymous,
    }).select('id').single()
    if (insertError || !created) {
      setError(insertError?.message?.includes('row-level security') ? 'Your session needs refreshing. Please sign in again.' : 'We couldn’t submit your report. Please try again.')
      setSubmitting(false)
      return
    }
    if (file) {
      const path = `${userId}/${created.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`
      const { error: uploadError } = await supabase.storage.from('issue-photos').upload(path, file, { contentType: file.type, upsert: false })
      if (!uploadError) {
        const { error: mediaError } = await supabase.from('issue_media').insert({ issue_id: created.id, storage_path: path, display_order: 0 })
        if (mediaError) setError('Report posted, but the photo could not be attached.')
      } else {
        setError('Report posted, but the photo upload failed. You can still view the report.')
      }
    }
    setSubmitting(false)
    await onCreated()
  }

  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-title">
        <header className="dialog-topbar"><div><span className="eyebrow">MAKE CAMPUS BETTER</span><h2 id="report-title">Report an issue</h2></div><button className="icon-button" onClick={onClose} aria-label="Close report form"><X size={20} /></button></header>
        <form className="report-form" onSubmit={submit}>
          <p className="dialog-intro">A clear, specific report helps your campus team take the right next step.</p>
          <label className="form-field"><span>What needs attention? <b>*</b></span><input required minLength={8} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Wi-Fi keeps dropping in the library" /><small>{title.trim().length}/120</small></label>
          <label className="form-field"><span>Tell us a little more <b>*</b></span><textarea required minLength={20} maxLength={5000} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What is happening, when did you notice it, and who is affected?" /><small>{description.trim().length}/5000</small></label>
          <div className="form-grid-two"><label className="form-field"><span>Category <b>*</b></span><select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Select a category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="form-field"><span>Location</span><select value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="">Choose a campus area</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}{location.building && location.building !== location.name ? ` · ${location.building}` : ''}</option>)}</select></label></div>
          <div className="form-grid-two"><label className="form-field"><span>Specific area</span><input maxLength={180} value={buildingArea} onChange={(event) => setBuildingArea(event.target.value)} placeholder="Floor, room, or nearby landmark" /></label><label className="form-field"><span>Suggested team</span><select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}><option value="">Let campus route it</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label></div>
          <div className="upload-block"><span className="upload-label">Add a photo <small>Optional · up to 10 MB</small></span>{preview ? <div className="upload-preview"><img src={preview} alt="Selected issue photo preview" /><button type="button" onClick={() => { setFile(null); setPreview('') }} aria-label="Remove photo"><X size={15} /></button></div> : <button type="button" className="upload-trigger" onClick={() => inputRef.current?.click()}><ImagePlus size={19} /><span><strong>Choose a photo</strong><small>JPG, PNG, WebP, or HEIC</small></span><Camera size={18} /></button>}<input ref={inputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={(event) => selectFile(event.target.files?.[0])} /></div>
          <label className="checkbox-row"><input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} /><span><strong>Post without my name</strong><small>Your identity is still visible to campus moderators.</small></span></label>
          <div className="privacy-note"><MapPin size={15} /><span>This report will be visible to the <strong>campus community</strong>.</span></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <footer className="dialog-actions"><button type="button" className="button-secondary" onClick={onClose}>Cancel</button><button className="button-primary" disabled={submitting}>{submitting ? <LoaderCircle size={16} className="spin" /> : null}{submitting ? 'Submitting…' : 'Submit report'}</button></footer>
        </form>
      </section>
    </div>
  )
}

export default ReportDialog
