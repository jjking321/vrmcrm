import React, { useMemo, useState } from 'react';
import {
  useMessagesForEntity,
  useSendEmail,
  useGmailAccounts,
  useThreadsByIds,
  useThreadMessages,
} from '@/hooks/useGmail';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Loader2, Send, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

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
}

export const EmailTab: React.FC<EmailTabProps> = ({
  ownerId, realtorId, propertyId, ownerIds, propertyIds,
  defaultRecipient, defaultSubject, title = 'Inbox', height = '600px',
}) => {
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

  // Auto-select first thread once loaded
  React.useEffect(() => {
    if (!selectedThreadId && threads.length > 0) {
      setSelectedThreadId(threads[0].id);
    }
  }, [threads, selectedThreadId]);

  const [composing, setComposing] = useState(false);
  const [to, setTo] = useState(defaultRecipient ?? '');
  const [subject, setSubject] = useState(defaultSubject ?? '');
  const [body, setBody] = useState('');
  const [replyBody, setReplyBody] = useState('');

  const handleSend = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      toast.error('Fill in to, subject, and message');
      return;
    }
    try {
      await send.mutateAsync({ to, subject, body });
      setComposing(false);
      setSubject('');
      setBody('');
      toast.success('Email sent');
    } catch (e: any) {
      toast.error('Failed to send', { description: e.message });
    }
  };

  const handleReply = async () => {
    if (!lastMessage || !replyBody.trim()) return;
    try {
      await send.mutateAsync({
        to: lastMessage.from_email!,
        subject: lastMessage.subject?.startsWith('Re:') ? lastMessage.subject : `Re: ${lastMessage.subject ?? ''}`,
        body: replyBody,
        threadId: selectedThread?.gmail_thread_id,
      });
      setReplyBody('');
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

      {composing && (
        <div className="border-b border-border p-3 space-y-2 bg-muted/20">
          <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" />
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message" rows={5} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setComposing(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSend} disabled={send.isPending}>
              {send.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Send
            </Button>
          </div>
        </div>
      )}

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
                  <div className="flex justify-end">
                    <Button onClick={handleReply} disabled={send.isPending || !replyBody.trim()} size="sm">
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