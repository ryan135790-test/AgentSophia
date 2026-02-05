-- First, enable RLS on user_roles table if not already enabled
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Block direct inserts" ON user_roles;
DROP POLICY IF EXISTS "Block direct updates" ON user_roles;
DROP POLICY IF EXISTS "Block direct deletes" ON user_roles;

-- Allow users to view their own role
CREATE POLICY "Users can view their own role" ON user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow admins to view all roles
CREATE POLICY "Admins can view all roles" ON user_roles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- Block all direct INSERT operations (only RPC can insert)
CREATE POLICY "Block direct inserts" ON user_roles
  FOR INSERT
  WITH CHECK (false);

-- Block all direct UPDATE operations
CREATE POLICY "Block direct updates" ON user_roles
  FOR UPDATE
  USING (false);

-- Block all direct DELETE operations (only admins via backend should delete)
CREATE POLICY "Block direct deletes" ON user_roles
  FOR DELETE
  USING (false);

-- Create a secure function to claim admin role
-- This function atomically checks if an admin exists and grants admin role if not
CREATE OR REPLACE FUNCTION claim_admin_role()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count integer;
  current_user_id uuid;
BEGIN
  -- Get the current authenticated user
  current_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF current_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Not authenticated'
    );
  END IF;
  
  -- Lock the table to prevent race conditions
  LOCK TABLE user_roles IN EXCLUSIVE MODE;
  
  -- Count existing admins
  SELECT COUNT(*) INTO admin_count
  FROM user_roles
  WHERE role = 'admin';
  
  -- If admin already exists, return error
  IF admin_count > 0 THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Admin user already exists'
    );
  END IF;
  
  -- Check if user already has a role
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = current_user_id) THEN
    RETURN json_build_object(
      'success', false,
      'message', 'User already has a role assigned'
    );
  END IF;
  
  -- Grant admin role (bypasses RLS because of SECURITY DEFINER)
  INSERT INTO user_roles (user_id, role)
  VALUES (current_user_id, 'admin');
  
  RETURN json_build_object(
    'success', true,
    'message', 'Admin role granted successfully'
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION claim_admin_role() TO authenticated;

-- Add comment explaining the security model
COMMENT ON FUNCTION claim_admin_role() IS 
  'Securely grants admin role to the first user. Prevents privilege escalation by blocking direct table inserts via RLS policies.';
