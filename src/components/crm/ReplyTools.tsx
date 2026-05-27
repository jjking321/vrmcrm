import React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FileText, Braces } from 'lucide-react';
import {
  useEmailTemplates,
  applyMergeTags,
  withDerivedOwner,
  MERGE_TAGS,
  type MergeContext,
} from '@/hooks/useEmailTemplates';
import { toast } from 'sonner';

interface ReplyToolsProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (next: string) => void;
  mergeContext?: MergeContext;
}

/** Templates + merge-tag pickers that insert into a reply textarea. */
export const ReplyTools: React.FC<ReplyToolsProps> = ({ textareaRef, value, onChange, mergeContext }) => {
  const { data: templates = [] } = useEmailTemplates();
  const ctx = withDerivedOwner(mergeContext ?? {});

  const insertAtCursor = (text: string) => {
    const ta = textareaRef.current;
    if (!ta) { onChange(value + text); return; }
    const start = ta.selectionStart ?? value.length;
    const end = ta.selectionEnd ?? value.length;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + text.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    const resolved = applyMergeTags(t.body, ctx);
    onChange(value ? `${value}\n\n${resolved}` : resolved);
    toast.success(`Inserted "${t.name}"`);
  };

  return (
    <div className="flex items-center gap-1">
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="sm">
            <FileText className="w-3.5 h-3.5 mr-1.5" /> Template
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-1">
          {templates.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">
              No templates yet. Create one in Settings → Email Templates.
            </div>
          ) : (
            templates.map((t) => (
              <button
                key={t.id}
                onClick={() => applyTemplate(t.id)}
                className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted"
              >
                <div className="font-medium truncate">{t.name}</div>
                {t.subject && <div className="text-xs text-muted-foreground truncate">{t.subject}</div>}
              </button>
            ))
          )}
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="sm">
            <Braces className="w-3.5 h-3.5 mr-1.5" /> Merge tag
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-1">
          {MERGE_TAGS.map((t) => (
            <button
              key={t.token}
              onClick={() => insertAtCursor(t.token)}
              className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted flex items-center justify-between gap-2"
            >
              <span className="truncate">{t.label}</span>
              <code className="text-[10px] text-muted-foreground">{t.token}</code>
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
};