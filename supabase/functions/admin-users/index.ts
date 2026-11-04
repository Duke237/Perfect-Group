import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function constantTimeMatches(value: string, expected: string) {
  const encoder = new TextEncoder()
  const [actualHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(value)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ])
  const actual = new Uint8Array(actualHash)
  const reference = new Uint8Array(expectedHash)
  let difference = actual.length ^ reference.length
  for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ reference[index]
  return difference === 0
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceRoleKey) {
    return respond({ error: 'The administrator service is not configured.' }, 500)
  }

  const authorization = request.headers.get('Authorization') || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) return respond({ error: 'Sign in is required.' }, 401)

  const authClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const adminClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let payload: Record<string, unknown>
  try {
    const parsed: unknown = await request.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return respond({ error: 'A valid action is required.' }, 400)
    }
    payload = parsed as Record<string, unknown>
  } catch {
    return respond({ error: 'The request body must be valid JSON.' }, 400)
  }

  const action = payload.action
  if (action === 'bootstrap') {
    const setupToken = Deno.env.get('INITIAL_ADMIN_SETUP_TOKEN')
    const providedToken = typeof payload.setup_token === 'string' ? payload.setup_token : ''
    if (!setupToken || setupToken.length < 32) return respond({ error: 'First-administrator setup is not enabled. Contact your project administrator.' }, 503)
    if (!providedToken || !(await constantTimeMatches(providedToken, setupToken))) {
      return respond({ error: 'The first-administrator setup token is invalid.' }, 403)
    }

    const fullName = typeof payload.full_name === 'string' ? payload.full_name.trim() : ''
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
    const password = typeof payload.password === 'string' ? payload.password : ''
    if (!fullName || fullName.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return respond({ error: 'Enter a valid name and email address.' }, 400)
    }
    if (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      return respond({ error: 'Password must be at least 12 characters and include uppercase and lowercase letters and a number.' }, 400)
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (createError || !created.user) return respond({ error: `Account could not be created: ${createError?.message || 'No user was returned.'}` }, 400)
    const { error: claimError } = await adminClient.rpc('bootstrap_first_site_admin', {
      target_user_id: created.user.id,
      target_full_name: fullName,
    })
    if (claimError) {
      const { error: cleanupError } = await adminClient.auth.admin.deleteUser(created.user.id)
      const message = cleanupError
        ? `First administrator setup failed (${claimError.message}), and incomplete account cleanup failed (${cleanupError.message}).`
        : claimError.message.includes('already configured')
          ? 'An active administrator is already configured. The temporary account was removed.'
          : `First administrator setup failed: ${claimError.message}. The temporary account was removed.`
      return respond({ error: message }, 409)
    }
    return respond({ user: { user_id: created.user.id, full_name: fullName, email, role: 'admin', is_active: true } }, 201)
  }

  const { data: authData, error: authError } = await authClient.auth.getUser(token)
  if (authError || !authData.user) return respond({ error: 'Your session is invalid or expired.' }, 401)

  const { data: actor, error: actorError } = await adminClient
    .from('user_profiles')
    .select('role,is_active')
    .eq('user_id', authData.user.id)
    .maybeSingle()
  if (actorError) return respond({ error: `Administrator access could not be verified: ${actorError.message}` }, 500)
  if (actor?.role !== 'admin' || actor.is_active !== true) return respond({ error: 'Administrator access is required.' }, 403)

  if (action === 'list') {
    const [{ data: profiles, error: profilesError }, { data: authUsers, error: usersError }] = await Promise.all([
      adminClient.from('user_profiles').select('user_id,full_name,role,is_active,created_at,phone,avatar_url').order('created_at', { ascending: true }),
      adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ])
    if (profilesError) return respond({ error: `User profiles could not be loaded: ${profilesError.message}` }, 500)
    if (usersError) return respond({ error: `Authentication accounts could not be loaded: ${usersError.message}` }, 500)
    const emailById = new Map((authUsers.users || []).map((user) => [user.id, user.email || '']))
    const users = (profiles || []).map((profile) => ({ ...profile, email: emailById.get(profile.user_id) || '' }))
    return respond({ users })
  }

  if (action === 'create') {
    const fullName = typeof payload.full_name === 'string' ? payload.full_name.trim() : ''
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
    const password = typeof payload.password === 'string' ? payload.password : ''
    const role = payload.role === 'admin' ? 'admin' : payload.role === 'editor' ? 'editor' : ''
    const phone = typeof payload.phone === 'string' ? payload.phone.trim() : ''
    if (!fullName || fullName.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return respond({ error: 'Enter a valid name and email address.' }, 400)
    }
    if (phone.length > 40) return respond({ error: 'Phone number must be 40 characters or fewer.' }, 400)
    if (!role) return respond({ error: 'Choose a valid user role.' }, 400)
    if (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      return respond({ error: 'Password must be at least 12 characters and include uppercase and lowercase letters and a number.' }, 400)
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (createError || !created.user) return respond({ error: `Account could not be created: ${createError?.message || 'No user was returned.'}` }, 400)
    const { error: profileError } = await adminClient.from('user_profiles').insert({
      user_id: created.user.id,
      full_name: fullName,
      phone,
      role,
      is_active: true,
    })
    if (profileError) {
      const { error: cleanupError } = await adminClient.auth.admin.deleteUser(created.user.id)
      const message = cleanupError
        ? `The account profile could not be created (${profileError.message}), and account cleanup failed (${cleanupError.message}).`
        : `The account profile could not be created: ${profileError.message}. The incomplete account was removed.`
      return respond({ error: message }, 500)
    }
    return respond({ user: { user_id: created.user.id, full_name: fullName, email, role, is_active: true } }, 201)
  }

  const targetId = typeof payload.user_id === 'string' ? payload.user_id : ''
  if (!targetId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId)) {
    return respond({ error: 'A valid user ID is required.' }, 400)
  }

  if (action === 'update') {
    const hasRole = Object.prototype.hasOwnProperty.call(payload, 'role')
    const hasActive = Object.prototype.hasOwnProperty.call(payload, 'is_active')
    const hasName = Object.prototype.hasOwnProperty.call(payload, 'full_name')
    const hasEmail = Object.prototype.hasOwnProperty.call(payload, 'email')
    const hasPhone = Object.prototype.hasOwnProperty.call(payload, 'phone')
    const allowedKeys = new Set(['action', 'user_id', 'role', 'is_active', 'full_name', 'email', 'phone'])
    if (Object.keys(payload).some((key) => !allowedKeys.has(key))) return respond({ error: 'The request contains unsupported account fields.' }, 400)
    if ((hasRole && hasActive) || (!hasRole && !hasActive && !hasName && !hasEmail && !hasPhone)) {
      return respond({ error: 'Choose a role, status, name, email or phone to update.' }, 400)
    }
    if ((hasRole || hasActive) && (hasName || hasEmail || hasPhone)) {
      return respond({ error: 'Update access settings separately from account details.' }, 400)
    }
    if (hasRole && payload.role !== 'admin' && payload.role !== 'editor') return respond({ error: 'Choose a valid user role.' }, 400)
    if (hasActive && typeof payload.is_active !== 'boolean') return respond({ error: 'Account status must be active or inactive.' }, 400)
    if (targetId === authData.user.id && ((hasRole && payload.role !== 'admin') || (hasActive && payload.is_active === false))) {
      return respond({ error: 'You cannot remove your own administrator access.' }, 400)
    }
    const fullName = hasName && typeof payload.full_name === 'string' ? payload.full_name.trim() : ''
    const email = hasEmail && typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
    const phone = hasPhone && typeof payload.phone === 'string' ? payload.phone.trim() : ''
    if (hasName && (!fullName || fullName.length > 120)) return respond({ error: 'Name must contain 1 to 120 characters.' }, 400)
    if (hasPhone && (typeof payload.phone !== 'string' || phone.length > 40)) return respond({ error: 'Phone number must be 40 characters or fewer.' }, 400)
    if (hasEmail && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) {
      return respond({ error: 'Enter a valid email address.' }, 400)
    }

    const { data: target, error: targetError } = await adminClient
      .from('user_profiles')
      .select('role,is_active')
      .eq('user_id', targetId)
      .maybeSingle()
    if (targetError) return respond({ error: `The account could not be checked: ${targetError.message}` }, 500)
    if (!target) return respond({ error: 'The requested user was not found.' }, 404)
    const remainingAdmin = (hasRole && payload.role !== 'admin' || hasActive && payload.is_active === false)
      && target.role === 'admin' && target.is_active
    if (remainingAdmin) {
      const { count, error: countError } = await adminClient.from('user_profiles')
        .select('user_id', { count: 'exact', head: true })
        .eq('role', 'admin')
        .eq('is_active', true)
      if (countError) return respond({ error: `Administrator access could not be checked: ${countError.message}` }, 500)
      if ((count || 0) <= 1) return respond({ error: 'At least one active administrator must remain.' }, 409)
    }

    if (hasName) {
      const { error: profileError } = await adminClient.from('user_profiles').update({ full_name: fullName }).eq('user_id', targetId)
      if (profileError) return respond({ error: `Account name could not be updated: ${profileError.message}` }, 500)
      const { error: metadataError } = await adminClient.auth.admin.updateUserById(targetId, { user_metadata: { full_name: fullName } })
      if (metadataError) return respond({ error: `Name was saved to the CMS, but account metadata could not be updated: ${metadataError.message}` }, 500)
    }
    if (hasPhone) {
      const { error: phoneError } = await adminClient.from('user_profiles').update({ phone }).eq('user_id', targetId)
      if (phoneError) return respond({ error: `Phone number could not be updated: ${phoneError.message}` }, 500)
    }
    if (hasEmail) {
      const { error: emailError } = await adminClient.auth.admin.updateUserById(targetId, { email, email_confirm: true })
      if (emailError) return respond({ error: `Email could not be updated: ${emailError.message}` }, 400)
    }
    if (hasRole || hasActive) {
      const updates = hasRole ? { role: payload.role } : { is_active: payload.is_active }
      const { error: updateError } = await adminClient.from('user_profiles').update(updates).eq('user_id', targetId)
      if (updateError) return respond({ error: `Account could not be updated: ${updateError.message}` }, 500)
    }
    return respond({ success: true })
  }

  if (action === 'delete') {
    if (targetId === authData.user.id) return respond({ error: 'You cannot remove your own account.' }, 400)
    const { data: target, error: targetError } = await adminClient
      .from('user_profiles')
      .select('role,is_active')
      .eq('user_id', targetId)
      .maybeSingle()
    if (targetError) return respond({ error: `The account could not be checked: ${targetError.message}` }, 500)
    if (!target) return respond({ error: 'The requested user was not found.' }, 404)
    if (target.role === 'admin' && target.is_active) {
      const { count, error: countError } = await adminClient.from('user_profiles')
        .select('user_id', { count: 'exact', head: true })
        .eq('role', 'admin')
        .eq('is_active', true)
      if (countError) return respond({ error: `Administrator access could not be checked: ${countError.message}` }, 500)
      if ((count || 0) <= 1) return respond({ error: 'At least one active administrator must remain.' }, 409)
    }
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetId)
    if (deleteError) return respond({ error: `Account could not be removed: ${deleteError.message}` }, 500)
    return respond({ success: true })
  }

  return respond({ error: 'Unknown user administration action.' }, 400)
})
