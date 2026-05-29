import React, { useEffect, useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, RefreshCw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Rect {
  position: { x: number; y: number };
  size: { x: number; y: number };
  angle?: number;
}
interface Pit extends Rect { team: string | number; }
interface Labeled extends Rect { label?: string; }
interface Arrow extends Rect { type?: string; }

interface NexusMap {
  size?: { x: number; y: number };
  pits?: Record<string, Pit>;
  areas?: Record<string, Labeled> | null;
  labels?: Record<string, Labeled> | null;
  arrows?: Record<string, Arrow> | null;
  walls?: Record<string, Rect> | null;
}

interface NexusResponse {
  map: NexusMap | null;
  pitAddresses: Record<string, string>;
  eventKey: string;
}

export default function PitMap() {
  const { user } = useAuth();
  const { currentEvent } = useEvent();
  const { toast } = useToast();

  const [eventKey, setEventKey] = useState(currentEvent?.code || '');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<NexusResponse | null>(null);
  const [search, setSearch] = useState('');

  const fetchData = async (key: string) => {
    if (!key) return;
    setLoading(true);
    const { data: resp, error } = await supabase.functions.invoke('nexus-pit-map', {
      body: { eventKey: key },
    });
    setLoading(false);
    if (error || resp?.error) {
      toast({
        title: 'Failed to load pit data',
        description: resp?.error || error?.message || 'Nexus API request failed',
        variant: 'destructive',
      });
      return;
    }
    setData(resp);
    if (!resp.map && (!resp.pitAddresses || Object.keys(resp.pitAddresses).length === 0)) {
      toast({
        title: 'No data',
        description: 'This event has no pit map or addresses on Nexus.',
      });
    }
  };

  useEffect(() => {
    if (currentEvent?.code) {
      setEventKey(currentEvent.code);
      fetchData(currentEvent.code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEvent?.code]);

  if (!user) return <Navigate to="/auth" replace />;

  const map = data?.map;
  const viewBox = useMemo(() => {
    if (!map?.pits && !map?.size) return '0 0 1000 1000';
    if (map.size) return `0 0 ${map.size.x} ${map.size.y}`;
    // derive from pits
    const all = [
      ...Object.values(map.pits || {}),
      ...Object.values(map.areas || {}),
      ...Object.values(map.labels || {}),
    ];
    const maxX = Math.max(...all.map(p => p.position.x + p.size.x), 1000);
    const maxY = Math.max(...all.map(p => p.position.y + p.size.y), 1000);
    return `0 0 ${maxX + 40} ${maxY + 40}`;
  }, [map]);

  const searchNum = search.trim();
  const highlightTeam = searchNum;

  const teamCount = data?.pitAddresses ? Object.keys(data.pitAddresses).length : 0;

  return (
    <AppLayout>
      <PageHeader
        title="Pit Map"
        description="Live pit layout & team locations from Nexus"
      />

      <div className="space-y-6">
        <div className="data-card">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="eventKey">Nexus Event Key</Label>
              <Input
                id="eventKey"
                value={eventKey}
                onChange={(e) => setEventKey(e.target.value)}
                placeholder="e.g. 2024casf or demo1234"
                className="h-12 font-mono"
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="teamSearch">Find Team</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="teamSearch"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Team number..."
                  className="h-12 pl-9 font-mono"
                />
              </div>
            </div>
            <Button
              onClick={() => fetchData(eventKey)}
              disabled={!eventKey || loading}
              className="h-12 gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Refresh
            </Button>
          </div>
          {data && (
            <p className="text-xs text-muted-foreground mt-3">
              {teamCount} teams • Event <span className="font-mono">{data.eventKey}</span> • Data via{' '}
              <a href="https://ftc.nexus" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                ftc.nexus
              </a>
            </p>
          )}
        </div>

        {loading && !data && (
          <div className="data-card">
            <Skeleton className="w-full aspect-square" />
          </div>
        )}

        {data && !map && data.pitAddresses && (
          <div className="data-card">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-secondary" />
              Pit Addresses
            </h2>
            <PitAddressList addresses={data.pitAddresses} highlight={highlightTeam} />
          </div>
        )}

        {map && (
          <div className="data-card">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-secondary" />
              Pit Map
            </h2>
            <div className="w-full overflow-auto rounded-lg border border-border bg-muted/30 p-2">
              <svg
                viewBox={viewBox}
                className="w-full h-auto max-h-[80vh]"
                preserveAspectRatio="xMidYMid meet"
              >
                {/* Walls */}
                {map.walls && Object.entries(map.walls).map(([k, w]) => (
                  <rect
                    key={`w-${k}`}
                    x={w.position.x}
                    y={w.position.y}
                    width={w.size.x}
                    height={w.size.y}
                    transform={w.angle ? `rotate(${w.angle} ${w.position.x + w.size.x / 2} ${w.position.y + w.size.y / 2})` : undefined}
                    fill="hsl(var(--muted-foreground) / 0.4)"
                  />
                ))}

                {/* Areas */}
                {map.areas && Object.entries(map.areas).map(([k, a]) => (
                  <g key={`a-${k}`} transform={a.angle ? `rotate(${a.angle} ${a.position.x + a.size.x / 2} ${a.position.y + a.size.y / 2})` : undefined}>
                    <rect
                      x={a.position.x}
                      y={a.position.y}
                      width={a.size.x}
                      height={a.size.y}
                      fill="hsl(var(--accent) / 0.15)"
                      stroke="hsl(var(--accent))"
                      strokeWidth={2}
                      rx={6}
                    />
                    {a.label && (
                      <text
                        x={a.position.x + a.size.x / 2}
                        y={a.position.y + a.size.y / 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-foreground"
                        fontSize={Math.min(a.size.x, a.size.y) * 0.18}
                        fontWeight={600}
                      >
                        {a.label}
                      </text>
                    )}
                  </g>
                ))}

                {/* Pits */}
                {map.pits && Object.entries(map.pits).map(([address, p]) => {
                  const teamStr = String(p.team);
                  const isMatch = highlightTeam && teamStr === highlightTeam;
                  return (
                    <g
                      key={`p-${address}`}
                      transform={p.angle ? `rotate(${p.angle} ${p.position.x + p.size.x / 2} ${p.position.y + p.size.y / 2})` : undefined}
                    >
                      <rect
                        x={p.position.x}
                        y={p.position.y}
                        width={p.size.x}
                        height={p.size.y}
                        fill={isMatch ? 'hsl(var(--secondary))' : 'hsl(var(--card))'}
                        stroke={isMatch ? 'hsl(var(--secondary))' : 'hsl(var(--border))'}
                        strokeWidth={isMatch ? 4 : 1.5}
                        rx={4}
                        className={cn(isMatch && 'drop-shadow-[0_0_20px_hsl(var(--secondary)/0.7)]')}
                      />
                      <text
                        x={p.position.x + p.size.x / 2}
                        y={p.position.y + p.size.y * 0.38}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className={isMatch ? 'fill-secondary-foreground' : 'fill-muted-foreground'}
                        fontSize={Math.min(p.size.x, p.size.y) * 0.16}
                        fontWeight={500}
                      >
                        {address}
                      </text>
                      <text
                        x={p.position.x + p.size.x / 2}
                        y={p.position.y + p.size.y * 0.68}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className={isMatch ? 'fill-secondary-foreground' : 'fill-foreground'}
                        fontSize={Math.min(p.size.x, p.size.y) * 0.28}
                        fontWeight={700}
                      >
                        {teamStr}
                      </text>
                    </g>
                  );
                })}

                {/* Labels */}
                {map.labels && Object.entries(map.labels).map(([k, l]) => (
                  <text
                    key={`l-${k}`}
                    x={l.position.x + l.size.x / 2}
                    y={l.position.y + l.size.y / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={l.angle ? `rotate(${l.angle} ${l.position.x + l.size.x / 2} ${l.position.y + l.size.y / 2})` : undefined}
                    className="fill-muted-foreground"
                    fontSize={Math.min(l.size.x, l.size.y) * 0.35}
                    fontWeight={600}
                  >
                    {l.label}
                  </text>
                ))}

                {/* Arrows */}
                {map.arrows && Object.entries(map.arrows).map(([k, a]) => {
                  const cx = a.position.x + a.size.x / 2;
                  const cy = a.position.y + a.size.y / 2;
                  return (
                    <g key={`ar-${k}`} transform={`rotate(${a.angle || 0} ${cx} ${cy})`}>
                      <polygon
                        points={`${a.position.x + a.size.x / 2},${a.position.y} ${a.position.x + a.size.x},${a.position.y + a.size.y} ${a.position.x},${a.position.y + a.size.y}`}
                        fill="hsl(var(--primary))"
                        opacity={0.7}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            {data.pitAddresses && Object.keys(data.pitAddresses).length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">All Teams</h3>
                <PitAddressList addresses={data.pitAddresses} highlight={highlightTeam} />
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function PitAddressList({ addresses, highlight }: { addresses: Record<string, string>; highlight: string }) {
  const sorted = Object.entries(addresses).sort((a, b) => Number(a[0]) - Number(b[0]));
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
      {sorted.map(([team, addr]) => {
        const isMatch = highlight && team === highlight;
        return (
          <div
            key={team}
            className={cn(
              'px-3 py-2 rounded-lg border text-sm flex items-center justify-between transition-all',
              isMatch
                ? 'bg-secondary text-secondary-foreground border-secondary shadow-[0_0_12px_hsl(var(--secondary)/0.5)]'
                : 'bg-muted/30 border-border'
            )}
          >
            <span className="font-mono font-semibold">{team}</span>
            <span className={cn('font-mono text-xs', isMatch ? 'text-secondary-foreground' : 'text-muted-foreground')}>
              {addr}
            </span>
          </div>
        );
      })}
    </div>
  );
}
