import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UserManagementRequest {
  action: 'create' | 'update' | 'delete';
  userId?: string;
  email?: string;
  fullName?: string;
  company?: string;
  role?: 'user' | 'admin';
  password?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify admin authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if requesting user is admin
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || roleData.role !== 'admin') {
      throw new Error('Admin access required');
    }

    const requestBody: UserManagementRequest = await req.json();
    const { action } = requestBody;

    if (action === 'create') {
      // Create new user
      const { email, fullName, company, role } = requestBody;

      if (!email || !fullName) {
        throw new Error('Email and full name are required');
      }

      // Create auth user with invite email (secure password reset flow)
      const { data: newUser, error: createError } = await supabaseClient.auth.admin.inviteUserByEmail(
        email,
        {
          redirectTo: `${Deno.env.get('SUPABASE_URL')}/auth/v1/verify`,
        }
      );

      if (createError || !newUser.user) {
        throw new Error(`Failed to create user: ${createError?.message}`);
      }

      // Create profile
      const { error: profileError } = await supabaseClient
        .from('profiles')
        .insert({
          user_id: newUser.user.id,
          email,
          full_name: fullName,
          company: company || null,
        });

      if (profileError) {
        console.error('Failed to create profile:', profileError);
        // Rollback: delete the auth user
        await supabaseClient.auth.admin.deleteUser(newUser.user.id);
        throw new Error('Failed to create user profile');
      }

      // Create user role
      const { error: roleError } = await supabaseClient
        .from('user_roles')
        .insert({
          user_id: newUser.user.id,
          role: role || 'user',
        });

      if (roleError) {
        console.error('Failed to create user role:', roleError);
        // Rollback: delete auth user and profile
        await supabaseClient.auth.admin.deleteUser(newUser.user.id);
        throw new Error('Failed to set user role');
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'User created successfully',
          userId: newUser.user.id,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    if (action === 'update') {
      // Update existing user
      const { userId, email, fullName, company, role } = requestBody;

      if (!userId) {
        throw new Error('User ID is required');
      }

      // Update email in auth FIRST (if provided) to prevent inconsistent state
      if (email) {
        const { error: emailError } = await supabaseClient.auth.admin.updateUserById(
          userId,
          { email }
        );

        if (emailError) {
          throw new Error(`Failed to update email in auth: ${emailError.message}`);
        }
      }

      // Update profile
      const profileUpdates: any = {};
      if (fullName) profileUpdates.full_name = fullName;
      if (company !== undefined) profileUpdates.company = company;
      if (email) profileUpdates.email = email;

      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileError } = await supabaseClient
          .from('profiles')
          .update(profileUpdates)
          .eq('user_id', userId);

        if (profileError) {
          throw new Error(`Failed to update profile: ${profileError.message}`);
        }
      }

      // Update role if provided
      if (role) {
        const { error: roleError } = await supabaseClient
          .from('user_roles')
          .update({ role })
          .eq('user_id', userId);

        if (roleError) {
          throw new Error(`Failed to update role: ${roleError.message}`);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'User updated successfully',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    if (action === 'delete') {
      // Delete user
      const { userId } = requestBody;

      if (!userId) {
        throw new Error('User ID is required');
      }

      // Prevent self-deletion
      if (userId === user.id) {
        throw new Error('You cannot delete your own account');
      }

      // Check if this is the last admin
      const { count: adminCount } = await supabaseClient
        .from('user_roles')
        .select('user_id', { count: 'exact', head: true })
        .eq('role', 'admin');

      const { data: targetUserRole } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (targetUserRole?.role === 'admin' && (adminCount ?? 0) <= 1) {
        throw new Error('Cannot delete the last admin user');
      }

      // Delete user (cascades to profiles and user_roles via database constraints)
      const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(userId);

      if (deleteError) {
        throw new Error(`Failed to delete user: ${deleteError.message}`);
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'User deleted successfully',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error) {
    console.error('Admin user management error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
