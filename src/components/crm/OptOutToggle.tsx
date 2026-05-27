import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, MapPin, Phone, UserX } from 'lucide-react';
import { toast } from 'sonner';
import {
  useOptOutIndex,
  useAddOptOut,
  useRemoveOptOut,
  normalizeOptOutValue,
  type OptOutChannel,
} from '@/hooks/useMarketingOptOuts';

const icons: Record<OptOutChannel, React.ComponentType<{ className?: string }>> = {
  mail: MapPin,
  phone: Phone,
  email: Mail,
};

interface Props {
  channel: OptOutChannel;
  value: string;
  ownerId?: string | null;
  propertyId?: string | null;
  /** When true: render compact icon-only toggle. Otherwise show full badge. */
  compact?: boolean;
}

/**
 * Per-record marketing opt-out toggle. Adds/removes a marketing_opt_outs entry
 * for the given channel + value, scoped to the user's company.
 */
export const OptOutToggle: React.FC<Props> = ({ channel, value, ownerId, propertyId, compact }) => {
  const { all } = useOptOutIndex();
  const add = useAddOptOut();
  const remove = useRemoveOptOut();

  if (!value?.trim()) return null;
  const normalized = normalizeOptOutValue(channel, value);
  const existing = all.find(r => r.channel === channel && r.normalized_value === normalized);
  const Icon = icons[channel];

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      if (existing) {
        await remove.mutateAsync(existing.id);
        toast.success(`Removed ${channel} opt-out`);
      } else {
        await add.mutateAsync({
          channel,
          value,
          owner_id: ownerId ?? null,
          property_id: propertyId ?? null,
          source: 'manual',
        });
        toast.success(`Opted out of ${channel}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update opt-out');
    }
  };

  if (existing) {
    return (
      <Badge
        variant="outline"
        className="gap-1 bg-amber-50 text-amber-700 border-amber-200 cursor-pointer hover:bg-amber-100"
        onClick={handleToggle}
        title="Click to remove opt-out"
      >
        <UserX className="w-3 h-3" />
        Opted out
      </Badge>
    );
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleToggle}
        title={`Mark this ${channel} as opted out`}
        className="text-muted-foreground/40 hover:text-amber-600 transition-colors"
      >
        <UserX className="w-3.5 h-3.5" />
      </button>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={handleToggle}
      className="h-6 px-2 text-xs text-muted-foreground hover:text-amber-700"
    >
      <Icon className="w-3 h-3 mr-1" />
      Opt out
    </Button>
  );
};