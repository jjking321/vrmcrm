import React, { useState } from 'react';
import { useEmailThreads, useThreadMessages, useSendEmail, useSyncGmail, useGmailAccounts } from '@/hooks/useGmail';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Mail, RefreshCw, Inbox as InboxIcon, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const Inbox: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');

  useRealtimeSubscription('email_threads', ['email-threads']);
  useRealtimeSubscription('email_messages', ['email-messages']);

  const { data: accounts = [] } = useGmailAccounts();
  const { data: threads = [], isLoading } = useEmailThreads(filter);
  const { data: messages = [], isLoading: messagesLoading } = useThreadMessages(selectedThreadId);
  const sync = useSyncGmail();
  const send = useSendEmail();

  const selectedThread = threads.find((t) => t.id === selectedThreadId);
  const lastMessage = messages[messages.length - 1];

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
          </div>
          <Button variant="outline" size="sm" onClick={handleSync} disabled={sync.isPending}>
            {sync.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Sync now
          </Button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Thread list */}
        <div className="w-96 border border-border rounded-md overflow-y-auto bg-card">
          {isLoading ? (
            <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : threads.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">
              No matched emails yet. Click "Sync now" to fetch the latest.
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
        <div className="flex-1 border border-border rounded-md bg-card flex flex-col min-h-0">
          {!selectedThread ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Select a thread to view messages
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-border">
                <h2 className="font-semibold">{selectedThread.subject || '(no subject)'}</h2>
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