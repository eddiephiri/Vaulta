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
    const today = new Date().toISOString().slice(0, 10)
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

    // Tokens for the recipient users (admin nudges below run even if this is empty).
    const userIds = [...new Set(recipients.map(r => r.userId))]
    const tokensByUser = new Map<string, string[]>()
    if (userIds.length > 0) {
      const { data: tokenRows } = await supabase.from('push_tokens').select('user_id, token').in('user_id', userIds)
      for (const t of tokenRows ?? []) {
        const list = tokensByUser.get(t.user_id) ?? []
        list.push(t.token); tokensByUser.set(t.user_id, list)
      }
    }

    const accessToken = await getAccessToken(sa)
    const fmtDate = (s: string) => new Date(s + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

    const invalidTokens = new Set<string>()

    // Send to one device token; returns true on success, flags dead tokens.
    const pushTo = async (token: string, title: string, body: string, data: Record<string, string>): Promise<boolean> => {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { token, notification: { title, body }, data } }),
      })
      if (res.ok) return true
      const errBody = await res.text()
      if (res.status === 404 || /UNREGISTERED|registration-token-not-registered|InvalidRegistration/i.test(errBody)) {
        invalidTokens.add(token)
      }
      console.warn(`FCM send failed (${res.status}): ${errBody}`)
      return false
    }

    // ── Driver cashing reminders ────────────────────────────────────────────
    const sentCashingIds = new Set<string>()
    let driverSent = 0
    for (const r of recipients) {
      const tokens = tokensByUser.get(r.userId) ?? []
      if (tokens.length === 0) continue
      const title = r.isSalary ? 'Salary week — cashing tomorrow' : 'Cashing reminder'
      const body = `Tomorrow (${fmtDate(r.date)}) is your ${r.isSalary ? 'salary ' : ''}cashing for ${r.plate}.`
      for (const token of tokens) {
        if (await pushTo(token, title, body, { type: 'cashing_reminder', cashing_id: r.cashingId, url: '/driver' })) {
          driverSent++; sentCashingIds.add(r.cashingId)
        }
      }
    }
    if (sentCashingIds.size > 0) {
      await supabase.from('expected_cashings')
        .update({ reminder_sent_at: new Date().toISOString() })
        .in('id', [...sentCashingIds])
    }

    // ── Admin nudges: a daily digest of items needing attention ─────────────
    // Overdue cashings (pending, in the last 30 days), pending document
    // reviews, and unreviewed profile edits — counted per workspace.
    const ago = new Date(); ago.setUTCDate(ago.getUTCDate() - 30)
    const thirtyAgo = ago.toISOString().slice(0, 10)

    type Counts = { overdue: number; docs: number; edits: number }
    const counts = new Map<string, Counts>()
    const bump = (ws: string, key: keyof Counts) => {
      const c = counts.get(ws) ?? { overdue: 0, docs: 0, edits: 0 }
      c[key]++; counts.set(ws, c)
    }

    const [overdueRes, docsRes, editsRes] = await Promise.all([
      supabase.from('expected_cashings').select('workspace_id').eq('status', 'pending').gte('expected_date', thirtyAgo).lt('expected_date', today),
      supabase.from('driver_documents').select('workspace_id').eq('status', 'pending').eq('superseded', false),
      supabase.from('driver_profile_edits').select('workspace_id').eq('reviewed', false).eq('reverted', false),
    ])
    overdueRes.data?.forEach((r: any) => r.workspace_id && bump(r.workspace_id, 'overdue'))
    docsRes.data?.forEach((r: any) => r.workspace_id && bump(r.workspace_id, 'docs'))
    editsRes.data?.forEach((r: any) => r.workspace_id && bump(r.workspace_id, 'edits'))

    let adminSent = 0
    const flaggedWs = [...counts.keys()]
    if (flaggedWs.length > 0) {
      const { data: admins } = await supabase
        .from('workspace_users').select('workspace_id, user_id')
        .in('workspace_id', flaggedWs).in('role', ['owner', 'admin'])

      const adminIds = [...new Set((admins ?? []).map((a: any) => a.user_id))]
      const { data: adminTokenRows } = await supabase.from('push_tokens').select('user_id, token').in('user_id', adminIds)
      const adminTokensByUser = new Map<string, string[]>()
      for (const t of adminTokenRows ?? []) {
        const list = adminTokensByUser.get(t.user_id) ?? []; list.push(t.token); adminTokensByUser.set(t.user_id, list)
      }

      const s = (n: number) => (n === 1 ? '' : 's')
      for (const [ws, c] of counts) {
        const parts: string[] = []
        if (c.overdue) parts.push(`${c.overdue} overdue cashing${s(c.overdue)}`)
        if (c.docs) parts.push(`${c.docs} document${s(c.docs)} to review`)
        if (c.edits) parts.push(`${c.edits} profile edit${s(c.edits)} to review`)
        if (parts.length === 0) continue
        const body = parts.join(', ')
        for (const a of (admins ?? []).filter((a: any) => a.workspace_id === ws)) {
          for (const token of (adminTokensByUser.get(a.user_id) ?? [])) {
            if (await pushTo(token, 'Items need your attention', body, { type: 'admin_digest', url: '/transport/drivers' })) adminSent++
          }
        }
      }
    }

    if (invalidTokens.size > 0) {
      await supabase.from('push_tokens').delete().in('token', [...invalidTokens])
    }

    return new Response(
      JSON.stringify({
        driver_reminders: { processed: recipients.length, sent: driverSent },
        admin_nudges: { workspaces: flaggedWs.length, sent: adminSent },
        invalid_tokens_removed: invalidTokens.size,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('send-reminders error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
