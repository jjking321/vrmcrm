import React from 'react';
import { useGmailAccounts, useConnectGmail, useDisconnectGmail, useSyncGmail } from '@/hooks/useGmail';
import { Button } from '@/components/ui/button';
import { Mail, Loader2, Trash2, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

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
            <div key={a.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{a.email_address}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.last_synced_at
                      ? `Last synced ${formatDistanceToNow(new Date(a.last_synced_at), { addSuffix: true })}`
                      : 'Never synced'}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm(`Disconnect ${a.email_address}? Existing emails stay in the CRM but no new ones will sync.`)) {
                    disconnect.mutate(a.id, {
                      onSuccess: () => toast.success('Disconnected'),
                    });
                  }
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
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