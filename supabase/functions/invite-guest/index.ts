import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { email, role, workspace_id, access_duration } = await req.json()

    if (!email || !workspace_id || !role) {
        throw new Error("Missing required fields: email, workspace_id, role")
    }

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Verify caller has permission to invite to this workspace
    const { data: membership } = await supabaseAdmin
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single()

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new Error('You do not have permission to invite users to this workspace.')
    }

    // Invite user via Admin API
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email)
    
    // If user exists, inviteUserByEmail might fail with 'User already registered' but usually returns successfully
    // with action_link or similar if configured. 
    if (inviteError) {
        throw inviteError
    }

    const invitedUser = inviteData.user

    // Map user to workspace
    const { error: insertError } = await supabaseAdmin
      .from('workspace_users')
      .insert({
        workspace_id,
        user_id: invitedUser.id,
        role: role,
        access_duration: access_duration || null
      })

    // Ignore conflict error if they were already mapped
    if (insertError && insertError.code !== '23505') {
        throw insertError
    }
    
    return new Response(JSON.stringify({ success: true, user: invitedUser }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
