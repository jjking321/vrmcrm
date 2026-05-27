import React, { useState } from 'react';
import { useEmailNotes, useCreateEmailNote, useDeleteEmailNote, useProfileNames } from '@/hooks/useEmailCollab';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, StickyNote, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface Props {
  threadId?: string | null;
  ownerId?: string | null;
  realtorId?: string | null;
  propertyId?: string | null;
  compact?: boolean;
}

export const InternalNotes: React.FC<Props> = ({ threadId, ownerId, realtorId, propertyId, compact }) => {
  const [body, setBody] = useState('');
  const { user } = useAuth();
  useRealtimeSubscription('email_notes', ['email-notes']);

  const { data: notes = [], isLoading } = useEmailNotes({ threadId, ownerId, realtorId, propertyId });
  const create = useCreateEmailNote();
  const del = useDeleteEmailNote();
  const { data: nameMap } = useProfileNames(notes.map((n) => n.created_by).filter(Boolean) as string[]);

  const submit = async () => {
    if (!body.trim()) return;
    try {
      await create.mutateAsync({ body: body.trim(), threadId, ownerId, realtorId, propertyId });
      setBody('');
    } catch (e: any) {
      toast.error('Failed to add note', { description: e.message });
    }
  };

  return (
    <div className={compact ? '' : 'border border-border rounded-md bg-card p-4'}>
      <div className="flex items-center gap-2 mb-3">
        <StickyNote className="w-4 h-4 text-amber-600" />
        <h3 className="font-semibold text-sm">Internal notes</h3>
        <span className="text-xs text-muted-foreground">· visible to your team only</span>
      </div>

      <div className="space-y-2 mb-3">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Leave a note for your team…"
          rows={2}
          className="bg-amber-50/40 border-amber-200/60 focus-visible:ring-amber-400"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={submit} disabled={create.isPending || !body.trim()}>
            {create.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Add note
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
      ) : notes.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="border border-amber-200/60 bg-amber-50/40 rounded-md p-2.5 text-sm">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>
                  <strong className="text-foreground">{(n.created_by && nameMap?.get(n.created_by)) || 'Someone'}</strong>
                  {' · '}
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </span>
                {n.created_by === user?.id && (
                  <button
                    onClick={() => del.mutate(n.id)}
                    className="text-muted-foreground hover:text-destructive"
                    title="Delete note"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap text-foreground/90">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};