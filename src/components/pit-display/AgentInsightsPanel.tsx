import React, { useMemo, useState } from 'react';
import { Bot, Radio, RefreshCw, X, AlertTriangle, Lightbulb, Target, StickyNote, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { AgentInsight } from '@/hooks/useAgentInsights';

interface Props {
  insights: AgentInsight[];
  live: boolean;
  loading: boolean;
  lastSync: number | null;
  onRefresh: () => void;
  onDismiss: (id: string) => void | Promise<unknown>;
  /** Only show insights about these teams (plus event-wide ones). */
  teamFilter?: string[];
  title?: string;
  /** Collapse to the N most recent; "show all" expands. */
  max?: number;
  className?: string;
}

const KIND_META: Record<string, { icon: React.ElementType; label: string; classes: string }> = {
  insight: { icon: Lightbulb, label: 'Insight', classes: 'bg-primary/15 text-primary border-primary/40' },
  prediction: { icon: Target, label: 'Prediction', classes: 'bg-secondary/15 text-secondary border-secondary/40' },
  alert: { icon: AlertTriangle, label: 'Alert', classes: 'bg-warning/20 text-warning border-warning/40' },
  note: { icon: StickyNote, label: 'Note', classes: 'bg-muted text-foreground border-border' },
};

const timeAgo = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
};

/**
 * "Agent Insights" card for the Pit Display. Rows arrive through
 * `useAgentInsights` (Supabase Realtime on `agent_results`), which MCP agents
 * write to with the `record_insight` tool.
 */
export function AgentInsightsPanel({
  insights, live, loading, lastSync, onRefresh, onDismiss, teamFilter, title = 'Agent Insights', max = 6, className,
}: Props) {
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!teamFilter || teamFilter.length === 0) return insights;
    const set = new Set(teamFilter.map((t) => parseInt(t, 10)));
    return insights.filter((i) => i.team_number === null || set.has(i.team_number));
  }, [insights, teamFilter]);

  const visible = showAll ? filtered : filtered.slice(0, max);
  const toggle = (id: string) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className={cn('data-card', className)}>
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <h2 className="text-xs font-display uppercase tracking-[0.2em] flex items-center gap-2 text-primary">
          <Bot className="w-3.5 h-3.5" />
          {title}
          {filtered.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded bg-primary/15 text-[10px] font-mono">{filtered.length}</span>
          )}
        </h2>
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Radio className={cn('w-3 h-3', live ? 'text-success animate-pulse' : 'text-muted-foreground')} />
            {live ? 'Live' : 'Polling'}
            {lastSync ? ` • ${new Date(lastSync).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}
          </span>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onRefresh} disabled={loading} aria-label="Refresh insights">
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-xs text-muted-foreground px-3 py-4 rounded-md border border-dashed border-border bg-muted/10">
          No agent insights yet. Connect an assistant under Profile → Connected Agents; anything it records with
          <code className="mx-1 font-mono text-[11px]">record_insight</code> shows up here within seconds.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {visible.map((i) => {
            const meta = KIND_META[i.kind] ?? KIND_META.note;
            const Icon = meta.icon;
            const isOpen = expanded.has(i.id);
            const long = i.summary.length > 180;
            const payloadEntries = i.payload && typeof i.payload === 'object' && !Array.isArray(i.payload)
              ? Object.entries(i.payload as Record<string, unknown>).slice(0, 8)
              : [];
            return (
              <li key={i.id} className={cn('rounded-md border px-2.5 py-2 bg-card/60', i.kind === 'alert' ? 'border-warning/50' : 'border-border')}>
                <div className="flex items-start gap-2">
                  <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-display uppercase tracking-wider shrink-0', meta.classes)}>
                    <Icon className="w-2.5 h-2.5" />
                    {meta.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug">{i.title}</p>
                    <p className={cn('text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap', !isOpen && long && 'line-clamp-3')}>
                      {i.summary}
                    </p>
                    {isOpen && payloadEntries.length > 0 && (
                      <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] font-mono">
                        {payloadEntries.map(([k, v]) => (
                          <React.Fragment key={k}>
                            <dt className="text-muted-foreground truncate">{k}</dt>
                            <dd className="text-foreground truncate">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
                          </React.Fragment>
                        ))}
                      </dl>
                    )}
                    <div className="mt-1 flex items-center gap-2 flex-wrap text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      {i.team_number !== null && <span className="text-foreground">Team {i.team_number}</span>}
                      {i.match_label && <span>{i.match_label}</span>}
                      {i.confidence !== null && <span>{i.confidence}% conf</span>}
                      {i.client_name && <span className="truncate max-w-[140px]">via {i.client_name}</span>}
                      <span>{timeAgo(i.created_at)}</span>
                      {(long || payloadEntries.length > 0) && (
                        <button type="button" onClick={() => toggle(i.id)} className="inline-flex items-center gap-0.5 text-primary hover:underline min-h-0">
                          {isOpen ? <><ChevronUp className="w-3 h-3" /> less</> : <><ChevronDown className="w-3 h-3" /> more</>}
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDismiss(i.id)}
                    className="text-muted-foreground hover:text-destructive shrink-0 min-h-0 p-0.5"
                    aria-label="Dismiss insight"
                    title="Dismiss (author or admin only)"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {filtered.length > max && (
        <Button type="button" variant="ghost" size="sm" className="mt-2 h-8 w-full text-xs" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show fewer' : `Show all ${filtered.length}`}
        </Button>
      )}
    </div>
  );
}
