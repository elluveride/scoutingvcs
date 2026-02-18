import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bug, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function BugReportButton() {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user, profile } = useAuth();
  const location = useLocation();
  const { toast } = useToast();

  if (!user) return null;

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from('bug_reports' as any).insert({
      user_id: user.id,
      page_url: location.pathname,
      description: description.trim(),
    } as any);

    if (error) {
      toast({ title: 'Error', description: 'Failed to submit bug report.', variant: 'destructive' });
    } else {
      toast({ title: 'Bug reported', description: 'An admin will review it soon.' });
      // Notify admins via email (fire-and-forget)
      supabase.functions.invoke('notify-user', {
        body: {
          type: 'bug_report',
          user_id: user.id,
          details: {
            reporter_name: profile?.name || 'Unknown',
            page_url: location.pathname,
            description: description.trim(),
          },
        },
      }).then(({ error: notifyErr }) => {
        if (notifyErr) console.error('Failed to send bug report notification:', notifyErr);
      });
      setDescription('');
      setOpen(false);
    }
    setSubmitting(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shadow-lg"
        aria-label="Report a bug"
      >
        <Bug className="w-4 h-4" />
      </button>

      {open && (
        <div className="fixed bottom-16 right-4 z-50 w-80 rounded-xl bg-card border border-border shadow-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-card-foreground">Report a Bug</h3>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Page: {location.pathname}</p>
          <Textarea
            placeholder="Describe the issue..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="text-sm"
          />
          <Button size="sm" onClick={handleSubmit} disabled={!description.trim() || submitting} className="w-full">
            <Send className="w-4 h-4 mr-1" />
            {submitting ? 'Sending...' : 'Submit'}
          </Button>
        </div>
      )}
    </>
  );
}
