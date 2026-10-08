'use client'

import { useRef, type ChangeEvent } from 'react'
import { Flame, ImagePlus, LoaderCircle } from 'lucide-react'

type CampusHeroArtProps = {
  imageUrl: string | null
  uploading: boolean
  canEdit: boolean
  onChooseFile: (file: File) => void
  onRequireAuth: () => void
}

export function CampusHeroArt({ imageUrl, uploading, canEdit, onChooseFile, onRequireAuth }: CampusHeroArtProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (file) onChooseFile(file)
  }

  return (
    <div className={`welcome-art${imageUrl ? ' has-campus-image' : ''}`}>
      {imageUrl ? <img className="welcome-art-photo" src={imageUrl} alt="" /> : (
        <div className="art-illustration" aria-hidden="true">
          <div className="art-sun" />
          <div className="art-ground ground-back" />
          <div className="art-ground ground-front" />
          <div className="art-building building-one"><span /><span /><span /><span /></div>
          <div className="art-building building-two"><span /><span /><span /></div>
          <div className="art-tree tree-one" />
          <div className="art-tree tree-two" />
          <div className="art-path" />
          <span className="art-spark spark-one">✳</span>
          <span className="art-spark spark-two">✳</span>
          <div className="art-note"><span><Flame size={14} fill="currentColor" /></span><strong>Good change<br />is contagious.</strong></div>
        </div>
      )}
      {imageUrl && <span className="welcome-art-vignette" aria-hidden="true" />}
      <input
        ref={inputRef}
        hidden
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Choose a replacement campus image"
        tabIndex={-1}
        onChange={handleFileChange}
      />
      <button
        type="button"
        className="campus-image-control"
        disabled={uploading}
        onClick={() => canEdit ? inputRef.current?.click() : onRequireAuth()}
        aria-label={canEdit ? imageUrl ? 'Replace the shared campus image' : 'Add a shared campus image' : 'Sign in to change the shared campus image'}
        title={canEdit ? imageUrl ? 'Replace the shared campus image' : 'Add a shared campus image' : 'Sign in to change the shared campus image'}
      >
        {uploading ? <LoaderCircle size={14} className="spin" aria-hidden="true" /> : <ImagePlus size={14} aria-hidden="true" />}
        <span>{uploading ? 'Uploading…' : !canEdit ? 'Sign in to change image' : imageUrl ? 'Change shared image' : 'Add shared image'}</span>
      </button>
    </div>
  )
}
