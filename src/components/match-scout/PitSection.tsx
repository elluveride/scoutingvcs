import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, LucideIcon } from 'lucide-react';

interface PitSectionProps {
  title: string;
  icon: LucideIcon;
  variant?: 'default' | 'red' | 'blue' | 'warning';
  /** When true, the header becomes a button that expands/collapses the content. */
  collapsible?: boolean;
  /** Starting open state for collapsible sections (default: true). */
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function PitSection({
  title,
  icon: Icon,
  variant = 'default',
  collapsible = false,
  defaultOpen = true,
  children,
  className,
}: PitSectionProps) {
  const [open, setOpen] = React.useState(defaultOpen);

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
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="pit-section-header w-full text-left cursor-pointer select-none"
        >
          <Icon className={cn("w-5 h-5", iconColor)} />
          <h2 className="font-display text-lg tracking-wide">{title}</h2>
          <ChevronDown
            className={cn(
              "w-4 h-4 ml-auto text-muted-foreground transition-transform duration-200",
              !open && "-rotate-90",
            )}
          />
        </button>
      ) : (
        <div className="pit-section-header">
          <Icon className={cn("w-5 h-5", iconColor)} />
          <h2 className="font-display text-lg tracking-wide">{title}</h2>
        </div>
      )}
      {(!collapsible || open) && (
        <div className="pit-section-content">
          {children}
        </div>
      )}
    </div>
  );
}
