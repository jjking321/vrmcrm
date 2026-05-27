import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, UserX, Mail, Phone, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useMarketingOptOuts, useAddOptOut, useRemoveOptOut, type OptOutChannel } from '@/hooks/useMarketingOptOuts';

const channelLabels: Record<OptOutChannel, string> = {
  mail: 'Mail',
  phone: 'Phone',
  email: 'Email',
};

const channelIcons: Record<OptOutChannel, React.ComponentType<{ className?: string }>> = {
  mail: MapPin,
  phone: Phone,
  email: Mail,
};

export const MarketingOptOutsView: React.FC = () => {
  const { data: rows = [], isLoading } = useMarketingOptOuts();
  const remove = useRemoveOptOut();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<OptOutChannel | 'all'>('all');

  const filtered = useMemo(
    () => (tab === 'all' ? rows : rows.filter(r => r.channel === tab)),
    [rows, tab]
  );

  const counts = useMemo(() => ({
    mail: rows.filter(r => r.channel === 'mail').length,
    phone: rows.filter(r => r.channel === 'phone').length,
    email: rows.filter(r => r.channel === 'email').length,
  }), [rows]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <UserX className="w-6 h-6 text-amber-600" />
            Marketing Opt-outs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            People who asked not to be contacted on a specific channel. They stay in the database but are auto-excluded from future mailings.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add opt-out
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <SummaryCard label="Mail opt-outs" value={counts.mail} icon={MapPin} />
        <SummaryCard label="Phone opt-outs" value={counts.phone} icon={Phone} />
        <SummaryCard label="Email opt-outs" value={counts.email} icon={Mail} />
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="all">All ({rows.length})</TabsTrigger>
          <TabsTrigger value="mail">Mail ({counts.mail})</TabsTrigger>
          <TabsTrigger value="phone">Phone ({counts.phone})</TabsTrigger>
          <TabsTrigger value="email">Email ({counts.email})</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <UserX className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No opt-outs yet.</p>
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Flagged</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(row => {
                    const Icon = channelIcons[row.channel];
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            <Icon className="w-3 h-3" />
                            {channelLabels[row.channel]}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{row.value}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.source || '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{row.notes || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(row.flagged_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => remove.mutate(row.id)}
                            disabled={remove.isPending}
                            title="Remove opt-out"
                          >
                            <Trash2 className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AddOptOutDialog open={open} onOpenChange={setOpen} />
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; value: number; icon: React.ComponentType<{ className?: string }> }> = ({ label, value, icon: Icon }) => (
  <div className="bg-card border border-border rounded-lg p-4">
    <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
      <Icon className="w-3.5 h-3.5" />
      {label}
    </div>
    <p className="text-2xl font-semibold mt-1">{value}</p>
  </div>
);

const AddOptOutDialog: React.FC<{ open: boolean; onOpenChange: (o: boolean) => void }> = ({ open, onOpenChange }) => {
  const add = useAddOptOut();
  const [channel, setChannel] = useState<OptOutChannel>('mail');
  const [bulk, setBulk] = useState('');
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');

  const reset = () => { setBulk(''); setSource(''); setNotes(''); };

  const handleSubmit = async () => {
    const lines = bulk.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      toast.error('Enter at least one value');
      return;
    }
    try {
      await add.mutateAsync(
        lines.map(value => ({
          channel,
          value,
          source: source.trim() || null,
          notes: notes.trim() || null,
        }))
      );
      toast.success(`Added ${lines.length} opt-out${lines.length === 1 ? '' : 's'}`);
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to add opt-outs');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add marketing opt-out</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Channel</Label>
            <Select value={channel} onValueChange={v => setChannel(v as OptOutChannel)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mail">Mail (mailing address)</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Values (one per line)</Label>
            <Textarea
              value={bulk}
              onChange={e => setBulk(e.target.value)}
              placeholder={
                channel === 'mail'
                  ? '123 Main St, Cocoa Beach, FL 32931\n456 Ocean Ave, ...'
                  : channel === 'phone'
                    ? '555-123-4567\n555-987-6543'
                    : 'john@example.com\njane@example.com'
              }
              className="mt-1.5 min-h-[140px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Paste one or many. Each will be matched and excluded from future {channelLabels[channel].toLowerCase()} sends.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Source (optional)</Label>
              <Input
                value={source}
                onChange={e => setSource(e.target.value)}
                placeholder="e.g. Phone call, Form"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Reason / context"
                className="mt-1.5"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={add.isPending}>
            {add.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Add opt-outs
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};