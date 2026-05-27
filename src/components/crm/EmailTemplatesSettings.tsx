import React, { useState } from 'react';
import {
  useEmailTemplates,
  useSaveEmailTemplate,
  useDeleteEmailTemplate,
  MERGE_TAGS,
  type EmailTemplate,
} from '@/hooks/useEmailTemplates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';

export const EmailTemplatesSettings: React.FC = () => {
  const { data: templates = [], isLoading } = useEmailTemplates();
  const save = useSaveEmailTemplate();
  const del = useDeleteEmailTemplate();

  const [editing, setEditing] = useState<Partial<EmailTemplate> | null>(null);

  const handleSave = async () => {
    if (!editing?.name?.trim()) {
      toast.error('Name is required');
      return;
    }
    try {
      await save.mutateAsync({
        id: editing.id,
        name: editing.name.trim(),
        subject: editing.subject ?? '',
        body: editing.body ?? '',
        is_html: false,
      });
      toast.success(editing.id ? 'Template updated' : 'Template created');
      setEditing(null);
    } catch (e: any) {
      toast.error('Save failed', { description: e.message });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      await del.mutateAsync(id);
      toast.success('Template deleted');
    } catch (e: any) {
      toast.error('Delete failed', { description: e.message });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-semibold text-foreground">Email Templates</h2>
          <p className="text-sm text-muted-foreground">
            Reusable messages with merge tags like <code className="px-1 py-0.5 bg-muted rounded text-xs">{'{{owner.first_name}}'}</code>.
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing({ name: '', subject: '', body: '' })}>
          <Plus className="w-4 h-4 mr-2" /> New template
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : templates.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No templates yet. Create your first one.
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="flex items-start justify-between gap-3 p-3 border border-border rounded-lg hover:bg-muted/30 transition-colors">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm text-foreground">{t.name}</div>
                {t.subject && <div className="text-xs text-muted-foreground truncate">{t.subject}</div>}
                <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5 whitespace-pre-wrap">{t.body}</div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => setEditing(t)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit template' : 'New template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Name</label>
              <Input
                value={editing?.name ?? ''}
                onChange={(e) => setEditing((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Initial outreach"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Subject</label>
              <Input
                value={editing?.subject ?? ''}
                onChange={(e) => setEditing((p) => ({ ...p, subject: e.target.value }))}
                placeholder="e.g. About {{property.address}}"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Body</label>
              <Textarea
                value={editing?.body ?? ''}
                onChange={(e) => setEditing((p) => ({ ...p, body: e.target.value }))}
                rows={10}
                placeholder={`Hi {{owner.first_name}},\n\nI'm reaching out about {{property.address}}…`}
              />
            </div>
            <div className="border border-border rounded-md p-2 bg-muted/30">
              <div className="text-[11px] font-medium text-muted-foreground mb-1">Available merge tags</div>
              <div className="flex flex-wrap gap-1">
                {MERGE_TAGS.map((t) => (
                  <code
                    key={t.token}
                    className="px-1.5 py-0.5 text-[10px] bg-background border border-border rounded cursor-pointer hover:bg-muted"
                    title={t.label}
                    onClick={() => {
                      navigator.clipboard.writeText(t.token);
                      toast.success(`Copied ${t.token}`);
                    }}
                  >
                    {t.token}
                  </code>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={save.isPending}>
              {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};