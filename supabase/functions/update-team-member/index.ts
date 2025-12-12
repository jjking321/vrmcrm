import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token to verify their identity
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the requesting user
    const { data: { user: requestingUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !requestingUser) {
      console.error('Error getting user:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Requesting user:', requestingUser.id);

    // Verify requesting user is an admin
    const { data: adminRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .single();

    if (roleError || adminRole?.role !== 'admin') {
      console.error('User is not admin:', roleError);
      return new Response(
        JSON.stringify({ error: 'Only admins can update team members' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get admin's company
    const { data: adminProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('company_id')
      .eq('id', requestingUser.id)
      .single();

    if (profileError || !adminProfile?.company_id) {
      console.error('Error getting admin profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Admin profile not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { userId, role, password } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify target user is in the same company
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('company_id')
      .eq('id', userId)
      .single();

    if (targetError || targetProfile?.company_id !== adminProfile.company_id) {
      console.error('Target user not in same company:', targetError);
      return new Response(
        JSON.stringify({ error: 'User not found in your company' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle role update
    if (role && (role === 'admin' || role === 'member')) {
      // Prevent self-demotion
      if (userId === requestingUser.id && role === 'member') {
        return new Response(
          JSON.stringify({ error: 'You cannot demote yourself' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if demoting would leave no admins
      if (role === 'member') {
        const { data: adminCount } = await supabaseAdmin
          .from('user_roles')
          .select('user_id', { count: 'exact' })
          .eq('role', 'admin')
          .in('user_id', 
            await supabaseAdmin
              .from('profiles')
              .select('id')
              .eq('company_id', adminProfile.company_id)
              .then(res => res.data?.map(p => p.id) || [])
          );

        if (adminCount && adminCount.length <= 1) {
          // Check if the user being demoted is currently an admin
          const { data: targetRole } = await supabaseAdmin
            .from('user_roles')
            .select('role')
            .eq('user_id', userId)
            .single();

          if (targetRole?.role === 'admin') {
            return new Response(
              JSON.stringify({ error: 'Cannot demote the last admin' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }

      // Update role
      const { error: updateRoleError } = await supabaseAdmin
        .from('user_roles')
        .update({ role })
        .eq('user_id', userId);

      if (updateRoleError) {
        console.error('Error updating role:', updateRoleError);
        return new Response(
          JSON.stringify({ error: 'Failed to update role' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Role updated successfully for user:', userId);
    }

    // Handle password update
    if (password) {
      if (password.length < 6) {
        return new Response(
          JSON.stringify({ error: 'Password must be at least 6 characters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: password,
      });

      if (passwordError) {
        console.error('Error updating password:', passwordError);
        return new Response(
          JSON.stringify({ error: 'Failed to update password' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Password updated successfully for user:', userId);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in update-team-member:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
