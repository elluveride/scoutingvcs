
-- Create team_change_requests table
CREATE TABLE public.team_change_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_team_number INTEGER NOT NULL,
  requested_team_number INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.team_change_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own requests"
ON public.team_change_requests FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own requests
CREATE POLICY "Users can create own requests"
ON public.team_change_requests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Admins can view all requests
CREATE POLICY "Admins can view all requests"
ON public.team_change_requests FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Admins can update requests
CREATE POLICY "Admins can update requests"
ON public.team_change_requests FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));
