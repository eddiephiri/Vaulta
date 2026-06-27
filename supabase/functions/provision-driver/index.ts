import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Normalize a phone number to E.164, defaulting to Zambia (+260) for local formats.
function normalizePhone(raw: string): string {
  let p = (raw || '').replace(/[\s\-()]/g, '')
  if (p.startsWith('+')) {
    // already international
  } else if (p.startsWith('00')) {
    p = '+' + p.slice(2)
  } else if (p.startsWith('0')) {
    p = '+260' + p.slice(1)        // Zambia local: 0977… -> +260977…
  } else if (p.startsWith('260')) {
    p = '+' + p
  } else {
    p = '+260' + p                 // bare local without leading 0
  }
  if (!/^\+\d{10,15}$/.test(p)) {
    throw new Error(`"${raw}" is not a valid phone number. Use international format, e.g. +260977000000.`)
  }
  return p
}

// Drivers authenticate with phone+password, but Supabase's phone provider
// requires a paid SMS provider. We avoid that by mapping the phone to a
// deterministic synthetic email and using email+password auth under the hood.
// This MUST stay identical to phoneToDriverEmail() in src/lib/driverAuth.ts.
const DRIVER_EMAIL_DOMAIN = 'drivers.vaulta.app'
function phoneToDriverEmail(e164Phone: string): string {
  return `${e164Phone.replace(/\D/g, '')}@${DRIVER_EMAIL_DOMAIN}`
}

// Strong temporary password the admin hands to the driver (shown once).
function generateTempPassword(): string {
  const sets = [
    'ABCDEFGHJKLMNPQRSTUVWXYZ',
    'abcdefghijkmnpqrstuvwxyz',
    '23456789',
    '@#$%&*?',
  ]
  const all = sets.join('')
  const bytes = crypto.getRandomValues(new Uint8Array(14))
  // Guarantee at least one char from each set, then fill.
  const chars = sets.map((s, i) => s[bytes[i] % s.length])
  for (let i = sets.length; i < bytes.length; i++) chars.push(all[bytes[i] % all.length])
  // Shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint8Array(1))[0] % (i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { driver_id, phone } = await req.json()
    if (!driver_id || !phone) {
      throw new Error('Missing required fields: driver_id, phone')
    }

    // 1. Identify the caller.
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // 2. Load the driver record (service role bypasses RLS).
    const { data: driver, error: driverErr } = await supabaseAdmin
      .from('drivers')
      .select('id, workspace_id, user_id, name')
      .eq('id', driver_id)
      .single()

    if (driverErr || !driver) throw new Error('Driver not found.')
    if (driver.user_id) throw new Error('This driver already has an app login.')

    // 3. Verify the caller is an owner/admin of the driver's workspace.
    const { data: membership } = await supabaseAdmin
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', driver.workspace_id)
      .eq('user_id', user.id)
      .single()

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new Error('Only owners and admins can set up driver logins.')
    }

    // 4. Create the auth user (auto-confirmed; no SMS). The driver signs in with
    //    their phone, which we map to a synthetic email + password under the hood.
    const normalized = normalizePhone(phone)
    const email = phoneToDriverEmail(normalized)
    const tempPassword = generateTempPassword()

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      // Authorization claims go in app_metadata (service-role-only, not editable
      // by the driver). user_metadata holds only benign, self-editable fields.
      app_metadata: {
        role: 'driver',
        driver_id: driver.id,
      },
      user_metadata: {
        phone: normalized,
        must_change_password: true,
      },
    })

    if (createErr) {
      // Most common: this phone (synthetic email) is already registered.
      throw new Error(createErr.message.includes('already')
        ? `Phone ${normalized} is already registered to another account.`
        : createErr.message)
    }

    const newUser = created.user

    // 5. Link the driver record to the new auth user, and store the normalized phone.
    const { error: linkErr } = await supabaseAdmin
      .from('drivers')
      .update({ user_id: newUser.id, phone: normalized })
      .eq('id', driver.id)

    if (linkErr) {
      // Roll back the orphaned auth user so the admin can retry cleanly.
      await supabaseAdmin.auth.admin.deleteUser(newUser.id)
      throw linkErr
    }

    return new Response(
      JSON.stringify({ success: true, phone: normalized, temp_password: tempPassword }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
