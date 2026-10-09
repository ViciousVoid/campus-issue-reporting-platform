'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import useSWR, { mutate } from 'swr'
import { Building2, ImagePlus, LoaderCircle, LockKeyhole, Maximize2, MessageCircle, Minimize2, Send, Users, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { relativeTime } from '@/components/campus/issue-card'
import { PhotoLightbox } from '@/components/campus/photo-lightbox'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Message, MessageAvatar, MessageContent, MessageFooter, MessageGroup, MessageHeader } from '@/components/ui/message'
import { MessageScroller, MessageScrollerButton, MessageScrollerContent, MessageScrollerItem, MessageScrollerProvider, MessageScrollerViewport } from '@/components/ui/message-scroller'

type ChatAuthor = { id: string; display_name: string; avatar_url: string | null }

type CampusChatMessage = {
  id: string
  campus_id: string
  user_id: string
  body: string
  image_path: string | null
  image_url: string | null
  created_at: string
  author: { display_name: string; avatar_url: string | null } | null
}

type CampusChatProps = {
  campusId: string
  campusName: string
  userId: string | null
  expanded: boolean
  onToggleExpanded: () => void
  onRequireAuth: () => void
  anonymousName?: string
}

const supabase = createClient()
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const IMAGE_EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export function CampusChat({ campusId, campusName, userId, expanded, onToggleExpanded, onRequireAuth, anonymousName }: CampusChatProps) {
  const [body, setBody] = useState('')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => () => { if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl) }, [imagePreviewUrl])
  const messagesKey = useMemo(() => userId && campusId ? ['campus-chat', campusId] as const : null, [campusId, userId])
  const { data: messages = [], error, isLoading } = useSWR(messagesKey, async ([, id]) => {
    const { data, error: fetchError } = await supabase
      .from('campus_chat_messages')
      .select('id,campus_id,user_id,body,image_path,created_at')
      .eq('campus_id', id)
      .order('created_at', { ascending: false })
      .limit(100)
    if (fetchError) throw fetchError

    const rows = (data ?? []) as Omit<CampusChatMessage, 'author' | 'image_url'>[]
    const userIds = Array.from(new Set(rows.map((message) => message.user_id)))
    const { data: profiles } = userIds.length
      ? await supabase.from('profiles').select('id,display_name,avatar_url').in('id', userIds)
      : { data: [] }
    const authors = new Map<string, ChatAuthor>(((profiles ?? []) as ChatAuthor[]).map((profile) => [profile.id, profile]))

    return Promise.all(rows.reverse().map(async (message) => {
      let imageUrl: string | null = null
      if (message.image_path) {
        const { data: signedImage } = await supabase.storage.from('campus-chat-images').createSignedUrl(message.image_path, 60 * 60)
        imageUrl = signedImage?.signedUrl ?? null
      }
      return {
        ...message,
        image_url: imageUrl,
        author: authors.get(message.user_id) ?? null,
      }
    }))
  }, { refreshInterval: 50 * 60 * 1000 })

  async function refreshMessages() {
    if (messagesKey) await mutate(messagesKey)
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!userId) return
    const text = body.trim()
    if ((!text && !selectedImage) || sending) return

    setSending(true)
    setSendError('')
    let uploadedPath: string | null = null

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) return

      if (selectedImage) {
        const imagePath = `${campusId}/${user.id}/${crypto.randomUUID()}.${IMAGE_EXTENSIONS[selectedImage.type]}`
        const { error: uploadError } = await supabase.storage.from('campus-chat-images').upload(imagePath, selectedImage, {
          contentType: selectedImage.type,
          upsert: false,
        })
        if (uploadError) throw uploadError
        uploadedPath = imagePath
      }

      const { error: insertError } = await supabase.from('campus_chat_messages').insert({
        campus_id: campusId,
        user_id: user.id,
        body: text,
        image_path: uploadedPath,
      })
      if (insertError) throw insertError

      setBody('')
      setSelectedImage(null)
      setImagePreviewUrl(null)
      void refreshMessages().catch(() => undefined)
    } catch {
      if (uploadedPath) await supabase.storage.from('campus-chat-images').remove([uploadedPath])
      setSendError('Your message could not be sent. Check your campus account and try again.')
    } finally {
      setSending(false)
    }
  }

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    if (!IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES) {
      setSendError('Choose a JPG, PNG, or WebP image under 10 MB.')
      return
    }
    setSendError('')
    setSelectedImage(file)
    setImagePreviewUrl(URL.createObjectURL(file))
  }

  function removeSelectedImage() {
    setImagePreviewUrl(null)
    setSelectedImage(null)
  }

  function submitOnEnter(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return
    event.preventDefault()
    event.currentTarget.form?.requestSubmit()
  }

  return (
    <section className="campus-chat" aria-label={`Campus chat for ${campusName}`}>
      <header className="campus-chat-header">
        <span className="campus-chat-icon"><MessageCircle size={17} /></span>
        <div className="campus-chat-title">
          <strong>Campus chat</strong>
          <span><Building2 size={11} />{campusName}</span>
        </div>
        <button
          className="icon-button campus-chat-expand"
          type="button"
          aria-label={expanded ? 'Restore campus feed and resize chat' : 'Expand chat and collapse campus feed'}
          title={expanded ? 'Restore campus feed' : 'Expand chat'}
          onClick={onToggleExpanded}
        >{expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
      </header>

      <div className="campus-chat-community"><Users size={14} /><span>Chat with people from your campus</span></div>

      {userId ? (
        <>
          <MessageScrollerProvider>
            <MessageScroller className="campus-chat-scroller">
              <MessageScrollerViewport className="campus-chat-messages">
                <MessageScrollerContent className="campus-chat-message-list" role="log" aria-label="Campus chat messages" aria-live="polite">
                  {isLoading ? <div className="campus-chat-status"><LoaderCircle size={17} className="spin" />Loading campus messages…</div>
                    : error ? <div className="campus-chat-status campus-chat-error" role="alert">Chat messages could not be loaded.<button className="text-button" type="button" onClick={() => void refreshMessages()}>Try again</button></div>
                      : messages.length === 0 ? <div className="campus-chat-empty"><span><MessageCircle size={19} /></span><strong>Start the conversation</strong><p>Share a helpful update, ask a question, or say hello.</p></div>
                        : messages.map((message, index) => {
                          const isOwnMessage = message.user_id === userId
                          const displayName = message.author?.display_name || (message.user_id === userId ? anonymousName : null) || 'Campus guest'
                          return (
                            <MessageScrollerItem key={message.id} scrollAnchor={index === messages.length - 1}>
                              <MessageGroup className={`campus-chat-message${isOwnMessage ? ' own-message' : ''}`}>
                                <Message align={isOwnMessage ? 'end' : 'start'}>
                                  {!isOwnMessage && <MessageAvatar className="avatar campus-chat-avatar" aria-hidden="true">{message.author?.avatar_url
                                    ? <img src={message.author.avatar_url} alt="" />
                                    : displayName.slice(0, 1).toUpperCase()}</MessageAvatar>}
                                  <MessageContent className="campus-chat-message-content">
                                    {!isOwnMessage && <MessageHeader className="campus-chat-author">{displayName}</MessageHeader>}
                                    <Bubble align={isOwnMessage ? 'end' : 'start'} variant={isOwnMessage ? 'tinted' : 'muted'} className="campus-chat-bubble">
                                      <BubbleContent className="campus-chat-bubble-content">
                                        {message.body && <span>{message.body}</span>}
                                        {message.image_url && <button className="campus-chat-image-link" type="button" aria-label="View image attached to campus message" onClick={() => setViewImageUrl(message.image_url)}><img className="campus-chat-image" src={message.image_url} alt="Image attached to a campus message" /></button>}
                                      </BubbleContent>
                                    </Bubble>
                                    <MessageFooter className="campus-chat-time"><time dateTime={message.created_at}>{relativeTime(message.created_at)}</time></MessageFooter>
                                  </MessageContent>
                                </Message>
                              </MessageGroup>
                            </MessageScrollerItem>
                          )
                        })}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton direction="end" className="campus-chat-scroll-bottom" />
            </MessageScroller>
          </MessageScrollerProvider>

          <form className="campus-chat-composer" onSubmit={(event) => void sendMessage(event)}>
            {sendError && <p className="campus-chat-error" role="alert">{sendError}</p>}
            {imagePreviewUrl && <div className="campus-chat-image-preview"><img src={imagePreviewUrl} alt="Selected image preview" /><button type="button" aria-label="Remove attached image" onClick={removeSelectedImage}><X size={14} /></button></div>}
            <label className="sr-only" htmlFor="campus-chat-message">Write a campus message</label>
            <textarea
              id="campus-chat-message"
              rows={2}
              maxLength={1000}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={submitOnEnter}
              onFocus={() => undefined}
              placeholder="Message your campus…"
            />
            <div className="campus-chat-composer-footer">
              <span>Be kind and keep it campus-friendly.</span>
              <div className="campus-chat-composer-actions">
                <button className="icon-button campus-chat-attach" type="button" aria-label={userId ? 'Attach an image' : 'Sign in to attach an image'} title="Attach an image" onClick={() => userId ? imageInputRef.current?.click() : onRequireAuth()} disabled={sending}>
                  <ImagePlus size={16} />
                </button>
                <input ref={imageInputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} />
                <button className="button-primary small" type="submit" disabled={sending || (!body.trim() && !selectedImage)} aria-label="Send campus message">
                  {sending ? <LoaderCircle size={15} className="spin" /> : <Send size={15} />}
                </button>
              </div>
            </div>
          </form>
        </>
      ) : null}
      {viewImageUrl && <PhotoLightbox photos={[{ src: viewImageUrl, alt: 'Image attached to a campus message' }]} onClose={() => setViewImageUrl(null)} />}
      </section>
  )
}


export default CampusChat
