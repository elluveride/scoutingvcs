-- Drop the cooldown trigger and function (CASCADE to handle dependencies)
DROP FUNCTION IF EXISTS public.enforce_team_number_cooldown() CASCADE;