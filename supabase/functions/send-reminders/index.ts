import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── FCM auth: mint an OAuth2 access token from the service account ───────────
interface ServiceAccount {
  client_email: string
  private_key: string
  token_uri: string
  project_id: string
}

function base64url(input: ArrayBuffer | string): string {
  const str = typeof input === 'string'
    ? btoa(input)
    : btoa(String.fromCharCode(...new Uint8Array(input)))
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const bin = atob(b64)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = base64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  }))
  const unsigned = `${header}.${claim}`
  const key = await crypto.subtle.importKey(
    'pkcs8', pemToPkcs8(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  const jwt = `${unsigned}.${base64url(sig)}`

  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('FCM token exchange failed: ' + JSON.stringify(data))
  return data.access_token
}

// ─── Handler ──────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    // Only the scheduler (which posts the service-role key) may trigger sends.
    const auth = req.headers.get('Authorization') ?? ''
    if (auth !== `Bearer ${serviceRoleKey}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const sa = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT') ?? '{}') as ServiceAccount
    if (!sa.client_email) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set.')

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceRoleKey)

    // Due tomorrow (UTC), still pending, not yet reminded.
    const d = new Date(); d.setUTCDate(d.getUTCDate() + 1)
    const tomorrow = d.toISOString().slice(0, 10)

    const { data: due, error: dueErr } = await supabase
      .from('expected_cashings')
      .select('id, expected_date, is_salary_week, vehicle:vehicles(plate, drivers(user_id, active))')
      .eq('status', 'pending')
      .is('reminder_sent_at', null)
      .eq('expected_date', tomorrow)
    if (dueErr) throw new Error(dueErr.message)

    type Recipient = { cashingId: string; userId: string; plate: string; isSalary: boolean; date: string }
    const recipients: Recipient[] = []
    for (const row of due ?? []) {
      const vehicle: any = row.vehicle
      const plate = vehicle?.plate ?? 'your vehicle'
      for (const drv of (vehicle?.drivers ?? [])) {
        if (drv.active && drv.user_id) {
          recipients.push({ cashingId: row.id, userId: drv.user_id, plate, isSalary: row.is_salary_week, date: row.expected_date })
        }
      }
    }

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ processed: 0, sent: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Tokens for the recipient users.
    const userIds = [...new Set(recipients.map(r => r.userId))]
    const { data: tokenRows } = await supabase.from('push_tokens').select('user_id, token').in('user_id', userIds)
    const tokensByUser = new Map<string, string[]>()
    for (const t of tokenRows ?? []) {
      const list = tokensByUser.get(t.user_id) ?? []
      list.push(t.token); tokensByUser.set(t.user_id, list)
    }

    const accessToken = await getAccessToken(sa)
    const fmtDate = (s: string) => new Date(s + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

    const sentCashingIds = new Set<string>()
    const invalidTokens = new Set<string>()
    let sent = 0

    for (const r of recipients) {
      const tokens = tokensByUser.get(r.userId) ?? []
      if (tokens.length === 0) continue
      const title = r.isSalary ? 'Salary week — cashing tomorrow' : 'Cashing reminder'
      const body = `Tomorrow (${fmtDate(r.date)}) is your ${r.isSalary ? 'salary ' : ''}cashing for ${r.plate}.`

      for (const token of tokens) {
        const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body },
              data: { type: 'cashing_reminder', cashing_id: r.cashingId, url: '/driver' },
            },
          }),
        })
        if (res.ok) { sent++; sentCashingIds.add(r.cashingId) }
        else {
          const errBody = await res.text()
          // Stale/unregistered tokens → drop them so we stop trying.
          if (res.status === 404 || /UNREGISTERED|registration-token-not-registered|InvalidRegistration/i.test(errBody)) {
            invalidTokens.add(token)
          }
          console.warn(`FCM send failed (${res.status}) for cashing ${r.cashingId}: ${errBody}`)
        }
      }
    }

    if (sentCashingIds.size > 0) {
      await supabase.from('expected_cashings')
        .update({ reminder_sent_at: new Date().toISOString() })
        .in('id', [...sentCashingIds])
    }
    if (invalidTokens.size > 0) {
      await supabase.from('push_tokens').delete().in('token', [...invalidTokens])
    }

    return new Response(
      JSON.stringify({ processed: recipients.length, sent, invalid_tokens_removed: invalidTokens.size }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('send-reminders error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
