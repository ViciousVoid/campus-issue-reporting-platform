'use client'

import { useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { ArrowLeft, CheckCircle2, LoaderCircle, LockKeyhole, Mail, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isHiddenCampus } from '@/lib/campus'

type AuthDialogProps = { onClose: () => void; onAuthenticated: (userId: string, displayName?: string) => void }
type SignupCampus = { id: string; name: string; slug: string; signup_enabled: boolean }
const supabase = createClient()

export function AuthDialog({ onClose, onAuthenticated }: AuthDialogProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [displayName, setDisplayName] = useState('')
  const [campusSlug, setCampusSlug] = useState('sgsits-indore')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [pending, setPending] = useState(false)
  const { data: campuses = [] } = useSWR('signup-campuses', async () => {
    const { data, error } = await supabase.from('campuses').select('id,name,slug,signup_enabled').order('name')
    if (error) throw error
    return ((data ?? []) as SignupCampus[]).filter((campus) => !isHiddenCampus(campus))
  })

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (password.length < 8) { setError('Use a password with at least 8 characters.'); return }
    if (mode === 'signup' && !campuses.some((campus) => campus.slug === campusSlug && campus.signup_enabled)) {
      setError('Choose a campus that is currently open for signup.')
      return
    }
    setPending(true)
    if (mode === 'signup') {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(), password,
        options: {
          emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback`,
          data: { display_name: displayName.trim() || email.split('@')[0], campus_slug: campusSlug },
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
                <span className="eyebrow">CAMPUSHEAT ACCOUNT</span>
        <h2 id="auth-title">{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>
        <p className="auth-subtitle">{mode === 'signin' ? 'Sign in to vote and follow campus reports.' : 'Choose your campus to create a student account.'}</p>
        {success ? <div className="auth-success"><CheckCircle2 size={21} /><strong>Check your email</strong><p>{success}</p>
<button className="button-secondary" onClick={() => { setSuccess(''); setMode('signin') }}><ArrowLeft size={14} /> Back to sign in</button></div> : <form className="auth-form" onSubmit={submit}>
          {mode === 'signup' && <>
            <label className="form-field"><span>Your name</span><input autoComplete="name" maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="How should we address you?" /></label>
            <label className="form-field"><span>College campus</span><select required value={campusSlug} onChange={(event) => setCampusSlug(event.target.value)}>{campuses.filter((campus) => campus.signup_enabled).map((campus) => <option key={campus.id} value={campus.slug}>{campus.name}</option>)}</select><small className="auth-campus-note">Choose the campus where you&apos;re enrolled.</small></label>
          </>}
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
