'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import useSWR, { mutate } from 'swr'
import { Building2, LoaderCircle, LockKeyhole, Maximize2, MessageCircle, Minimize2, Send, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { relativeTime } from '@/components/campus/issue-card'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Message, MessageAvatar, MessageContent, MessageFooter, MessageGroup, MessageHeader } from '@/components/ui/message'
import { MessageScroller, MessageScrollerButton, MessageScrollerContent, MessageScrollerItem, MessageScrollerProvider, MessageScrollerViewport } from '@/components/ui/message-scroller'

type CampusChatMessage = {
  id: string
  campus_id: string
  user_id: string
  body: string
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
}

const supabase = createClient()

export function CampusChat({ campusId, campusName, userId, expanded, onToggleExpanded, onRequireAuth }: CampusChatProps) {
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const messagesKey = useMemo(() => userId && campusId ? ['campus-chat', campusId] as const : null, [campusId, userId])
  const { data: messages = [], error, isLoading } = useSWR(messagesKey, async ([, id]) => {
    const { data, error: fetchError } = await supabase
      .from('campus_chat_messages')
      .select('id,campus_id,user_id,body,created_at,author:profiles!campus_chat_messages_user_id_fkey(display_name,avatar_url)')
      .eq('campus_id', id)
      .order('created_at', { ascending: false })
      .limit(100)
    if (fetchError) throw fetchError
    return ((data ?? []) as unknown as CampusChatMessage[]).reverse()
  })

  useEffect(() => {
    if (!campusId || !userId || !messagesKey) return
    const channel = supabase
      .channel(`campus-chat:${campusId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'campus_chat_messages',
        filter: `campus_id=eq.${campusId}`,
      }, () => { void mutate(messagesKey) })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [campusId, messagesKey, userId])

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!userId) {
      onRequireAuth()
      return
    }
    const text = body.trim()
    if (!text || sending) return

    setSending(true)
    setSendError('')
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      setSending(false)
      onRequireAuth()
      return
    }

    const { error: insertError } = await supabase.from('campus_chat_messages').insert({
      campus_id: campusId,
      user_id: user.id,
      body: text,
    })
    setSending(false)
    if (insertError) {
      setSendError('Your message could not be sent. Check that your account is set to this campus and try again.')
      return
    }
    setBody('')
    await mutate(messagesKey)
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

      {!userId ? (
        <div className="campus-chat-gate">
          <span><LockKeyhole size={19} /></span>
          <strong>Your campus, together</strong>
          <p>Sign in with your campus account to join the conversation.</p>
          <button className="button-primary small" type="button" onClick={onRequireAuth}>Sign in to chat</button>
        </div>
      ) : (
        <>
          <MessageScrollerProvider>
            <MessageScroller className="campus-chat-scroller">
              <MessageScrollerViewport className="campus-chat-messages">
                <MessageScrollerContent className="campus-chat-message-list" role="log" aria-label="Campus chat messages" aria-live="polite">
                  {isLoading ? <div className="campus-chat-status"><LoaderCircle size={17} className="spin" />Loading campus messages…</div>
                    : error ? <div className="campus-chat-status campus-chat-error">Chat messages could not be loaded. Please try again.</div>
                      : messages.length === 0 ? <div className="campus-chat-empty"><span><MessageCircle size={19} /></span><strong>Start the conversation</strong><p>Share a helpful update, ask a question, or say hello.</p></div>
                        : messages.map((message, index) => {
                          const isOwnMessage = message.user_id === userId
                          const displayName = message.author?.display_name || 'Campus student'
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
                                      <BubbleContent className="campus-chat-bubble-content">{message.body}</BubbleContent>
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
            <label className="sr-only" htmlFor="campus-chat-message">Write a campus message</label>
            <textarea
              id="campus-chat-message"
              rows={2}
              maxLength={1000}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onFocus={() => { if (!userId) onRequireAuth() }}
              placeholder="Message your campus…"
            />
            <div className="campus-chat-composer-footer">
              <span>Be kind and keep it campus-friendly.</span>
              <button className="button-primary small" type="submit" disabled={sending || !body.trim()} aria-label="Send campus message">
                {sending ? <LoaderCircle size={15} className="spin" /> : <Send size={15} />}
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  )
}

export default CampusChat
