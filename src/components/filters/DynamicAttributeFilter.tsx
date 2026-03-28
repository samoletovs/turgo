'use client';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CategorySpecificFilter } from '@/components/filter-sidebar';

interface DynamicAttributeFilterProps {
  attribute: CategorySpecificFilter;
  value?: string;
  onChange: (val: string | undefined) => void;
}

export function DynamicAttributeFilter({
  attribute,
  value,
  onChange,
}: DynamicAttributeFilterProps) {
  switch (attribute.type) {
    case 'SELECT': {
      const options = attribute.options ?? [];
      return (
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">{attribute.name}</Label>
          <div className="flex flex-wrap gap-1">
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => onChange(value === opt ? undefined : opt)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                  value === opt
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'hover:bg-muted',
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      );
    }

    case 'BOOLEAN':
      return (
        <button
          onClick={() => onChange(value === 'true' ? undefined : 'true')}
          className={cn(
            'flex w-full items-center rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-muted',
            value === 'true' && 'bg-muted font-medium text-primary',
          )}
        >
          {attribute.name}
        </button>
      );

    case 'NUMBER':
      return (
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">{attribute.name}</Label>
          <Input
            type="number"
            placeholder={attribute.name}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || undefined)}
            className="h-8 text-sm"
          />
        </div>
      );

    case 'TEXT':
    default:
      return (
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">{attribute.name}</Label>
          <Input
            type="text"
            placeholder={attribute.name}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || undefined)}
            className="h-8 text-sm"
          />
        </div>
      );
  }
}
