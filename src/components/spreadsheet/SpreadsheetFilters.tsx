import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter } from 'lucide-react';

interface SpreadsheetFiltersProps {
  teamFilter: string;
  onTeamFilterChange: (value: string) => void;
  matchMin: string;
  onMatchMinChange: (value: string) => void;
  matchMax: string;
  onMatchMaxChange: (value: string) => void;
  scouterFilter: string;
  onScouterFilterChange: (value: string) => void;
  scouterNames: string[];
}

export function SpreadsheetFilters({
  teamFilter, onTeamFilterChange,
  matchMin, onMatchMinChange,
  matchMax, onMatchMaxChange,
  scouterFilter, onScouterFilterChange,
  scouterNames,
}: SpreadsheetFiltersProps) {
  return (
    <div className="data-card mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-mono text-muted-foreground">Filters</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={teamFilter}
            onChange={(e) => onTeamFilterChange(e.target.value)}
            placeholder="Team #"
            className="pl-9 h-10 font-mono"
          />
        </div>
        <div className="flex gap-2">
          <Input
            type="number"
            value={matchMin}
            onChange={(e) => onMatchMinChange(e.target.value)}
            placeholder="Match min"
            className="h-10 font-mono"
          />
          <Input
            type="number"
            value={matchMax}
            onChange={(e) => onMatchMaxChange(e.target.value)}
            placeholder="Match max"
            className="h-10 font-mono"
          />
        </div>
        <Select value={scouterFilter} onValueChange={onScouterFilterChange}>
          <SelectTrigger className="h-10">
            <SelectValue placeholder="All scouters" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All scouters</SelectItem>
            {scouterNames.map(name => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
