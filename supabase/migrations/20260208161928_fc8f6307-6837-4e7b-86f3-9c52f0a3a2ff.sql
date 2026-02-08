
-- Create a secure function for profile creation during signup
-- This bypasses RLS since the user isn't authenticated yet (email confirmation pending)
CREATE OR REPLACE FUNCTION public.create_profile_for_signup(
  _user_id UUID,
  _name TEXT,
  _team_number INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate user exists in auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'Invalid user ID';
  END IF;
  
  -- Prevent duplicate profiles
  IF EXISTS (SELECT 1 FROM profiles WHERE id = _user_id) THEN
    RAISE EXCEPTION 'Profile already exists';
  END IF;
  
  -- Only creates with safe defaults (scout role, pending status)
  INSERT INTO profiles (id, name, team_number, role, status)
  VALUES (_user_id, _name, _team_number, 'scout', 'pending');
END;
$$;
