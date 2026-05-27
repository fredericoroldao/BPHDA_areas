import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const validRoles = new Set(['superadmin', 'admin', 'viewer'])

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function inviteEmailHtml({ email, name, role, appUrl }: { email: string; name: string; role: string; appUrl: string }) {
  const displayName = name || email
  return `
    <div style="font-family:Arial,sans-serif;color:#16361f;line-height:1.5">
      <h1 style="margin:0 0 12px;font-size:24px">Convite para BPHDA areas</h1>
      <p>Olá ${displayName},</p>
      <p>Foi-te dado acesso à app BPHDA areas com o perfil <strong>${role}</strong>.</p>
      <p>Para entrar, abre o link abaixo e escolhe esta conta Google:</p>
      <p><strong>${email}</strong></p>
      <p>
        <a href="${appUrl}" style="display:inline-block;background:#dcefd8;border:1px solid #6e9575;border-radius:999px;color:#16361f;font-weight:700;padding:10px 16px;text-decoration:none">
          Abrir BPHDA areas
        </a>
      </p>
      <p style="font-size:13px;color:#496350">Se o botão não abrir, copia este endereço: ${appUrl}</p>
    </div>
  `
}

async function sendCustomInviteEmail({ email, name, role, appUrl }: { email: string; name: string; role: string; appUrl: string }) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('INVITE_EMAIL_FROM')

  if (!resendApiKey || !from) {
    return {
      ok: false,
      error: 'Faltam secrets RESEND_API_KEY e/ou INVITE_EMAIL_FROM.',
    }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: 'Convite para BPHDA areas',
      html: inviteEmailHtml({ email, name, role, appUrl }),
    }),
  })

  if (!response.ok) {
    const details = await response.text()
    return { ok: false, error: `Resend devolveu erro ${response.status}: ${details}` }
  }

  return { ok: true }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Missing Supabase function secrets' }, 500)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')

  if (!token) {
    return json({ error: 'Missing Authorization header' }, 401)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: authData, error: authError } = await admin.auth.getUser(token)
  const caller = authData?.user

  if (authError || !caller?.email) {
    return json({ error: 'Invalid authenticated user' }, 401)
  }

  let { data: callerProfile, error: callerProfileError } = await admin
    .from('app_users')
    .select('id, role, status')
    .eq('user_id', caller.id)
    .maybeSingle()

  if (callerProfileError) {
    return json({ error: callerProfileError.message }, 500)
  }

  if (!callerProfile) {
    const byEmail = await admin
      .from('app_users')
      .select('id, role, status')
      .ilike('email', caller.email)
      .maybeSingle()

    if (byEmail.error) {
      return json({ error: byEmail.error.message }, 500)
    }

    callerProfile = byEmail.data
  }

  if (!callerProfile || !['superadmin', 'admin'].includes(callerProfile.role) || callerProfile.status === 'disabled') {
    return json({ error: 'Only admins can invite users' }, 403)
  }

  const body = await req.json().catch(() => ({}))
  const email = String(body.email ?? '').trim().toLowerCase()
  const name = String(body.name ?? '').trim()
  const role = String(body.role ?? 'viewer').trim()
  const redirectTo = String(body.redirectTo ?? Deno.env.get('APP_SITE_URL') ?? '').trim()
  const appUrl = redirectTo || Deno.env.get('APP_SITE_URL') || 'https://projects.brainstormphda.pt'

  if (!email || !email.includes('@')) {
    return json({ error: 'Valid email is required' }, 400)
  }

  if (!validRoles.has(role)) {
    return json({ error: 'Invalid role' }, 400)
  }

  if (role === 'superadmin' && callerProfile.role !== 'superadmin') {
    return json({ error: 'Only superadmins can invite superadmins' }, 403)
  }

  const { data: existingUser, error: existingError } = await admin
    .from('app_users')
    .select('id')
    .ilike('email', email)
    .maybeSingle()

  if (existingError) {
    return json({ error: existingError.message }, 500)
  }

  if (existingUser?.id) {
    const { error: updateError } = await admin
      .from('app_users')
      .update({ name: name || null, role, status: 'invited' })
      .eq('id', existingUser.id)

    if (updateError) return json({ error: updateError.message }, 500)
  } else {
    const { error: insertError } = await admin
      .from('app_users')
      .insert({ email, name: name || null, role, status: 'invited' })

    if (insertError) return json({ error: insertError.message }, 500)
  }

  const customEmail = await sendCustomInviteEmail({ email, name, role, appUrl })
  if (!customEmail.ok) {
    return json({
      email,
      role,
      error: `O acesso foi criado/atualizado na app, mas o email de convite não foi enviado: ${customEmail.error}`,
    }, 502)
  }

  return json({ ok: true, email, role, emailSent: true })
})
