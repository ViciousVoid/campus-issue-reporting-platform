'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

type PhotoSlide = { src: string; alt: string }

type PhotoLightboxProps = {
  photos: PhotoSlide[]
  initialIndex?: number
  onClose: () => void
  onIndexChange?: (index: number) => void
}

export function PhotoLightbox({ photos, initialIndex = 0, onClose, onIndexChange }: PhotoLightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [activeIndex, setActiveIndex] = useState(() => Math.min(Math.max(initialIndex, 0), photos.length - 1))
  const activePhoto = photos[activeIndex]

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    return () => dialog.close()
  }, [])

  function selectPhoto(index: number) {
    const nextIndex = (index + photos.length) % photos.length
    setActiveIndex(nextIndex)
    onIndexChange?.(nextIndex)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === 'ArrowLeft' && photos.length > 1) {
      event.preventDefault()
      selectPhoto(activeIndex - 1)
    }
    if (event.key === 'ArrowRight' && photos.length > 1) {
      event.preventDefault()
      selectPhoto(activeIndex + 1)
    }
  }

  if (!activePhoto) return null

  return (
    <dialog
      ref={dialogRef}
      className="photo-lightbox"
      aria-label="Issue photo viewer"
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
      onKeyDown={handleKeyDown}
    >
      <div className="photo-lightbox-toolbar">
        <span>{photos.length > 1 ? `${activeIndex + 1} of ${photos.length}` : 'Issue photo'}</span>
        <button type="button" className="photo-lightbox-close" aria-label="Close photo viewer" autoFocus onClick={onClose}><X /></button>
      </div>
      <div className="photo-lightbox-stage">
        {photos.length > 1 && <button type="button" className="photo-lightbox-nav photo-lightbox-previous" aria-label="Previous photo" onClick={() => selectPhoto(activeIndex - 1)}><ChevronLeft /></button>}
        <img src={activePhoto.src} alt={activePhoto.alt} />
        {photos.length > 1 && <button type="button" className="photo-lightbox-nav photo-lightbox-next" aria-label="Next photo" onClick={() => selectPhoto(activeIndex + 1)}><ChevronRight /></button>}
      </div>
      {photos.length > 1 && <p className="photo-lightbox-hint">Use the arrow keys to browse photos</p>}
    </dialog>
  )
}

export default PhotoLightbox

export type { PhotoSlide }

