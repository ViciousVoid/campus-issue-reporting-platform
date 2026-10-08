'use client'

import { useState, type FormEvent } from 'react'
import { ArrowLeft, CheckCircle2, LoaderCircle, LockKeyhole, Mail, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type AuthDialogProps = { onClose: () => void; onAuthenticated: (userId: string, displayName?: string) => void }
const supabase = createClient()

export function AuthDialog({ onClose, onAuthenticated }: AuthDialogProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (password.length < 8) { setError('Use a password with at least 8 characters.'); return }
    setPending(true)
    if (mode === 'signup') {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(), password,
        options: {
          emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback`,
          data: { display_name: displayName.trim() || email.split('@')[0] },
        },
      })
      setPending(false)
      if (authError) {
        const message = authError.message.toLowerCase()
        setError(message.includes('password') ? 'Please choose a stronger password.' : message.includes('rate') ? 'Too many attempts. Please try again shortly.' : 'Could not create your account. Check your details and try again.')
      } else if (data.session && data.user) {
        onAuthenticated(data.user.id, displayName.trim())
      } else {
        setSuccess('Check your inbox for a confirmation link. Once confirmed, sign in to join your campus.')
      }
      return
    }
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setPending(false)
    if (authError) {
      const message = authError.message.toLowerCase()
      setError(message.includes('email not confirmed') ? 'Please confirm your email from the link we sent before signing in.' : message.includes('rate') ? 'Too many attempts. Please try again shortly.' : 'Invalid email or password. Please try again.')
      return
    }
    if (data.user) onAuthenticated(data.user.id, data.user.user_metadata?.display_name)
  }

  return (
    <div className="overlay auth-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="icon-button auth-close" onClick={onClose} aria-label="Close sign in"><X size={20} /></button>
        <div className="auth-mark"><span className="brand-symbol"><span>c</span></span></div>
        <span className="eyebrow">YOUR CAMPUS, YOUR VOICE</span>
        <h2 id="auth-title">{mode === 'signin' ? 'Welcome back.' : 'Join your campus.'}</h2>
        <p className="auth-subtitle">{mode === 'signin' ? 'Sign in to support reports and follow campus progress.' : 'Create an account to share what needs attention.'}</p>
        {success ? <div className="auth-success"><CheckCircle2 size={21} /><strong>One last step</strong><p>{success}</p><button className="button-secondary" onClick={() => { setSuccess(''); setMode('signin') }}><ArrowLeft size={14} /> Back to sign in</button></div> : <form className="auth-form" onSubmit={submit}>
          {mode === 'signup' && <label className="form-field"><span>Your name</span><input autoComplete="name" maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="How should we address you?" /></label>}
          <label className="form-field"><span>Email address</span><span className="input-with-icon"><Mail size={16} /><input autoComplete="email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@university.edu" /></span></label>
          <label className="form-field"><span>Password</span><span className="input-with-icon"><LockKeyhole size={16} /><input autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></span></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button-primary auth-submit" disabled={pending}>{pending && <LoaderCircle size={16} className="spin" />}{pending ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
          <p className="auth-switch">{mode === 'signin' ? 'New to campusheat?' : 'Already have an account?'} <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError('') }}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</button></p>
          <p className="auth-privacy">By continuing, you agree to keep campusheat constructive and respectful.</p>
        </form>}
      </section>
    </div>
  )
}

export default AuthDialog
