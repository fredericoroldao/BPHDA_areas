import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const pageStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  minHeight: '100svh',
  width: '100vw',
  background: '#f6f8f4',
  color: '#16361f',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'clamp(18px, 4vw, 56px)',
  boxSizing: 'border-box',
  textAlign: 'left',
  fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}

const panelStyle = {
  width: 'min(760px, 100%)',
  background: '#fff',
  border: '1px solid #b8c9b5',
  borderRadius: 16,
  padding: 'clamp(24px, 4vw, 42px)',
  textAlign: 'left',
  boxShadow: '0 10px 28px rgba(37, 65, 42, 0.10)',
}

const buttonStyle = {
  minHeight: 46,
  borderRadius: 999,
  border: '2px solid #6e9575',
  background: '#dcefd8',
  color: '#16361f',
  cursor: 'pointer',
  fontWeight: 700,
  padding: '10px 18px',
}

const authLogoStyle = {
  display: 'block',
  width: 'min(520px, 100%)',
  height: 'auto',
  marginBottom: 24,
}

const authTitleStyle = {
  margin: '0 0 12px',
  fontSize: 'clamp(30px, 3.4vw, 42px)',
  lineHeight: 1.05,
  color: '#16361f',
  fontWeight: 760,
  letterSpacing: 0,
  fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}

const authTextStyle = {
  margin: '0 0 24px',
  color: '#496350',
  fontSize: 'clamp(17px, 1.5vw, 21px)',
  lineHeight: 1.35,
  fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase()
}

function getCleanCurrentUrl() {
  return `${window.location.origin}${window.location.pathname}`
}

function cleanAuthUrl() {
  if (window.location.hash.includes('access_token') || window.location.hash.includes('refresh_token')) {
    window.history.replaceState({}, document.title, getCleanCurrentUrl())
  }
}

function getSessionFromUrlHash() {
  const hash = window.location.hash
  if (!hash.includes('access_token') || !hash.includes('refresh_token')) return null

  const params = new URLSearchParams(hash.replace(/^#+/, ''))
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  if (!accessToken || !refreshToken) return null

  return { access_token: accessToken, refresh_token: refreshToken }
}

export default function AuthGate({ children, requiredRoles = [], exposeProfile = false }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function init() {
      const urlSession = getSessionFromUrlHash()
      if (urlSession) {
        await supabase.auth.setSession(urlSession)
        cleanAuthUrl()
      }

      const { data, error: sessionError } = await supabase.auth.getSession()
      if (cancelled) return
      if (sessionError) {
        setError(sessionError.message)
        setLoading(false)
        return
      }
      setSession(data.session ?? null)
      await loadProfile(data.session)
    }

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      loadProfile(nextSession)
    })

    init()

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [])

  async function loadProfile(nextSession) {
    setError('')
    setProfile(null)
    if (!nextSession?.user?.email) {
      setLoading(false)
      return
    }

    setLoading(true)
    const email = normalizeEmail(nextSession.user.email)
    await supabase.rpc('claim_app_user')

    const { data, error: profileError } = await supabase
      .from('app_users')
      .select('id, user_id, email, name, role, status')
      .eq('email', email)
      .maybeSingle()

    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }

    setProfile(data ?? null)
    setLoading(false)
  }

  async function signIn(forceAccountChoice = false) {
    setError('')
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getCleanCurrentUrl(),
        queryParams: forceAccountChoice ? { prompt: 'select_account' } : undefined,
      },
    })
    if (signInError) setError(signInError.message)
  }

  async function signOut() {
    if (!window.confirm('Queres mesmo sair da app?')) return
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
    cleanAuthUrl()
  }

  async function signInWithAnotherAccount() {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
    await signIn(true)
  }

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={panelStyle}>A validar acesso...</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div style={pageStyle}>
        <div style={panelStyle}>
          <img src="https://img.brainstormphda.pt/marca/logo/BPHDA_logo_pt_horizontal_verde.png" alt="BPHDA" style={authLogoStyle} />
          <p style={authTextStyle}>Acesso reservado a utilizadores convidados. Entra com a tua conta Google.</p>
          {error ? <p style={{ color: '#8a2f2f', margin: '0 0 12px' }}>{error}</p> : null}
          <button type="button" onClick={() => signIn(true)} style={buttonStyle}>Entrar com Google</button>
        </div>
      </div>
    )
  }

  if (!profile || profile.status === 'disabled') {
    return (
      <div style={pageStyle}>
        <div style={panelStyle}>
          <h1 style={authTitleStyle}>Acesso não autorizado</h1>
          <p style={authTextStyle}>
            A conta {session.user.email} ainda não está convidada para esta app.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={signInWithAnotherAccount} style={buttonStyle}>Entrar com outra conta Google</button>
            <button type="button" onClick={signOut} style={{ ...buttonStyle, background: '#fff' }}>Sair</button>
          </div>
        </div>
      </div>
    )
  }

  const allowedRoles = requiredRoles.includes('admin') ? [...requiredRoles, 'superadmin'] : requiredRoles

  if (allowedRoles.length && !allowedRoles.includes(profile.role)) {
    return (
      <div style={pageStyle}>
        <div style={panelStyle}>
          <h1 style={authTitleStyle}>Sem permissão para o editor</h1>
          <p style={authTextStyle}>
            A conta {session.user.email} tem acesso à vista pública, mas não tem permissões de admin.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href="/" style={{ ...buttonStyle, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Abrir vista pública</a>
            <button type="button" onClick={signOut} style={buttonStyle}>Sair</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div style={{ position: 'fixed', right: 12, top: 12, zIndex: 50, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ background: '#fff', border: '1px solid #b8c9b5', borderRadius: 999, padding: '6px 10px', fontSize: 12, color: '#35513c' }}>
          {profile.email} · {profile.role}
        </span>
        {['admin', 'superadmin'].includes(profile.role) && window.location.pathname !== '/editor.html' ? (
          <a
            href="/editor.html"
            style={{ ...buttonStyle, minHeight: 30, padding: '5px 10px', background: '#fff', fontSize: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
          >
            Editor
          </a>
        ) : null}
        <button type="button" onClick={signOut} style={{ ...buttonStyle, minHeight: 30, padding: '5px 10px', background: '#fff' }}>Sair</button>
      </div>
      {typeof children === 'function' && exposeProfile ? children({ session, profile, signOut }) : children}
    </>
  )
}
