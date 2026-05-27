import React, { useState, useRef, useEffect } from 'react';
import {
  useGmailAccounts,
  useConnectGmail,
  useDisconnectGmail,
  useSyncGmail,
  useUpdateGmailAccount,
  type GmailAccount,
} from '@/hooks/useGmail';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Loader2, Trash2, RefreshCw, Pencil, Check, X, Code } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface AccountRowProps {
  account: GmailAccount;
  onDisconnect: () => void;
}

const AccountRow: React.FC<AccountRowProps> = ({ account, onDisconnect }) => {
  const update = useUpdateGmailAccount();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(account.display_name ?? '');
  const [signature, setSignature] = useState(account.signature ?? '');
  const [showHtml, setShowHtml] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  // Initialize / reset the contenteditable when entering edit mode or switching from HTML view
  useEffect(() => {
    if (editing && !showHtml && editorRef.current) {
      if (editorRef.current.innerHTML !== signature) {
        editorRef.current.innerHTML = signature || '';
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, showHtml]);

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    const toInsert = html || text.replace(/\n/g, '<br/>');
    // Insert at caret
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const temp = document.createElement('div');
      temp.innerHTML = toInsert;
      const frag = document.createDocumentFragment();
      let node: ChildNode | null;
      let lastNode: ChildNode | null = null;
      while ((node = temp.firstChild)) {
        lastNode = frag.appendChild(node);
      }
      range.insertNode(frag);
      if (lastNode) {
        const newRange = document.createRange();
        newRange.setStartAfter(lastNode);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
      }
    } else if (editorRef.current) {
      editorRef.current.innerHTML += toInsert;
    }
    if (editorRef.current) setSignature(editorRef.current.innerHTML);
  };

  const handleInput = () => {
    if (editorRef.current) setSignature(editorRef.current.innerHTML);
  };

  const handleSave = async () => {
    try {
      await update.mutateAsync({
        id: account.id,
        display_name: displayName.trim() || null,
        signature: signature.trim() || null,
      });
      toast.success('Sender details saved');
      setEditing(false);
    } catch (e: any) {
      toast.error('Failed to save', { description: e.message });
    }
  };

  const handleCancel = () => {
    setDisplayName(account.display_name ?? '');
    setSignature(account.signature ?? '');
    setEditing(false);
    setShowHtml(false);
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Mail className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">
              {account.display_name ? (
                <>
                  {account.display_name}{' '}
                  <span className="text-muted-foreground font-normal">&lt;{account.email_address}&gt;</span>
                </>
              ) : (
                account.email_address
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {account.last_synced_at
                ? `Last synced ${formatDistanceToNow(new Date(account.last_synced_at), { addSuffix: true })}`
                : 'Never synced'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!editing && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onDisconnect}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {editing && (
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="space-y-1.5">
            <Label htmlFor={`name-${account.id}`} className="text-xs">
              Sender name
            </Label>
            <Input
              id={`name-${account.id}`}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. JJ King — Beachside VR"
              maxLength={120}
            />
            <p className="text-xs text-muted-foreground">
              Shown in recipients' inboxes instead of just your email address.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`sig-${account.id}`} className="text-xs">
              Signature
            </Label>
            {showHtml ? (
              <Textarea
                id={`sig-${account.id}`}
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder={'<p><strong>JJ King</strong><br/>Beachside VR</p>'}
                rows={8}
                maxLength={20000}
                className="font-mono text-xs"
              />
            ) : (
              <div
                ref={editorRef}
                id={`sig-${account.id}`}
                contentEditable
                suppressContentEditableWarning
                onPaste={handlePaste}
                onInput={handleInput}
                className="min-h-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            )}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Paste directly from Gmail — formatting, links and images are preserved.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setShowHtml((v) => !v)}
              >
                <Code className="w-3 h-3 mr-1" />
                {showHtml ? 'Visual' : 'HTML'}
              </Button>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={handleCancel} disabled={update.isPending}>
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={update.isPending}>
              {update.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export const EmailAccountsSettings: React.FC = () => {
  const { data: accounts = [], isLoading } = useGmailAccounts();
  const connect = useConnectGmail();
  const disconnect = useDisconnectGmail();
  const sync = useSyncGmail();

  const handleConnect = async () => {
    try {
      await connect.mutateAsync();
    } catch (e: any) {
      toast.error('Failed to start Gmail connection', { description: e.message });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-1">Email Accounts</h2>
        <p className="text-sm text-muted-foreground">
          Connect Gmail accounts to sync inbound/outbound emails that match contacts in your CRM. Emails are shared across your company.
        </p>
      </div>

      <div className="border border-border rounded-md divide-y divide-border">
        {isLoading ? (
          <div className="p-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : accounts.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No Gmail accounts connected yet.
          </div>
        ) : (
          accounts.map((a) => (
            <AccountRow
              key={a.id}
              account={a}
              onDisconnect={() => {
                if (confirm(`Disconnect ${a.email_address}? Existing emails stay in the CRM but no new ones will sync.`)) {
                  disconnect.mutate(a.id, {
                    onSuccess: () => toast.success('Disconnected'),
                  });
                }
              }}
            />
          ))
        )}
      </div>

      <div className="flex gap-2">
        <Button onClick={handleConnect} disabled={connect.isPending}>
          {connect.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
          Connect Gmail
        </Button>
        {accounts.length > 0 && (
          <Button variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending}>
            {sync.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Sync now
          </Button>
        )}
      </div>
    </div>
  );
};