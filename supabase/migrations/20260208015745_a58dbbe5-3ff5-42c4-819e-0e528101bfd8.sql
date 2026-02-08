
CREATE OR REPLACE FUNCTION public.enforce_team_number_cooldown()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only enforce if team_number is actually changing
  IF OLD.team_number IS DISTINCT FROM NEW.team_number THEN
    -- Check cooldown: team_number_changed_at must be at least 48 hours ago
    IF OLD.team_number_changed_at IS NOT NULL
       AND (now() - OLD.team_number_changed_at) < interval '48 hours' THEN
      RAISE EXCEPTION 'Team number cooldown active. You must wait 48 hours between changes.';
    END IF;

    -- Automatically set the timestamp when team number changes
    NEW.team_number_changed_at := now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_team_number_cooldown_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_team_number_cooldown();
