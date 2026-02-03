-- Drop old columns and add new scoring system for match_entries

-- First drop the old enum types after removing columns
ALTER TABLE public.match_entries 
  DROP COLUMN IF EXISTS auto_motifs,
  DROP COLUMN IF EXISTS auto_artifacts,
  DROP COLUMN IF EXISTS auto_leave,
  DROP COLUMN IF EXISTS teleop_motifs,
  DROP COLUMN IF EXISTS teleop_artifacts,
  DROP COLUMN IF EXISTS park_status,
  DROP COLUMN IF EXISTS motif_type;

-- Add new autonomous columns
ALTER TABLE public.match_entries
  ADD COLUMN auto_scored_close integer NOT NULL DEFAULT 0,
  ADD COLUMN auto_scored_far integer NOT NULL DEFAULT 0,
  ADD COLUMN auto_fouls_minor integer NOT NULL DEFAULT 0,
  ADD COLUMN auto_fouls_major integer NOT NULL DEFAULT 0,
  ADD COLUMN on_launch_line boolean NOT NULL DEFAULT false;

-- Add new teleop columns
ALTER TABLE public.match_entries
  ADD COLUMN teleop_scored_close integer NOT NULL DEFAULT 0,
  ADD COLUMN teleop_scored_far integer NOT NULL DEFAULT 0,
  ADD COLUMN defense_rating integer NOT NULL DEFAULT 0 CHECK (defense_rating >= 0 AND defense_rating <= 3);

-- Create endgame return status enum
CREATE TYPE public.endgame_return_status AS ENUM ('not_returned', 'partial', 'full', 'lift');

-- Create penalty status enum  
CREATE TYPE public.penalty_status AS ENUM ('none', 'dead', 'yellow_card', 'red_card');

-- Add endgame columns
ALTER TABLE public.match_entries
  ADD COLUMN endgame_return endgame_return_status NOT NULL DEFAULT 'not_returned',
  ADD COLUMN penalty_status penalty_status NOT NULL DEFAULT 'none';

-- Drop old enums if they exist (they may be referenced elsewhere so we keep them for now)
-- park_status and motif_type are still in the types file