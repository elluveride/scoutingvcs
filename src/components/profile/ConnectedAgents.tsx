import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { PitSection } from '@/components/match-scout/PitSection';
import { Bot, Loader2, Unplug, RefreshCw, Copy, Check } from 'lucide-react';

interface Connection {
  id: string;
  client_id: string;
  client_name: string;
  created_at: string;
  last_used_at: string | null;
}

/** The MCP endpoint a client connects to. Served by the app itself (see src/lib/mcp). */
const MCP_SERVER_URL = `${window.location.origin}/mcp`;

/**
 * Profile → "Connected Agents": list and revoke MCP connections, and show the
 * server URL to paste into Claude, Cursor, or another MCP client.
 */
export function ConnectedAgents() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('mcp_list_my_connections');
    setLoading(false);
    if (error) {
      // The RPC does not exist until the MCP migrations are applied. Degrade
      // quietly rather than showing an error on an otherwise healthy page.
      setUnavailable(true);
      setRows([]);
      return;
    }
    setUnavailable(false);
    setRows((data as Connection[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = async (conn: Connection) => {
    setRevoking(conn.id);
    const { error } = await supabase.rpc('mcp_revoke_connection', {
      _client_id: conn.client_id,
      _grant_id: null,
    });
    setRevoking(null);
    if (error) {
      toast({ title: 'Could not disconnect', description: error.message, variant: 'destructive' });
      return;
    }
    toast({
      title: 'Disconnected',
      description: `${conn.client_name} can no longer renew its access.`,
    });
    load();
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(MCP_SERVER_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'Copy failed', description: MCP_SERVER_URL });
    }
  };

  // One row per client, even if its tokens have rotated.
  const byClient = new Map<string, Connection>();
  for (const r of rows) {
    const prev = byClient.get(r.client_id);
    if (!prev || new Date(r.created_at) > new Date(prev.created_at)) byClient.set(r.client_id, r);
  }
  const clients = [...byClient.values()];

  return (
    <PitSection title="Connected Agents" icon={Bot}>
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            AI assistants that support MCP can read your team's scouting data and post insights to the Pit
            Display. Add this server URL in the assistant, then approve the request when it asks.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate text-[11px] font-mono px-3 py-2 rounded-lg bg-muted border border-border">
              {MCP_SERVER_URL}
            </code>
            <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 shrink-0" onClick={copyUrl}>
              {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Active connections</p>
          <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </Button>
        </div>

        {clients.length === 0 ? (
          <p className="text-xs text-muted-foreground px-3 py-3 rounded-lg bg-muted/40 border border-dashed border-border">
            {loading
              ? 'Loading…'
              : unavailable
                ? 'Agent connections are not set up on this project yet.'
                : 'No agents connected yet.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {clients.map((c) => (
              <li
                key={c.client_id}
                className="rounded-lg border border-border bg-card/60 px-3 py-2.5 flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.client_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Connected {new Date(c.created_at).toLocaleDateString()}
                    {c.last_used_at ? ` • last used ${new Date(c.last_used_at).toLocaleString()}` : ' • not used yet'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() => revoke(c)}
                  disabled={revoking === c.id}
                >
                  {revoking === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unplug className="w-3.5 h-3.5" />}
                  Disconnect
                </Button>
              </li>
            ))}
          </ul>
        )}

        {clients.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Disconnecting stops the agent from renewing its access. A session already in progress ends within the
            hour.
          </p>
        )}
      </div>
    </PitSection>
  );
}
