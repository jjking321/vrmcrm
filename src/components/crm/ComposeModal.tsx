import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import { useSendEmail } from '@/hooks/useGmail';
import {
  useEmailTemplates,
  applyMergeTags,
  withDerivedOwner,
  MERGE_TAGS,
  type MergeContext,
} from '@/hooks/useEmailTemplates';
import { AttachmentPicker, type DraftAttachment } from './EmailAttachments';
import { Loader2, Send, FileText, Braces } from 'lucide-react';
import { toast } from 'sonner';

interface ComposeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultRecipient?: string;
  defaultSubject?: string;
  defaultBody?: string;
  threadId?: string;
  mergeContext?: MergeContext;
  onSent?: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  open,
  onOpenChange,
  defaultRecipient = '',
  defaultSubject = '',
  defaultBody = '',
  threadId,
  mergeContext,
  onSent,
}) => {
  const { company, profile } = useAuth();
  const send = useSendEmail();
  const { data: templates = [] } = useEmailTemplates();

  const [to, setTo] = useState(defaultRecipient);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [mergePickerOpen, setMergePickerOpen] = useState(false);

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const lastFocused = useRef<'subject' | 'body'>('body');

  // Reset when the modal opens
  useEffect(() => {
    if (open) {
      setTo(defaultRecipient);
      setSubject(defaultSubject);
      setBody(defaultBody);
      setAttachments([]);
    }
  }, [open, defaultRecipient, defaultSubject, defaultBody]);

  const fullContext: MergeContext = useMemo(
    () =>
      withDerivedOwner({
        ...mergeContext,
        user: {
          name: profile?.name ?? null,
          email: (profile as any)?.email ?? null,
          ...mergeContext?.user,
        },
      }),
    [mergeContext, profile]
  );

  const previewSubject = useMemo(() => applyMergeTags(subject, fullContext), [subject, fullContext]);
  const previewBody = useMemo(() => applyMergeTags(body, fullContext), [body, fullContext]);

  const insertAtCursor = (text: string) => {
    const target = lastFocused.current === 'subject' ? subjectRef.current : bodyRef.current;
    if (!target) {
      setBody((b) => b + text);
      return;
    }
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    const current = target.value;
    const next = current.slice(0, start) + text + current.slice(end);
    if (lastFocused.current === 'subject') setSubject(next);
    else setBody(next);
    requestAnimationFrame(() => {
      target.focus();
      const pos = start + text.length;
      target.setSelectionRange(pos, pos);
    });
  };

  const applyTemplate = (templateId: string) => {
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    if (t.subject) setSubject(t.subject);
    setBody(t.body);
    setTemplatePickerOpen(false);
    toast.success(`Inserted "${t.name}"`);
  };

  const handleSend = async () => {
    if (!to.trim() || !previewSubject.trim() || (!previewBody.trim() && attachments.length === 0)) {
      toast.error('Fill in to, subject, and message');
      return;
    }
    try {
      await send.mutateAsync({
        to,
        subject: previewSubject,
        body: previewBody || '(see attached)',
        threadId,
        attachments: attachments.map(({ storage_path, filename, mime_type }) => ({
          storage_path, filename, mime_type,
        })),
      });
      toast.success('Email sent');
      onSent?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Failed to send', { description: e.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New email</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="To"
          />
          <Input
            ref={subjectRef}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onFocus={() => (lastFocused.current = 'subject')}
            placeholder="Subject"
          />
          <Textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onFocus={() => (lastFocused.current = 'body')}
            placeholder="Write your message… Use {{owner.first_name}} or pick a merge tag below."
            rows={10}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Popover open={templatePickerOpen} onOpenChange={setTemplatePickerOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="sm">
                  <FileText className="w-4 h-4 mr-2" />
                  Templates
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
                      {t.subject && (
                        <div className="text-xs text-muted-foreground truncate">{t.subject}</div>
                      )}
                    </button>
                  ))
                )}
              </PopoverContent>
            </Popover>

            <Popover open={mergePickerOpen} onOpenChange={setMergePickerOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="sm">
                  <Braces className="w-4 h-4 mr-2" />
                  Merge tag
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-1">
                {MERGE_TAGS.map((t) => (
                  <button
                    key={t.token}
                    onClick={() => { insertAtCursor(t.token); setMergePickerOpen(false); }}
                    className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{t.label}</span>
                    <code className="text-[10px] text-muted-foreground">{t.token}</code>
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {company?.id && (
              <AttachmentPicker
                companyId={company.id}
                attachments={attachments}
                onChange={setAttachments}
              />
            )}
          </div>

          {(previewSubject !== subject || previewBody !== body) && (
            <div className="border border-border rounded-md p-3 bg-muted/30 text-xs">
              <div className="text-muted-foreground mb-1 font-medium">Preview with merge tags</div>
              <div className="mb-1"><strong>Subject:</strong> {previewSubject || <em className="text-muted-foreground">(empty)</em>}</div>
              <pre className="whitespace-pre-wrap font-sans">{previewBody}</pre>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSend} disabled={send.isPending}>
            {send.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};