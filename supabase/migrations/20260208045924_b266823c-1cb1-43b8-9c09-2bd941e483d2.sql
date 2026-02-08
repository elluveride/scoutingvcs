-- Create scouter_assignments table for persistent assignment storage
CREATE TABLE public.scouter_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_code TEXT NOT NULL,
  match_number INTEGER NOT NULL,
  team_number INTEGER NOT NULL,
  position TEXT NOT NULL,
  scouter_id UUID NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint: one assignment per match+team+event
CREATE UNIQUE INDEX idx_scouter_assignments_unique 
  ON public.scouter_assignments (event_code, match_number, team_number);

-- Enable RLS
ALTER TABLE public.scouter_assignments ENABLE ROW LEVEL SECURITY;

-- Team members can view assignments for their team's event
CREATE POLICY "Team members can view assignments"
  ON public.scouter_assignments
  FOR SELECT
  USING (
    is_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM profiles viewer
      JOIN profiles creator ON viewer.team_number = creator.team_number
      WHERE viewer.id = auth.uid() AND creator.id = scouter_assignments.created_by
    )
  );

-- Only admins can insert assignments
CREATE POLICY "Admins can insert assignments"
  ON public.scouter_assignments
  FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

-- Only admins can update assignments
CREATE POLICY "Admins can update assignments"
  ON public.scouter_assignments
  FOR UPDATE
  USING (is_admin(auth.uid()));

-- Only admins can delete assignments
CREATE POLICY "Admins can delete assignments"
  ON public.scouter_assignments
  FOR DELETE
  USING (is_admin(auth.uid()));