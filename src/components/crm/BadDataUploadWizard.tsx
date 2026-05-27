import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFlagBadData, useCreateBadDataBatch, normalizeValue, type BadDataType, type BadDataReason } from '@/hooks/useBadContactData';
import { normalizeAddressForMatch, normalizePhoneForMatch } from '@/lib/exclusionUtils';
import { toast } from 'sonner';

interface BadDataUploadWizardProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: BadDataType;
  defaultReason?: BadDataReason;
  defaultSourceLabel?: string;
  mailingListId?: string | null;
}

interface MatchPreview {
  value: string;
  normalized: string;
  ownerId: string | null;
  propertyId: string | null;
  source: string | null;
  matched: boolean;
}

export const BadDataUploadWizard: React.FC<BadDataUploadWizardProps> = ({
  isOpen,
  onClose,
  defaultType = 'mailing_address',
  defaultReason = 'returned_to_sender',
  defaultSourceLabel = '',
  mailingListId = null,
}) => {
  const { company } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [dataType, setDataType] = useState<BadDataType>(defaultType);
  const [reason, setReason] = useState<BadDataReason>(defaultReason);
  const [sourceLabel, setSourceLabel] = useState(defaultSourceLabel);
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);
  const [preview, setPreview] = useState<MatchPreview[]>([]);

  const flagMutation = useFlagBadData();
  const batchMutation = useCreateBadDataBatch();

  const reasonsForType: Record<BadDataType, BadDataReason[]> = {
    mailing_address: ['returned_to_sender', 'do_not_contact', 'other'],
    phone: ['wrong_number', 'disconnected', 'do_not_contact', 'other'],
    email: ['bounced', 'do_not_contact', 'other'],
  };

  const reasonLabels: Record<BadDataReason, string> = {
    returned_to_sender: 'Returned to sender',
    bounced: 'Bounced',
    wrong_number: 'Wrong number',
    disconnected: 'Disconnected',
    do_not_contact: 'Do not contact',
    other: 'Other',
  };

  const typeLabels: Record<BadDataType, string> = {
    mailing_address: 'Returned mailing addresses',
    phone: 'Bad phone numbers',
    email: 'Bounced emails',
  };

  const reset = () => {
    setStep(1);
    setDataType(defaultType);
    setReason(defaultReason);
    setSourceLabel(defaultSourceLabel);
    setRawText('');
    setFileName(null);
    setPreview([]);
  };

  const handleClose = () => {
    if (flagMutation.isPending || batchMutation.isPending) return;
    reset();
    onClose();
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    setRawText(text);
    setFileName(file.name);
  };

  const parseValues = (): string[] => {
    const values: string[] = [];
    const lines = rawText.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // For CSV-style, take the first non-empty field (or join address fields)
      if (dataType === 'mailing_address') {
        // Strip surrounding quotes from CSV cells but keep commas (full address is fine here)
        const cleaned = trimmed.replace(/^"|"$/g, '');
        values.push(cleaned);
      } else {
        // For phone/email: split on common separators
        const parts = trimmed.split(/[,;\t]/).map(p => p.trim().replace(/^"|"$/g, '')).filter(Boolean);
        for (const p of parts) values.push(p);
      }
    }
    return values;
  };

  const runMatching = async () => {
    if (!company?.id) return;
    setMatching(true);
    try {
      const values = parseValues();
      if (values.length === 0) {
        toast.error('No values to match');
        return;
      }

      // Pull all owners once for matching
      let owners: any[] = [];
      let offset = 0;
      const batchSize = 1000;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from('owners')
          .select('id, property_id, mailing_address, mailing_city, mailing_state, phones, emails')
          .eq('company_id', company.id)
          .range(offset, offset + batchSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        owners = owners.concat(data);
        if (data.length < batchSize) break;
        offset += batchSize;
      }

      // Build indexes
      const addrIndex = new Map<string, { ownerId: string; propertyId: string; source: string | null }>();
      const phoneIndex = new Map<string, { ownerId: string; propertyId: string; source: string | null }>();
      const emailIndex = new Map<string, { ownerId: string; propertyId: string; source: string | null }>();
      for (const o of owners) {
        if (o.mailing_address) {
          const norm = normalizeAddressForMatch(o.mailing_address, o.mailing_city || '', o.mailing_state || '');
          if (norm && !addrIndex.has(norm)) addrIndex.set(norm, { ownerId: o.id, propertyId: o.property_id, source: null });
        }
        for (const p of (o.phones || []) as any[]) {
          const norm = normalizePhoneForMatch(p.number || '');
          if (norm && !phoneIndex.has(norm)) phoneIndex.set(norm, { ownerId: o.id, propertyId: o.property_id, source: p.source || null });
        }
        for (const e of (o.emails || []) as any[]) {
          const norm = (e.address || '').toLowerCase().trim();
          if (norm && !emailIndex.has(norm)) emailIndex.set(norm, { ownerId: o.id, propertyId: o.property_id, source: e.source || null });
        }
      }

      const index = dataType === 'mailing_address' ? addrIndex : dataType === 'phone' ? phoneIndex : emailIndex;

      const results: MatchPreview[] = values.map(v => {
        const norm = normalizeValue(dataType, v);
        const hit = index.get(norm);
        return {
          value: v,
          normalized: norm,
          ownerId: hit?.ownerId ?? null,
          propertyId: hit?.propertyId ?? null,
          source: hit?.source ?? null,
          matched: !!hit,
        };
      });
      setPreview(results);
      setStep(3);
    } catch (err: any) {
      toast.error(`Matching failed: ${err.message}`);
    } finally {
      setMatching(false);
    }
  };

  const matchedCount = preview.filter(p => p.matched).length;
  const unmatchedCount = preview.length - matchedCount;

  const handleConfirm = async () => {
    if (preview.length === 0) return;
    try {
      const batch = await batchMutation.mutateAsync({
        data_type: dataType,
        source_label: sourceLabel || `${typeLabels[dataType]} upload`,
        uploaded_file_name: fileName,
        mailing_list_id: mailingListId,
        total_rows: preview.length,
        matched_count: matchedCount,
        unmatched_count: unmatchedCount,
      });

      // Flag all rows (matched + unmatched). Unmatched still get stored for future imports.
      await flagMutation.mutateAsync(
        preview.map(p => ({
          data_type: dataType,
          value: p.value,
          owner_id: p.ownerId,
          property_id: p.propertyId,
          source: p.source,
          reason,
          batch_id: batch.id,
          mailing_list_id: mailingListId,
        }))
      );

      toast.success(`Flagged ${preview.length} ${dataType === 'mailing_address' ? 'addresses' : dataType === 'phone' ? 'phones' : 'emails'} as ${reasonLabels[reason]}`);
      handleClose();
    } catch (err: any) {
      toast.error(`Failed to flag: ${err.message}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Flag bad contact data — Step {step} of 3</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>What type of data are you flagging?</Label>
              <Select value={dataType} onValueChange={(v) => { setDataType(v as BadDataType); setReason(reasonsForType[v as BadDataType][0]); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mailing_address">Returned mailing addresses (RTS)</SelectItem>
                  <SelectItem value="phone">Bad phone numbers</SelectItem>
                  <SelectItem value="email">Bounced emails</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as BadDataReason)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {reasonsForType[dataType].map(r => (
                    <SelectItem key={r} value={r}>{reasonLabels[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Source label (paper trail)</Label>
              <Input
                value={sourceLabel}
                onChange={(e) => setSourceLabel(e.target.value)}
                placeholder='e.g. "March 2026 postcard mailer return file"'
              />
              <p className="text-xs text-muted-foreground">
                A descriptive label so you can audit later where this list came from.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={() => setStep(2)}>Next: Upload</Button>
            </DialogFooter>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Upload CSV or paste values (one per line)</Label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".csv,.txt"
                  id="bad-data-file"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <Button variant="outline" asChild>
                  <label htmlFor="bad-data-file" className="cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" />
                    Choose file
                  </label>
                </Button>
                {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
              </div>
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={dataType === 'mailing_address' ? '123 Main St, Cocoa Beach, FL 32931\n456 Ocean Dr, Cape Canaveral, FL 32920' : dataType === 'phone' ? '321-555-1234\n407-555-9876' : 'jane@example.com\nbob@example.com'}
                rows={10}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">{rawText.split(/\r?\n/).filter(l => l.trim()).length} lines</p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={runMatching} disabled={matching || !rawText.trim()}>
                {matching && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Match & preview
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {matchedCount} matched
              </Badge>
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                <AlertCircle className="w-3 h-3 mr-1" />
                {unmatchedCount} unmatched (will still be stored)
              </Badge>
            </div>

            <div className="border border-border rounded-lg max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium">Value</th>
                    <th className="text-left p-2 font-medium">Match</th>
                    <th className="text-left p-2 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 200).map((p, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-2 font-mono text-xs">{p.value}</td>
                      <td className="p-2">
                        {p.matched ? (
                          <span className="text-emerald-700 text-xs">Matched</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">No match</span>
                        )}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">{p.source || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 200 && (
                <p className="text-xs text-muted-foreground p-2 text-center">…and {preview.length - 200} more</p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(2)} disabled={flagMutation.isPending}>Back</Button>
              <Button onClick={handleConfirm} disabled={flagMutation.isPending || batchMutation.isPending}>
                {(flagMutation.isPending || batchMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Flag {preview.length} {dataType === 'mailing_address' ? 'addresses' : dataType === 'phone' ? 'phones' : 'emails'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};