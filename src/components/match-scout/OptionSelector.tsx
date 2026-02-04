import React from 'react';
import { cn } from '@/lib/utils';

interface Option<T> {
  value: T;
  label: string;
  sublabel?: string;
  color?: string;
}

interface OptionSelectorProps<T> {
  label?: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  columns?: 2 | 3 | 4;
}

export function OptionSelector<T>({
  label,
  options,
  value,
  onChange,
  columns = 4,
}: OptionSelectorProps<T>) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  }[columns];

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <span className="pit-counter-label text-center">{label}</span>
      )}
      <div className={cn("grid gap-2", gridCols)}>
        {options.map((option) => {
          const isSelected = value === option.value;
          
          // Custom color handling for special buttons
          let buttonClass = 'pit-button-muted';
          let buttonStyle: React.CSSProperties = {};
          
          if (isSelected) {
            if (option.color) {
              buttonClass = '';
              buttonStyle = {
                backgroundColor: option.color,
                color: 'white',
                borderColor: option.color,
                boxShadow: `0 0 15px ${option.color}66`,
              };
            } else {
              buttonClass = 'pit-button-active';
            }
          }

          return (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "pit-button flex flex-col items-center justify-center gap-0.5 px-2",
                buttonClass
              )}
              style={buttonStyle}
            >
              <span className="text-sm font-medium">{option.label}</span>
              {option.sublabel && (
                <span className="text-[10px] opacity-70">{option.sublabel}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
