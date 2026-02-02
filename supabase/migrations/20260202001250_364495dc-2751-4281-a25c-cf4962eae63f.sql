-- Auto-approve and make admin the first user who signs up
CREATE OR REPLACE FUNCTION public.auto_approve_first_user()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is the first profile being created
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id != NEW.id) THEN
    NEW.status := 'approved';
    NEW.role := 'admin';
    
    -- Also add to user_roles table
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to run before insert on profiles
DROP TRIGGER IF EXISTS trigger_auto_approve_first_user ON public.profiles;
CREATE TRIGGER trigger_auto_approve_first_user
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_approve_first_user();

-- Rename alliance_type to motif_type in match_entries
ALTER TABLE public.match_entries RENAME COLUMN alliance_type TO motif_type;

-- Rename the enum type
ALTER TYPE public.alliance_type RENAME TO motif_type;