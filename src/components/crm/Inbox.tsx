import React, { useMemo, useRef, useState } from 'react';
import { useEmailThreads, useThreadMessages, useSendEmail, useSyncGmail, useGmailAccounts, useAttachmentsForMessages, useThreadContacts, type EmailAttachment } from '@/hooks/useGmail';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Loader2, Mail, RefreshCw, Inbox as InboxIcon, Send, Search, User, Home, Briefcase } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AttachmentPicker, MessageAttachments, type DraftAttachment } from './EmailAttachments';
import { ComposeModal } from './ComposeModal';
import { ReplyTools } from './ReplyTools';
import { applyMergeTags } from '@/hooks/useEmailTemplates';
import { LinkThreadPicker } from './LinkThreadPicker';

export const Inbox: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'unread' | 'unmatched'>('all');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<DraftAttachment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  const { company } = useAuth();
  useRealtimeSubscription('email_threads', ['email-threads']);
  useRealtimeSubscription('email_messages', ['email-messages']);

  const { data: accounts = [] } = useGmailAccounts();
  const { data: threads = [], isLoading } = useEmailThreads(filter === 'unread' ? 'unread' : 'all');
  const { data: messages = [], isLoading: messagesLoading } = useThreadMessages(selectedThreadId);
  const sync = useSyncGmail();
  const send = useSendEmail();

  const threadIds = useMemo(() => threads.map((t) => t.id), [threads]);
  const { data: contactMap } = useThreadContacts(threadIds);

  const visibleThreads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = threads;
    if (filter === 'unmatched') {
      list = list.filter((t) => !contactMap?.get(t.id));
    }
    if (!q) return list;
    return list.filter((t) => {
      const c = contactMap?.get(t.id);
      return (
        (t.subject ?? '').toLowerCase().includes(q) ||
        (t.snippet ?? '').toLowerCase().includes(q) ||
        (c?.label ?? '').toLowerCase().includes(q)
      );
    });
  }, [threads, contactMap, searchQuery, filter]);

  const selectedThread = threads.find((t) => t.id === selectedThreadId);
  const lastMessage = messages[messages.length - 1];

  const messageIds = useMemo(() => messages.map((m) => m.id), [messages]);
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

  const handleSync = async () => {
    try {
      const res = await sync.mutateAsync();
      toast.success('Inbox synced', {
        description: `${(res as any)?.results?.reduce((a: number, r: any) => a + (r.matched || 0), 0) ?? 0} new matched emails`,
      });
    } catch (e: any) {
      toast.error('Sync failed', { description: e.message });
    }
  };

  const handleReply = async () => {
    if (!lastMessage || (!replyBody.trim() && replyAttachments.length === 0)) return;
    const resolved = applyMergeTags(replyBody, {});
    try {
      await send.mutateAsync({
        to: lastMessage.from_email!,
        subject: lastMessage.subject?.startsWith('Re:') ? lastMessage.subject : `Re: ${lastMessage.subject ?? ''}`,
        body: resolved || '(see attached)',
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
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <InboxIcon className="w-12 h-12 text-muted-foreground mb-3" />
        <h2 className="text-xl font-semibold mb-1">No Gmail accounts connected</h2>
        <p className="text-muted-foreground mb-4 max-w-md">
          Connect your Gmail account in Settings → Email Accounts to start receiving emails matched to your CRM contacts.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Inbox</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border overflow-hidden text-sm">
            <button
              onClick={() => setFilter('all')}
              className={cn('px-3 py-1.5', filter === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
            >All</button>
            <button
              onClick={() => setFilter('unread')}
              className={cn('px-3 py-1.5', filter === 'unread' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
            >Unread</button>
            <button
              onClick={() => setFilter('unmatched')}
              className={cn('px-3 py-1.5 border-l border-border', filter === 'unmatched' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
              title="Threads not yet linked to an owner, realtor, or property"
            >Unmatched</button>
          </div>
          <Button variant="outline" size="sm" onClick={handleSync} disabled={sync.isPending}>
            {sync.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Sync now
          </Button>
          <Button size="sm" onClick={() => setComposeOpen(true)}>
            <Mail className="w-4 h-4 mr-2" /> Compose
          </Button>
        </div>
      </div>

      <ComposeModal open={composeOpen} onOpenChange={setComposeOpen} />

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Thread list */}
        <div className="w-96 border border-border rounded-md overflow-y-auto bg-card">
          <div className="sticky top-0 z-10 p-2 border-b border-border bg-card">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search contact, subject, snippet…"
                className="pl-8 h-9"
              />
            </div>
          </div>
          {isLoading ? (
            <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : visibleThreads.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">
              {searchQuery ? 'No threads match your search.' : 'No matched emails yet. Click "Sync now" to fetch the latest.'}
            </div>
          ) : (
            visibleThreads.map((t) => {
              const contact = contactMap?.get(t.id);
              const Icon = contact?.kind === 'realtor' ? Briefcase : contact?.kind === 'property' ? Home : User;
              return (
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
                  <div className="flex items-center gap-1.5 min-w-0">
                    {contact && <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                    <span className="truncate text-sm text-foreground">
                      {contact?.label ?? <span className="italic text-muted-foreground">Unmatched</span>}
                    </span>
                  </div>
                  {t.last_message_at && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(t.last_message_at), { addSuffix: false })}
                    </span>
                  )}
                </div>
                <p className="text-xs text-foreground/80 truncate">{t.subject || '(no subject)'}</p>
                <p className="text-xs text-muted-foreground truncate">{t.snippet}</p>
              </button>
              );
            })
          )}
        </div>

        {/* Thread detail */}
        <div className="flex-1 border border-border rounded-md bg-card flex flex-col min-h-0">
          {!selectedThread ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Select a thread to view messages
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-border flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold truncate">{selectedThread.subject || '(no subject)'}</h2>
                  {contactMap?.get(selectedThread.id)?.label && (
                    <p className="text-xs text-muted-foreground truncate">
                      Linked to {contactMap?.get(selectedThread.id)?.label}
                    </p>
                  )}
                </div>
                <LinkThreadPicker
                  threadId={selectedThread.id}
                  currentKind={contactMap?.get(selectedThread.id)?.kind ?? 'unmatched'}
                  currentLabel={contactMap?.get(selectedThread.id)?.label}
                />
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messagesLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className="border border-border rounded-md p-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                        <span>
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
                    ref={replyRef}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder={`Reply to ${lastMessage.from_name || lastMessage.from_email}...`}
                    rows={3}
                    className="mb-2"
                  />
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <ReplyTools
                      textareaRef={replyRef}
                      value={replyBody}
                      onChange={setReplyBody}
                    />
                    {company?.id && (
                      <AttachmentPicker
                        companyId={company.id}
                        attachments={replyAttachments}
                        onChange={setReplyAttachments}
                      />
                    )}
                  </div>
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