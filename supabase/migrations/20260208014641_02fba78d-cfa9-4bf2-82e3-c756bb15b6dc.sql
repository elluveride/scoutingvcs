
-- Add a column to track when the team number was last changed
ALTER TABLE public.profiles
ADD COLUMN team_number_changed_at timestamp with time zone DEFAULT NULL;
