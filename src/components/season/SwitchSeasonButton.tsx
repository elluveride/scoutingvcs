import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { useSeason } from '@/hooks/useSeason';
import { useToast } from '@/hooks/use-toast';
import { SEASON_LIST } from '@/seasons';
import { cn } from '@/lib/utils';
import { CalendarRange, Loader2, ArrowRight } from 'lucide-react';

interface SwitchSeasonButtonProps {
  /** `chip` is the compact header form; `full` is the season setup page form. */
  variant?: 'chip' | 'full';
  /**
   * Switch straight to this season. Omit and the button picks the only other
   * registered season, or sends the user to `/season-setup` when there are
   * several to choose between.
   */
  targetSeasonId?: string;
  label?: string;
  className?: string;
}

/**
 * Switches the current event between registered seasons.
 *
 * Switching is destructive in effect, not in data: nothing is deleted, but
 * every scout's form changes shape mid-event, and entries scouted under the old
 * game stop contributing to the ranking. That earns a confirmation step.
 */
export function SwitchSeasonButton({
  variant = 'chip',
  targetSeasonId,
  label,
  className,
}: SwitchSeasonButtonProps) {
  const { isAdmin } = useAuth();
  const { currentEvent, setEventSeason } = useEvent();
  const season = useSeason();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [pending, setPending] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  const others = SEASON_LIST.filter((s) => s.id !== season.id);
  const target = SEASON_LIST.find((s) => s.id === pending) ?? null;

  if (!currentEvent) return null;
  // Nothing to switch to — the app only registers one season.
  if (others.length === 0) return null;

  // A single alternative season makes the button a straight toggle; more than
  // one and it belongs on the setup page, where each option can be described.
  const soleAlternative = others.length === 1 ? others[0] : null;

  const confirm = async () => {
    if (!target) return;
    setSwitching(true);
    const { error } = await setEventSeason(target.id);
    setSwitching(false);
    setPending(null);

    if (error) {
      toast({
        title: 'Could not switch season',
        description: error.message || 'Only an admin can change the event season.',
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: `Season switched to ${target.name}`,
      description: 'Scout forms, scoring, and QR codes now use the new game.',
    });
  };

  const handleClick = () => {
    const direct = targetSeasonId ?? soleAlternative?.id;
    if (direct) {
      setPending(direct);
    } else {
      navigate('/season-setup');
    }
  };

  return (
    <>
      <Button
        variant={variant === 'chip' ? 'outline' : 'default'}
        size={variant === 'chip' ? 'sm' : 'default'}
        onClick={handleClick}
        disabled={!isAdmin}
        title={isAdmin ? 'Switch the season this event is scouted under' : 'Admins only'}
        className={cn('gap-2 font-mono', variant === 'full' && 'h-12', className)}
      >
        <CalendarRange className="w-4 h-4" />
        {label ?? (variant === 'chip'
          ? 'Switch Season'
          : `Switch to ${(target ?? soleAlternative)?.name ?? 'another season'}`)}
      </Button>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch {currentEvent.name} to {target?.name}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="px-2 py-1 rounded border border-border bg-muted/40">{season.name}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="px-2 py-1 rounded border border-primary/40 bg-primary/10 text-primary">
                    {target?.name}
                  </span>
                </div>
                <p>
                  Match Scout, Pit Scout, the Dashboard, and the Match Planner all switch to the
                  new game's fields and point values for <strong>everyone</strong> scouting this event.
                </p>
                <p className="text-muted-foreground">
                  No data is deleted. Entries already scouted under {season.name} stay in the
                  database, but they will not be scored under {target?.name} — switch back to see
                  them ranked again.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={switching}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirm(); }} disabled={switching}>
              {switching && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Switch Season
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
