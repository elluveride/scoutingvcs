import React from 'react';

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
}

export function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
  return (
    <div className="data-card flex flex-col items-center justify-center py-4">
      <Icon className={`w-5 h-5 mb-1 ${color}`} />
      <span className="text-2xl font-display font-bold">{value}</span>
      <span className="text-xs text-muted-foreground font-mono">{label}</span>
    </div>
  );
}
