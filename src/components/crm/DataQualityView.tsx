import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, ShieldAlert, FileText, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useBadContactData, useBadDataBatches, useUnflagBadData, type BadDataReason, type BadDataType } from '@/hooks/useBadContactData';
import { useDataQualityStats } from '@/hooks/useDataQualityStats';
import { BadDataUploadWizard } from './BadDataUploadWizard';

const reasonLabels: Record<BadDataReason, string> = {
  returned_to_sender: 'Returned to sender',
  bounced: 'Bounced',
  wrong_number: 'Wrong number',
  disconnected: 'Disconnected',
  do_not_contact: 'Do not contact',
  other: 'Other',
};

const typeLabels: Record<BadDataType, string> = {
  mailing_address: 'Address',
  phone: 'Phone',
  email: 'Email',
};

export const DataQualityView: React.FC = () => {
  const { rows, totalBad, totalContacts, isLoading: statsLoading } = useDataQualityStats();
  const { data: flagged = [], isLoading: flaggedLoading } = useBadContactData();
  const { data: batches = [], isLoading: batchesLoading } = useBadDataBatches();
  const unflagMutation = useUnflagBadData();
  const [wizardOpen, setWizardOpen] = useState(false);

  const overallBadRate = totalContacts > 0 ? (totalBad / totalContacts) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-amber-600" />
            Data Quality
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track bad mailing addresses, phones, and emails. Auto-excluded from future mailings.
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Flag bad data
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total flagged</p>
          <p className="text-2xl font-semibold mt-1">{totalBad}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total contact points</p>
          <p className="text-2xl font-semibold mt-1">{totalContacts}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Bad rate</p>
          <p className="text-2xl font-semibold mt-1 text-amber-700">{overallBadRate.toFixed(1)}%</p>
        </div>
      </div>

      <Tabs defaultValue="sources">
        <TabsList>
          <TabsTrigger value="sources">Source quality</TabsTrigger>
          <TabsTrigger value="flagged">Flagged records ({flagged.length})</TabsTrigger>
          <TabsTrigger value="batches">Upload history ({batches.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="mt-4">
          {statsLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <div className="bg-muted/50 rounded-lg p-8 text-center text-muted-foreground text-sm">
              No source data yet. Import contacts and flag bad data to see source quality scores.
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Addresses (bad/total)</TableHead>
                    <TableHead className="text-right">Phones (bad/total)</TableHead>
                    <TableHead className="text-right">Emails (bad/total)</TableHead>
                    <TableHead className="text-right">Bad rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.source}>
                      <TableCell className="font-medium">{r.source}</TableCell>
                      <TableCell className="text-right text-sm">
                        <span className="text-amber-700">{r.addressBad}</span>
                        <span className="text-muted-foreground"> / {r.addressTotal}</span>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        <span className="text-amber-700">{r.phoneBad}</span>
                        <span className="text-muted-foreground"> / {r.phoneTotal}</span>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        <span className="text-amber-700">{r.emailBad}</span>
                        <span className="text-muted-foreground"> / {r.emailTotal}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="secondary"
                          className={
                            r.badRate > 0.2 ? 'bg-red-100 text-red-800' :
                            r.badRate > 0.05 ? 'bg-amber-100 text-amber-800' :
                            'bg-emerald-100 text-emerald-800'
                          }
                        >
                          {(r.badRate * 100).toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="flagged" className="mt-4">
          {flaggedLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : flagged.length === 0 ? (
            <div className="bg-muted/50 rounded-lg p-8 text-center text-muted-foreground text-sm">
              No flagged records yet.
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Flagged</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flagged.slice(0, 500).map(r => (
                    <TableRow key={r.id}>
                      <TableCell><Badge variant="outline" className="text-xs">{typeLabels[r.data_type]}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{r.value}</TableCell>
                      <TableCell className="text-sm">{reasonLabels[r.reason]}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.source || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(r.flagged_at), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        <button
                          onClick={() => {
                            if (confirm('Unflag this record? It will be eligible for mailings/calls again.')) {
                              unflagMutation.mutate(r.id);
                            }
                          }}
                          className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                          title="Unflag"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {flagged.length > 500 && (
                <p className="text-xs text-muted-foreground p-3 text-center border-t border-border">Showing first 500 of {flagged.length}</p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="batches" className="mt-4">
          {batchesLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : batches.length === 0 ? (
            <div className="bg-muted/50 rounded-lg p-8 text-center text-muted-foreground text-sm">
              No upload batches yet.
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Source label</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Matched</TableHead>
                    <TableHead>Uploaded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map(b => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.source_label}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{typeLabels[b.data_type]}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground flex items-center gap-1">
                        {b.uploaded_file_name ? (<><FileText className="w-3 h-3" />{b.uploaded_file_name}</>) : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm">{b.total_rows}</TableCell>
                      <TableCell className="text-right text-sm">
                        <span className="text-emerald-700">{b.matched_count}</span>
                        <span className="text-muted-foreground"> / {b.total_rows}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(b.created_at), 'MMM d, yyyy')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <BadDataUploadWizard isOpen={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
};