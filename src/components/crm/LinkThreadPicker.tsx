import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link2, Loader2, User, Briefcase, Home, Unlink } from 'lucide-react';
import { useEntitySearch, useLinkThread, type EntitySearchHit } from '@/hooks/useGmail';
import { toast } from 'sonner';

interface Props {
  threadId: string;
  /** Current contact kind, if any — controls button label and shows Unlink. */
  currentKind?: 'owner' | 'realtor' | 'property' | 'unmatched';
  currentLabel?: string;
}

export const LinkThreadPicker: React.FC<Props> = ({ threadId, currentKind, currentLabel }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data: hits = [], isLoading } = useEntitySearch(query);
  const link = useLinkThread();

  const isMatched = currentKind && currentKind !== 'unmatched';

  const handleSelect = async (hit: EntitySearchHit) => {
    try {
      await link.mutateAsync({ threadId, target: { kind: hit.kind, id: hit.id } });
      toast.success(`Linked to ${hit.label}`);
      setOpen(false);
      setQuery('');
    } catch (e: any) {
      toast.error('Could not link thread', { description: e.message });
    }
  };

  const handleUnlink = async () => {
    try {
      await link.mutateAsync({ threadId, target: null });
      toast.success('Thread unlinked');
    } catch (e: any) {
      toast.error('Could not unlink', { description: e.message });
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant={isMatched ? 'ghost' : 'outline'} size="sm">
            <Link2 className="w-3.5 h-3.5 mr-1.5" />
            {isMatched ? `Linked: ${currentLabel ?? ''}` : 'Link to contact'}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search owner, realtor or property…"
            className="h-9 mb-2"
          />
          <div className="max-h-72 overflow-y-auto">
            {query.length < 2 ? (
              <div className="p-3 text-xs text-muted-foreground">Type at least 2 characters.</div>
            ) : isLoading ? (
              <div className="flex justify-center p-3"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
            ) : hits.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground">No matches.</div>
            ) : (
              hits.map((h) => {
                const Icon = h.kind === 'realtor' ? Briefcase : h.kind === 'property' ? Home : User;
                return (
                  <button
                    key={`${h.kind}:${h.id}`}
                    onClick={() => handleSelect(h)}
                    disabled={link.isPending}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-muted flex items-start gap-2 disabled:opacity-50"
                  >
                    <Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm truncate">{h.label}</div>
                      {h.sublabel && <div className="text-xs text-muted-foreground truncate">{h.sublabel}</div>}
                    </div>
                    <span className="text-[10px] uppercase text-muted-foreground">{h.kind}</span>
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
      {isMatched && (
        <Button variant="ghost" size="sm" onClick={handleUnlink} disabled={link.isPending} title="Unlink">
          <Unlink className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
};