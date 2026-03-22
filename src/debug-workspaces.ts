import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function debugWorkspaces() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log("No user logged in.");
    return;
  }

  console.log("Logged in user:", user.email, user.id);

  const { data: memberships, error: memError } = await supabase
    .from('workspace_users')
    .select('*, workspace:workspaces(*)');

  if (memError) {
    console.error("Error fetching memberships:", memError);
  } else {
    console.log("Memberships found:", memberships?.length);
    memberships?.forEach(m => {
      console.log(`- Workspace: ${m.workspace?.name} (ID: ${m.workspace_id}), Role: ${m.role}, Exp: ${m.expires_at}`);
    });
  }
}

debugWorkspaces();
