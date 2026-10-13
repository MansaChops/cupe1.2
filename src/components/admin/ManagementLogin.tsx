import { useEffect, useState } from 'react'
import { AuthError, acceptInvite, getUser, handleAuthCallback, login, logout, requestPasswordRecovery, updateUser } from '@netlify/identity'
import { Lock } from 'lucide-react'
import { img, site } from '@/config/site'
import { getAdminSession } from '@/server/admin'

// The management sign-in. It isn't linked from anywhere: it opens at /#management, and when a
// Netlify Identity email link (invite, password reset) lands on any page with its token.

type Mode = 'checking' | 'login' | 'forgot' | 'invite' | 'recovery'

const message = (err: unknown) => {
  if (err instanceof AuthError) {
    if (err.status === 401 || err.status === 400) return 'Incorrect email or password.'
    if (err.status === 422) return 'Check your email address and password (at least 8 characters).'
    return err.message
  }
  return 'Sign-in is unavailable right now. Please try again.'
}

const DASHBOARD = '/admin/dashboard'

// handleAuthCallback() consumes the token in the URL hash, so it must only ever run once per page
// load, even if the effect below runs twice (React StrictMode in development).
let callback: ReturnType<typeof handleAuthCallback> | null = null
const authCallbackOnce = () => (callback ??= handleAuthCallback())
// Full navigation so the server sees the new session cookie.
const enter = () => window.location.assign(DASHBOARD)

export function ManagementLogin({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('checking')
  const [inviteToken, setInviteToken] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // Identity emails link back with a token in the hash: invite → create account, recovery → new password.
        const result = await authCallbackOnce()
        if (cancelled) return
        if (result?.type === 'invite' && result.token) {
          setInviteToken(result.token)
          return setMode('invite')
        }
        if (result?.type === 'recovery') return setMode('recovery')
        if (result) return enter()
        // Already signed in with management access: go straight in.
        if (await getAdminSession()) return enter()
        const u = await getUser()
        if (u) setNotice(`${u.email} is signed in but doesn’t have management access.`)
      } catch (e) {
        setError(message(e))
      }
      if (!cancelled) setMode('login')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (mode === 'login') {
        await login(email.trim(), password)
        enter()
      } else if (mode === 'invite') {
        await acceptInvite(inviteToken, password)
        if (name.trim()) await updateUser({ data: { full_name: name.trim() } }).catch(() => {})
        enter()
      } else if (mode === 'recovery') {
        await updateUser({ password })
        enter()
      } else {
        await requestPasswordRecovery(email.trim())
        setNotice('If that address has an account, a reset link is on its way.')
        setMode('login')
      }
    } catch (err) {
      setError(message(err))
    } finally {
      setBusy(false)
    }
  }

  const title = { checking: 'Management', login: 'Management sign in', forgot: 'Reset password', invite: 'Create your account', recovery: 'Choose a new password' }[mode]

  return (
    // The store theme sets position: relative, so it goes on an inner wrapper to keep the overlay fixed.
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <main className="theme-store min-h-full grid place-items-center px-5 py-16">
        <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-line bg-card p-7 rise" aria-busy={mode === 'checking'}>
          <img src={img(site.logoMark, 96, 96)} alt="" width={44} height={44} className="size-11 rounded-lg" />
          <p className="label text-ink-3 mt-6">{site.name}</p>
          <h1 className="font-display text-4xl mt-1">{title}</h1>
          {mode === 'invite' && <p className="mt-2 text-sm text-ink-2">You’ve been invited to manage the shop. Add your name and choose a password.</p>}

          {notice && <p className="mt-5 rounded-xl bg-amber-soft px-4 py-3 text-sm text-ink-2">{notice}</p>}

          {mode === 'checking' ? (
            <p className="mt-6 text-sm text-ink-3">Checking your session…</p>
          ) : (
            <>
              <div className="mt-6 grid gap-4">
                {mode === 'invite' && (
                  <label className="grid gap-1.5">
                    <span className="text-sm font-medium">Your name</span>
                    <input className="field" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Joel" />
                  </label>
                )}
                {(mode === 'login' || mode === 'forgot') && (
                  <label className="grid gap-1.5">
                    <span className="text-sm font-medium">Email</span>
                    <input className="field" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </label>
                )}
                {mode !== 'forgot' && (
                  <label className="grid gap-1.5">
                    <span className="text-sm font-medium">{mode === 'login' ? 'Password' : 'New password'}</span>
                    <input
                      className="field"
                      type="password"
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      minLength={mode === 'login' ? undefined : 8}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    {mode !== 'login' && <span className="text-xs text-ink-3">At least 8 characters.</span>}
                  </label>
                )}
              </div>

              {error && <p role="alert" className="mt-5 rounded-xl bg-oxblood-soft px-4 py-3 text-sm text-oxblood">{error}</p>}

              <button className="btn btn-primary w-full mt-6" disabled={busy} aria-busy={busy}>
                <Lock size={15} />{' '}
                {busy ? 'Please wait…' : mode === 'forgot' ? 'Send reset link' : mode === 'login' ? 'Sign in' : mode === 'invite' ? 'Create account' : 'Save and continue'}
              </button>

              <div className="mt-5 flex justify-between text-sm text-ink-2">
                {mode === 'login' ? (
                  <button type="button" onClick={() => setMode('forgot')} className="hover:text-ink">Forgot password?</button>
                ) : mode === 'forgot' ? (
                  <button type="button" onClick={() => setMode('login')} className="hover:text-ink">Back to sign in</button>
                ) : (
                  <span />
                )}
                {notice && mode === 'login' ? (
                  <button type="button" onClick={() => logout().then(() => setNotice(''))} className="hover:text-ink">Sign out</button>
                ) : (
                  <button type="button" onClick={onClose} className="hover:text-ink">Back to shop</button>
                )}
              </div>
            </>
          )}
        </form>
      </main>
    </div>
  )
}
