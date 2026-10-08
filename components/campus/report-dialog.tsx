'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
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
  onCreated: (warning?: string) => void | Promise<void>
}
type PhotoSelection = { file: File; preview: string }
const supabase = createClient()
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_PHOTOS = 5
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

export function ReportDialog({ campusId, categories, locations, departments, onClose, onRequireAuth, onCreated }: ReportDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [buildingArea, setBuildingArea] = useState('')
  const [facultyTag, setFacultyTag] = useState('')
  const [anonymous, setAnonymous] = useState(false)
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
    if (!userId) { setSubmitting(false); onRequireAuth(); return }
    const { data: created, error: insertError } = await supabase.from('issues').insert({
      campus_id: campusId,
      reporter_id: userId,
      category_id: categoryId,
      location_id: locationId || null,
      department_id: departmentId || null,
      title: safeTitle,
      description: safeDescription,
      building_area: buildingArea.trim() || null,
      faculty_tag: facultyTag.trim() || null,
      anonymous_public: anonymous,
    }).select('id').single()
    if (insertError || !created) {
      setError(insertError?.message?.toLowerCase().includes('row-level security') ? 'Your session needs refreshing. Please sign in again.' : 'We couldn’t submit your report. Please try again.')
      setSubmitting(false)
      return
    }

    let warning: string | undefined
    if (photos.length) {
      const uploads = await Promise.all(photos.map(async ({ file: photo }) => {
        const path = `${userId}/${created.id}/${crypto.randomUUID()}-${photo.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`
        const { error: uploadError } = await supabase.storage.from('issue-photos').upload(path, photo, { contentType: photo.type, upsert: false })
        return { path, error: uploadError }
      }))
      const uploadedPaths = uploads.filter((upload) => !upload.error).map((upload) => upload.path)
      const uploadFailed = uploads.some((upload) => upload.error)
      const mediaResult = uploadFailed ? null : await supabase.from('issue_media').insert(
        uploadedPaths.map((path, display_order) => ({ issue_id: created.id, storage_path: path, display_order })),
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
          <div className="form-grid-two"><label className="form-field"><span>Category <b>*</b></span><select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Select a category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="form-field"><span>Location</span><select value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="">Choose a campus area</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}{location.building && location.building !== location.name ? ` · ${location.building}` : ''}</option>)}</select></label></div>
          <div className="form-grid-two"><label className="form-field"><span>Specific area</span><input maxLength={180} value={buildingArea} onChange={(event) => setBuildingArea(event.target.value)} placeholder="Floor, room, or nearby landmark" /></label><label className="form-field"><span>Suggested team</span><select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}><option value="">Let campus route it</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label></div>
          <label className="form-field"><span>Faculty or staff tag <small>Optional</small></span><input maxLength={120} value={facultyTag} onChange={(event) => setFacultyTag(event.target.value)} placeholder="Name or role to notify" /></label>
          <div className="upload-block"><span className="upload-label">Add photos <small>Optional · up to {MAX_PHOTOS}, 10 MB each</small></span>{photos.length > 0 && <div className="upload-photo-grid">{photos.map((photo, index) => <div className="upload-preview" key={photo.preview}><img src={photo.preview} alt={`Selected issue photo ${index + 1}`} /><button type="button" onClick={() => removePhoto(photo.preview)} aria-label={`Remove photo ${index + 1}`}><X size={15} /></button></div>)}</div>}{photos.length < MAX_PHOTOS && <button type="button" className="upload-trigger" onClick={() => inputRef.current?.click()}><ImagePlus size={19} /><span><strong>{photos.length ? 'Add another photo' : 'Choose photos or use camera'}</strong><small>JPG, PNG, WebP, or HEIC</small></span><Camera size={18} /></button>}<input ref={inputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple onChange={(event) => { selectFiles(event.target.files); event.currentTarget.value = '' }} /></div>
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
