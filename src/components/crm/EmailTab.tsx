import React, { useMemo, useState, useRef } from 'react';
import {
  useMessagesForEntity,
  useSendEmail,
  useGmailAccounts,
  useThreadsByIds,
  useThreadMessages,
  useAttachmentsForMessages,
  getAttachmentUrl,
  type EmailAttachment,
} from '@/hooks/useGmail';
import type { MergeContext } from '@/hooks/useEmailTemplates';
import { ComposeModal } from './ComposeModal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, Mail, Paperclip, X, Download, FileIcon } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface DraftAttachment {
  storage_path: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
}

function formatBytes(n: number | null | undefined): string {
  if (!n || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Inline file picker + upload to the email-attachments bucket. */
const AttachmentPicker: React.FC<{
  companyId: string;
  attachments: DraftAttachment[];
  onChange: (next: DraftAttachment[]) => void;
}> = ({ companyId, attachments, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const added: DraftAttachment[] = [];
    for (const f of Array.from(files)) {
      if (f.size > 25 * 1024 * 1024) {
        toast.error(`${f.name} is too large (max 25 MB)`);
        continue;
      }
      const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${companyId}/_drafts/${crypto.randomUUID()}/${safe}`;
      const { error } = await supabase.storage
        .from('email-attachments')
        .upload(path, f, { contentType: f.type || 'application/octet-stream' });
      if (error) {
        toast.error(`Upload failed: ${f.name}`, { description: error.message });
        continue;
      }
      added.push({
        storage_path: path,
        filename: f.name,
        mime_type: f.type || 'application/octet-stream',
        size_bytes: f.size,
      });
    }
    setUploading(false);
    if (added.length) onChange([...attachments, ...added]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRemove = async (att: DraftAttachment) => {
    await supabase.storage.from('email-attachments').remove([att.storage_path]);
    onChange(attachments.filter((a) => a.storage_path !== att.storage_path));
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Paperclip className="w-4 h-4 mr-2" />}
        Attach files
      </Button>
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((a) => (
            <div
              key={a.storage_path}
              className="flex items-center gap-1.5 text-xs bg-muted/60 rounded px-2 py-1"
            >
              <FileIcon className="w-3 h-3 text-muted-foreground" />
              <span className="truncate max-w-[180px]">{a.filename}</span>
              <span className="text-muted-foreground">{formatBytes(a.size_bytes)}</span>
              <button
                type="button"
                onClick={() => handleRemove(a)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Remove attachment"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/** Render the attachments for a single saved message as download chips. */
const MessageAttachments: React.FC<{ items: EmailAttachment[] }> = ({ items }) => {
  if (items.length === 0) return null;
  const handleOpen = async (att: EmailAttachment) => {
    try {
      const url = await getAttachmentUrl(att.storage_path);
      window.open(url, '_blank', 'noopener');
    } catch (e: any) {
      toast.error('Could not open attachment', { description: e.message });
    }
  };
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((a) => (
        <button
          key={a.id}
          onClick={() => handleOpen(a)}
          className="flex items-center gap-1.5 text-xs bg-muted/60 hover:bg-muted rounded px-2 py-1 transition-colors"
        >
          <Download className="w-3 h-3 text-muted-foreground" />
          <span className="truncate max-w-[200px]">{a.filename}</span>
          <span className="text-muted-foreground">{formatBytes(a.size_bytes)}</span>
        </button>
      ))}
    </div>
  );
};

interface EmailTabProps {
  ownerId?: string;
  realtorId?: string;
  propertyId?: string;
  ownerIds?: string[];
  propertyIds?: string[];
  defaultRecipient?: string;
  defaultSubject?: string;
  title?: string;
  /** Height of the embedded inbox (e.g. '600px'). Default 600px. */
  height?: string;
  /** Context used to resolve merge tags like {{owner.first_name}} in templates. */
  mergeContext?: MergeContext;
}

export const EmailTab: React.FC<EmailTabProps> = ({
  ownerId, realtorId, propertyId, ownerIds, propertyIds,
  defaultRecipient, defaultSubject, title = 'Inbox', height = '600px',
  mergeContext,
}) => {
  const { company } = useAuth();
  const { data: entityMessages = [], isLoading } = useMessagesForEntity({
    ownerId, realtorId, propertyId, ownerIds, propertyIds,
  });
  const { data: accounts = [] } = useGmailAccounts();
  const send = useSendEmail();

  // Derive distinct thread ids from the entity's matched messages
  const threadIds = useMemo(() => {
    const set = new Set<string>();
    entityMessages.forEach((m) => m.thread_id && set.add(m.thread_id));
    return Array.from(set);
  }, [entityMessages]);

  const { data: threads = [], isLoading: threadsLoading } = useThreadsByIds(threadIds);

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const selectedThread = threads.find((t) => t.id === selectedThreadId);
  const { data: threadMessages = [], isLoading: messagesLoading } = useThreadMessages(selectedThreadId);
  const lastMessage = threadMessages[threadMessages.length - 1];

  // Attachments for all messages currently rendered in the open thread.
  const messageIds = useMemo(() => threadMessages.map((m) => m.id), [threadMessages]);
  const { data: allAttachments = [] } = useAttachmentsForMessages(messageIds);
  const attachmentsByMessage = useMemo(() => {
    const m = new Map<string, EmailAttachment[]>();
    allAttachments.forEach((a) => {
      const arr = m.get(a.message_id) ?? [];
      arr.push(a);
      m.set(a.message_id, arr);
    });
    return m;
  }, [allAttachments]);

  // Auto-select first thread once loaded
  React.useEffect(() => {
    if (!selectedThreadId && threads.length > 0) {
      setSelectedThreadId(threads[0].id);
    }
  }, [threads, selectedThreadId]);

  const [composing, setComposing] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<DraftAttachment[]>([]);

  const handleReply = async () => {
    if (!lastMessage || (!replyBody.trim() && replyAttachments.length === 0)) return;
    try {
      await send.mutateAsync({
        to: lastMessage.from_email!,
        subject: lastMessage.subject?.startsWith('Re:') ? lastMessage.subject : `Re: ${lastMessage.subject ?? ''}`,
        body: replyBody || '(see attached)',
        threadId: selectedThread?.gmail_thread_id,
        attachments: replyAttachments.map(({ storage_path, filename, mime_type }) => ({
          storage_path, filename, mime_type,
        })),
      });
      setReplyBody('');
      setReplyAttachments([]);
      toast.success('Reply sent');
    } catch (e: any) {
      toast.error('Failed to send', { description: e.message });
    }
  };

  if (accounts.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border shadow-soft p-5">
        <h2 className="text-lg font-semibold text-foreground mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground">
          Connect a Gmail account in Settings → Email Accounts to send and view emails.
        </p>
      </div>
    );
  }

  const loading = isLoading || threadsLoading;

  return (
    <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <span className="text-xs text-muted-foreground">{threads.length} {threads.length === 1 ? 'thread' : 'threads'}</span>
        </div>
        {!composing && (
          <Button size="sm" variant="outline" onClick={() => setComposing(true)}>
            <Mail className="w-4 h-4 mr-2" /> Compose
          </Button>
        )}
      </div>

      <ComposeModal
        open={composing}
        onOpenChange={setComposing}
        defaultRecipient={defaultRecipient}
        defaultSubject={defaultSubject}
        mergeContext={mergeContext}
      />

      <div className="flex" style={{ height }}>
        {/* Thread list */}
        <div className="w-72 border-r border-border overflow-y-auto bg-background/40">
          {loading ? (
            <div className="p-6 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : threads.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">
              No emails yet.
            </div>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedThreadId(t.id)}
                className={cn(
                  'w-full text-left p-3 border-b border-border hover:bg-muted/50 transition-colors',
                  selectedThreadId === t.id && 'bg-muted',
                  !t.is_read && 'font-semibold'
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="truncate text-sm">{t.subject || '(no subject)'}</span>
                  {t.last_message_at && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(t.last_message_at), { addSuffix: false })}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{t.snippet}</p>
              </button>
            ))
          )}
        </div>

        {/* Thread detail */}
        <div className="flex-1 flex flex-col min-h-0">
          {!selectedThread ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              {threads.length === 0 ? '' : 'Select a thread to view messages'}
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-border">
                <h3 className="font-semibold text-sm truncate">{selectedThread.subject || '(no subject)'}</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messagesLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : (
                  threadMessages.map((m) => (
                    <div key={m.id} className="border border-border rounded-md p-3 bg-card">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                        <span>
                          {m.direction === 'outbound' ? 'To' : 'From'}:{' '}
                          <strong className="text-foreground">{m.from_name || m.from_email}</strong>
                          {m.from_name && <span> &lt;{m.from_email}&gt;</span>}
                        </span>
                        {m.sent_at && <span>{new Date(m.sent_at).toLocaleString()}</span>}
                      </div>
                      {m.body_html ? (
                        <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: m.body_html }} />
                      ) : (
                        <pre className="text-sm whitespace-pre-wrap font-sans">{m.body_text || m.snippet}</pre>
                      )}
                      <MessageAttachments items={attachmentsByMessage.get(m.id) ?? []} />
                    </div>
                  ))
                )}
              </div>
              {lastMessage && (
                <div className="border-t border-border p-3">
                  <Textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder={`Reply to ${lastMessage.from_name || lastMessage.from_email}...`}
                    rows={3}
                    className="mb-2"
                  />
                  {company?.id && (
                    <div className="mb-2">
                      <AttachmentPicker
                        companyId={company.id}
                        attachments={replyAttachments}
                        onChange={setReplyAttachments}
                      />
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Button onClick={handleReply} disabled={send.isPending || (!replyBody.trim() && replyAttachments.length === 0)} size="sm">
                      {send.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                      Send reply
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};