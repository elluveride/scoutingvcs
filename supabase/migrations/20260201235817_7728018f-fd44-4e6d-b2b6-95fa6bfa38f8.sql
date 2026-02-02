-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'scout');

-- Create user_status enum
CREATE TYPE public.user_status AS ENUM ('pending', 'approved', 'rejected');

-- Create park_status enum
CREATE TYPE public.park_status AS ENUM ('none', 'partial', 'full');

-- Create alliance_type enum
CREATE TYPE public.alliance_type AS ENUM ('PPG', 'PGP', 'GPP');

-- Create drive_type enum
CREATE TYPE public.drive_type AS ENUM ('tank', 'mecanum', 'swerve', 'other');

-- Create consistency_level enum
CREATE TYPE public.consistency_level AS ENUM ('low', 'medium', 'high');

-- Create auto_leave_status enum
CREATE TYPE public.auto_leave_status AS ENUM ('yes', 'sometimes', 'no');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'scout',
  status public.user_status NOT NULL DEFAULT 'pending',
  event_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table for secure role checking
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Create events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create match_entries table
CREATE TABLE public.match_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code TEXT NOT NULL,
  team_number INTEGER NOT NULL,
  match_number INTEGER NOT NULL,
  scouter_id UUID REFERENCES auth.users(id) NOT NULL,
  
  -- Autonomous
  auto_motifs INTEGER NOT NULL DEFAULT 0 CHECK (auto_motifs >= 0 AND auto_motifs <= 3),
  auto_artifacts INTEGER NOT NULL DEFAULT 0 CHECK (auto_artifacts >= 0),
  auto_leave BOOLEAN NOT NULL DEFAULT false,
  
  -- TeleOp
  teleop_motifs INTEGER NOT NULL DEFAULT 0 CHECK (teleop_motifs >= 0),
  teleop_artifacts INTEGER NOT NULL DEFAULT 0 CHECK (teleop_artifacts >= 0),
  
  -- Endgame
  park_status public.park_status NOT NULL DEFAULT 'none',
  alliance_type public.alliance_type NOT NULL DEFAULT 'PPG',
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE (event_code, team_number, match_number, scouter_id)
);

-- Create pit_entries table
CREATE TABLE public.pit_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code TEXT NOT NULL,
  team_number INTEGER NOT NULL,
  team_name TEXT NOT NULL,
  
  -- Robot Info
  drive_type public.drive_type NOT NULL DEFAULT 'tank',
  
  -- Capabilities
  scores_motifs BOOLEAN NOT NULL DEFAULT false,
  scores_artifacts BOOLEAN NOT NULL DEFAULT false,
  has_autonomous BOOLEAN NOT NULL DEFAULT false,
  auto_consistency public.consistency_level NOT NULL DEFAULT 'low',
  reliable_auto_leave public.auto_leave_status NOT NULL DEFAULT 'no',
  
  -- Endgame
  partial_park_capable BOOLEAN NOT NULL DEFAULT false,
  full_park_capable BOOLEAN NOT NULL DEFAULT false,
  endgame_consistency public.consistency_level NOT NULL DEFAULT 'low',
  
  -- Autonomous paths (stored as JSONB)
  auto_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  last_edited_by UUID REFERENCES auth.users(id),
  last_edited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE (event_code, team_number)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pit_entries ENABLE ROW LEVEL SECURITY;

-- Create has_role function for secure role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create is_admin function
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND role = 'admin'
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

-- User roles policies
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

-- Events policies
CREATE POLICY "Anyone can view events"
ON public.events FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create events"
ON public.events FOR INSERT
TO authenticated
WITH CHECK (true);

-- Match entries policies
CREATE POLICY "Anyone can view match entries"
ON public.match_entries FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Approved users can insert match entries"
ON public.match_entries FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND status = 'approved'
  )
);

CREATE POLICY "Users can update their own entries"
ON public.match_entries FOR UPDATE
TO authenticated
USING (scouter_id = auth.uid());

CREATE POLICY "Admins can update any entry"
ON public.match_entries FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Pit entries policies
CREATE POLICY "Anyone can view pit entries"
ON public.pit_entries FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Approved users can insert pit entries"
ON public.pit_entries FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND status = 'approved'
  )
);

CREATE POLICY "Approved users can update pit entries"
ON public.pit_entries FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND status = 'approved'
  )
);

-- Enable realtime for match_entries and pit_entries
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pit_entries;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add trigger to profiles
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();