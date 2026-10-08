'use client'

import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Camera, ImagePlus, LoaderCircle } from 'lucide-react'
import { CATEGORY_IMAGES, STATUS_LABELS, type CampusIssue } from '@/lib/campus'
import { statusStyles } from '@/components/campus/issue-card'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
const MAX_PHOTOS = 5
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

type IssuePhotoGalleryProps = {
  issue: CampusIssue
  userId: string | null
  onRequireAuth: () => void
  onPhotosChanged: () => Promise<void>
}

export function IssuePhotoGallery({ issue, userId, onRequireAuth, onPhotosChanged }: IssuePhotoGalleryProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedPath, setSelectedPath] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const photos = useMemo(
    () => (issue.media ?? []).slice().sort((left, right) => left.display_order - right.display_order),
    [issue.media],
  )
  const selectedPhoto = photos.find((photo) => photo.storage_path === selectedPath) ?? photos[0]
  const category = issue.custom_category || issue.category?.name || 'Campus'
  const imageUrl = selectedPhoto
    ? supabase.storage.from('issue-photos').getPublicUrl(selectedPhoto.storage_path).data.publicUrl
    : `https://images.unsplash.com/${CATEGORY_IMAGES[category] ?? CATEGORY_IMAGES.Other}?auto=format&fit=crop&w=1200&q=82`
  const canAddPhotos = issue.moderation_status === 'approved' || Boolean(userId && issue.reporter_id === userId)
  const remainingSlots = Math.max(0, MAX_PHOTOS - photos.length)

  async function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = event.currentTarget.files ? Array.from(event.currentTarget.files) : []
    event.currentTarget.value = ''
    if (!selectedFiles.length) return
    if (!userId) {
      onRequireAuth()
      return
    }
    if (photos.length + selectedFiles.length > MAX_PHOTOS) {
      setError(`Choose up to ${MAX_PHOTOS} photos for this report.`)
      return
    }
    const invalidFile = selectedFiles.find((file) => !ACCEPTED_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES)
    if (invalidFile) {
      setError('Choose JPG, PNG, WebP, or HEIC photos under 10 MB each.')
      return
    }

    setUploading(true)
    setError('')
    setNotice('')
    const uploads = await Promise.all(selectedFiles.map(async (file) => {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100)
      const path = `${userId}/${issue.id}/${crypto.randomUUID()}-${safeName}`
      const { error: uploadError } = await supabase.storage.from('issue-photos').upload(path, file, {
        contentType: file.type,
        upsert: false,
      })
      return { path, error: uploadError }
    }))
    const uploadedPaths = uploads.filter((upload) => !upload.error).map((upload) => upload.path)
    const uploadFailed = uploads.some((upload) => upload.error)
    const firstOrder = photos.reduce((maximum, photo) => Math.max(maximum, photo.display_order), -1) + 1
    const mediaResult = uploadFailed ? null : await supabase.from('issue_media').insert(
      uploadedPaths.map((path, index) => ({ issue_id: issue.id, storage_path: path, display_order: firstOrder + index })),
    )

    if (uploadFailed || mediaResult?.error) {
      if (uploadedPaths.length) await supabase.storage.from('issue-photos').remove(uploadedPaths)
      setError('Your photos could not be attached. Please try again.')
      setUploading(false)
      return
    }

    setSelectedPath(uploadedPaths[0] ?? '')
    setNotice(`${uploadedPaths.length} ${uploadedPaths.length === 1 ? 'photo' : 'photos'} added to this report.`)
    setUploading(false)
    await onPhotosChanged()
  }

  return (
    <section className="issue-photo-gallery" aria-label="Report photos">
      <div className="detail-image">
        <img className="detail-photo" src={imageUrl} alt={`${category} issue at ${issue.custom_location || issue.location?.name || 'campus'}`} />
        <span className={`status-pill ${statusStyles[issue.status] ?? 'status-reported'}`}><span className="status-dot" />{STATUS_LABELS[issue.status]}</span>
      </div>
      {photos.length > 1 && (
        <div className="photo-thumbnail-list" role="group" aria-label="Select a report photo">
          {photos.map((photo, index) => {
            const thumbnailUrl = supabase.storage.from('issue-photos').getPublicUrl(photo.storage_path).data.publicUrl
            const isSelected = selectedPhoto?.storage_path === photo.storage_path
            return (
              <button
                key={photo.storage_path}
                type="button"
                className={`photo-thumbnail${isSelected ? ' is-selected' : ''}`}
                aria-label={`Show photo ${index + 1} of ${photos.length}`}
                aria-pressed={isSelected}
                onClick={() => setSelectedPath(photo.storage_path)}
              >
                <img src={thumbnailUrl} alt="" />
              </button>
            )
          })}
        </div>
      )}
      <div className="community-photo-row">
        <span><Camera size={14} aria-hidden="true" />{photos.length ? `${photos.length} of ${MAX_PHOTOS} photos` : 'No photos added yet'}</span>
        {canAddPhotos && remainingSlots > 0 && (
          <>
            <button type="button" className="button-secondary small" onClick={() => userId ? inputRef.current?.click() : onRequireAuth()} disabled={uploading}>
              {uploading ? <LoaderCircle size={14} className="spin" /> : <ImagePlus size={14} />}
              {uploading ? 'Adding photos…' : userId ? 'Add photos' : 'Sign in to add photos'}
            </button>
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              multiple
              onChange={(event) => void addPhotos(event)}
            />
          </>
        )}
        {!canAddPhotos && <span className="photo-contribution-note">Photos open after moderator approval.</span>}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="photo-upload-notice" role="status">{notice}</p>}
    </section>
  )
}

export default IssuePhotoGallery
