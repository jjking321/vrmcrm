import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SourceBadgeProps {
  source?: string;
  className?: string;
}

/**
 * Displays a source badge for contact data provenance
 * Shows where a phone, email, or owner contact came from (list name or "manual")
 */
export const SourceBadge: React.FC<SourceBadgeProps> = ({ source, className }) => {
  if (!source) {
    return (
      <Badge 
        variant="outline" 
        className={cn("text-[10px] px-1.5 py-0 text-muted-foreground/60 border-dashed", className)}
      >
        unknown
      </Badge>
    );
  }

  // Truncate long source names
  const displaySource = source.length > 15 ? `${source.slice(0, 12)}...` : source;

  return (
    <Badge 
      variant="secondary" 
      className={cn("text-[10px] px-1.5 py-0", className)}
      title={source}
    >
      {displaySource}
    </Badge>
  );
};
