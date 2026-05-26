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

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: redirectTo || undefined,
    data: { name, role },
  })

  if (inviteError) {
    return json({ error: inviteError.message }, 500)
  }

  return json({ ok: true, email, role })
})
