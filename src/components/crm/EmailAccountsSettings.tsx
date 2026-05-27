import React, { useState } from 'react';
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
import { Mail, Loader2, Trash2, RefreshCw, Pencil, Check, X } from 'lucide-react';
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
            <Textarea
              id={`sig-${account.id}`}
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder={'JJ King\nBeachside VR\n(555) 123-4567'}
              rows={5}
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground">
              Automatically appended to every email you send from this account.
            </p>
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