import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface PitSectionProps {
  title: string;
  icon: LucideIcon;
  variant?: 'default' | 'red' | 'blue' | 'warning';
  children: React.ReactNode;
  className?: string;
}

export function PitSection({
  title,
  icon: Icon,
  variant = 'default',
  children,
  className,
}: PitSectionProps) {
  const sectionClass = {
    default: 'pit-section',
    red: 'pit-section pit-section-red',
    blue: 'pit-section pit-section-blue',
    warning: 'pit-section pit-section-warning',
  }[variant];

  const iconColor = {
    default: 'text-primary',
    red: 'text-alliance-red',
    blue: 'text-alliance-blue',
    warning: 'text-warning',
  }[variant];

  return (
    <div className={cn(sectionClass, className)}>
      <div className="pit-section-header">
        <Icon className={cn("w-5 h-5", iconColor)} />
        <h2 className="font-display text-lg tracking-wide">{title}</h2>
      </div>
      <div className="pit-section-content">
        {children}
      </div>
    </div>
  );
}
