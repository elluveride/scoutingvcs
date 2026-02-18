
-- Create bug_reports table
CREATE TABLE public.bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  page_url TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Users can insert their own bug reports
CREATE POLICY "Users can submit bug reports"
ON public.bug_reports FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can view their own reports
CREATE POLICY "Users can view own bug reports"
ON public.bug_reports FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all bug reports
CREATE POLICY "Admins can view all bug reports"
ON public.bug_reports FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update bug reports (resolve them)
CREATE POLICY "Admins can update bug reports"
ON public.bug_reports FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete bug reports
CREATE POLICY "Admins can delete bug reports"
ON public.bug_reports FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
