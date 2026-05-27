import React, { useState } from 'react';
import { useMessagesForEntity, useSendEmail, useGmailAccounts } from '@/hooks/useGmail';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Loader2, Send, Mail } from 'lucide-react';
import { toast } from 'sonner';

interface EmailTabProps {
  ownerId?: string;
  realtorId?: string;
  propertyId?: string;
  defaultRecipient?: string;
}

export const EmailTab: React.FC<EmailTabProps> = ({ ownerId, realtorId, propertyId, defaultRecipient }) => {
  const { data: messages = [], isLoading } = useMessagesForEntity({ ownerId, realtorId, propertyId });
  const { data: accounts = [] } = useGmailAccounts();
  const send = useSendEmail();

  const [composing, setComposing] = useState(false);
  const [to, setTo] = useState(defaultRecipient ?? '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

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

  if (accounts.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground border border-dashed border-border rounded-md">
        Connect a Gmail account in Settings → Email Accounts to send and view emails.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {!composing && (
          <Button size="sm" onClick={() => setComposing(true)}>
            <Mail className="w-4 h-4 mr-2" /> Compose
          </Button>
        )}
      </div>

      {composing && (
        <div className="border border-border rounded-md p-3 space-y-2 bg-card">
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

      {isLoading ? (
        <div className="flex justify-center p-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : messages.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground border border-dashed border-border rounded-md">
          No emails yet.
        </div>
      ) : (
        <div className="space-y-2">
          {messages.map((m) => (
            <div key={m.id} className="border border-border rounded-md p-3 bg-card">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>
                  {m.direction === 'outbound' ? 'To' : 'From'}:{' '}
                  <strong className="text-foreground">{m.from_name || m.from_email}</strong>
                </span>
                {m.sent_at && <span>{new Date(m.sent_at).toLocaleString()}</span>}
              </div>
              <p className="font-medium text-sm mb-1">{m.subject || '(no subject)'}</p>
              <p className="text-sm text-muted-foreground line-clamp-3">{m.snippet || m.body_text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};