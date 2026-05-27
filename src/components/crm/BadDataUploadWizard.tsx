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
  matchedBy?: 'contact_id' | 'property_name' | 'address' | 'phone' | 'email' | null;
}

interface ParsedRecord {
  /** The value being flagged (mailing address, phone, or email). */
  value: string;
  /** Optional ContactID hint (e.g. Postalytics VarField2 = owners.id). */
  contactId?: string | null;
  /** Optional property address hint (e.g. Postalytics VarField1). */
  propertyAddress?: string | null;
  /** Optional owner / company name hint (e.g. Postalytics Company column). */
  ownerName?: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Minimal CSV row splitter that respects double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
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

  const parseRecords = (): ParsedRecord[] => {
    const lines = rawText.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return [];

    // Detect a CSV with a header row by checking for a comma + known header tokens.
    const headerLine = lines[0];
    const looksLikeCsv = headerLine.includes(',') && /[A-Za-z]/.test(headerLine);
    if (looksLikeCsv) {
      const headers = splitCsvLine(headerLine).map(h => h.toLowerCase());
      const idx = (name: string) => headers.findIndex(h => h === name.toLowerCase());

      // Postalytics return-file shape detection
      const isPostalytics =
        idx('directmailevent') >= 0 &&
        idx('varfield1') >= 0 &&
        idx('varfield2') >= 0;

      // Generic CSV with at least an address column
      const hasAddressCols = idx('address') >= 0;

      if (isPostalytics || hasAddressCols) {
        const cAddr = idx('address');
        const cCity = idx('city');
        const cState = idx('state');
        const cZip = idx('zip');
        const cEmail = idx('emailid') >= 0 ? idx('emailid') : idx('email');
        const cPhone = idx('phone');
        const cMobile = idx('mobile');
        const cCompany = idx('company');
        const cFirst = idx('firstname');
        const cLast = idx('lastname');
        const cVar1 = idx('varfield1'); // property address
        const cVar2 = idx('varfield2'); // contact id (owners.id)
        const cEvent = idx('directmailevent');

        const recs: ParsedRecord[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = splitCsvLine(lines[i]);
          if (cols.length === 0) continue;

          // For Postalytics: only include rows that actually bounced
          if (cEvent >= 0 && reason === 'returned_to_sender') {
            const ev = (cols[cEvent] || '').toLowerCase();
            if (ev && !ev.includes('return')) continue;
          }

          const contactIdRaw = cVar2 >= 0 ? (cols[cVar2] || '').trim() : '';
          const contactId = UUID_RE.test(contactIdRaw) ? contactIdRaw : null;
          const propertyAddress = cVar1 >= 0 ? (cols[cVar1] || '').trim() || null : null;
          const ownerName =
            (cCompany >= 0 ? (cols[cCompany] || '').trim() : '') ||
            [cFirst >= 0 ? cols[cFirst] : '', cLast >= 0 ? cols[cLast] : ''].filter(Boolean).join(' ').trim() ||
            null;

          let value = '';
          if (dataType === 'mailing_address') {
            const parts = [
              cAddr >= 0 ? cols[cAddr] : '',
              cCity >= 0 ? cols[cCity] : '',
              cState >= 0 ? cols[cState] : '',
              cZip >= 0 ? cols[cZip] : '',
            ].map(s => (s || '').trim()).filter(Boolean);
            value = parts.join(', ');
          } else if (dataType === 'phone') {
            value = (cPhone >= 0 ? cols[cPhone] : '') || (cMobile >= 0 ? cols[cMobile] : '') || '';
          } else if (dataType === 'email') {
            value = cEmail >= 0 ? cols[cEmail] || '' : '';
          }
          value = value.trim();
          if (!value) continue;

          recs.push({ value, contactId, propertyAddress, ownerName });
        }
        return recs;
      }
    }

    // Fallback: treat each line as a raw value (legacy paste behavior)
    const recs: ParsedRecord[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (dataType === 'mailing_address') {
        recs.push({ value: trimmed.replace(/^"|"$/g, '') });
      } else {
        for (const p of trimmed.split(/[,;\t]/).map(s => s.trim().replace(/^"|"$/g, '')).filter(Boolean)) {
          recs.push({ value: p });
        }
      }
    }
    return recs;
  };

  const runMatching = async () => {
    if (!company?.id) return;
    setMatching(true);
    try {
      const records = parseRecords();
      if (records.length === 0) {
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
          .select('id, property_id, name, mailing_address, mailing_city, mailing_state, phones, emails')
          .eq('company_id', company.id)
          .range(offset, offset + batchSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        owners = owners.concat(data);
        if (data.length < batchSize) break;
        offset += batchSize;
      }

      // Pull properties for property-address fallback matching
      let properties: any[] = [];
      if (dataType === 'mailing_address') {
        offset = 0;
        while (true) {
          const { data, error } = await supabase
            .from('properties')
            .select('id, address, city, state, zip')
            .eq('company_id', company.id)
            .range(offset, offset + batchSize - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          properties = properties.concat(data);
          if (data.length < batchSize) break;
          offset += batchSize;
        }
      }

      // Build indexes
      const ownerById = new Map<string, any>();
      for (const o of owners) ownerById.set(o.id, o);

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

      // property address index → list of owners on that property
      const ownersByPropertyId = new Map<string, any[]>();
      for (const o of owners) {
        if (!o.property_id) continue;
        const arr = ownersByPropertyId.get(o.property_id) || [];
        arr.push(o);
        ownersByPropertyId.set(o.property_id, arr);
      }
      const propByAddr = new Map<string, string>(); // normalized address → property_id
      for (const p of properties) {
        const norm = normalizeAddressForMatch(p.address || '', p.city || '', p.state || '');
        if (norm && !propByAddr.has(norm)) propByAddr.set(norm, p.id);
      }

      const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();

      const results: MatchPreview[] = records.map(rec => {
        const normalized = normalizeValue(dataType, rec.value);
        let ownerId: string | null = null;
        let propertyId: string | null = null;
        let source: string | null = null;
        let matchedBy: MatchPreview['matchedBy'] = null;

        // 1. ContactID (owners.id) direct match — strongest
        if (rec.contactId && ownerById.has(rec.contactId)) {
          const o = ownerById.get(rec.contactId);
          ownerId = o.id;
          propertyId = o.property_id;
          matchedBy = 'contact_id';
        }

        // 2. Fallback for mailing_address: property address (+ optional name)
        if (!ownerId && dataType === 'mailing_address' && rec.propertyAddress) {
          const pNorm = normalizeAddressForMatch(rec.propertyAddress, '', '');
          const pid = propByAddr.get(pNorm);
          if (pid) {
            propertyId = pid;
            const candidates = ownersByPropertyId.get(pid) || [];
            if (candidates.length === 1) {
              ownerId = candidates[0].id;
              matchedBy = 'property_name';
            } else if (rec.ownerName && candidates.length > 1) {
              const targetN = norm(rec.ownerName);
              const hit = candidates.find(o => {
                const oN = norm(o.name || '');
                return oN && (oN === targetN || oN.includes(targetN) || targetN.includes(oN));
              });
              if (hit) {
                ownerId = hit.id;
                matchedBy = 'property_name';
              }
            }
          }
        }

        // 3. Final fallback: existing normalized-value index match
        if (!ownerId) {
          const idx = dataType === 'mailing_address' ? addrIndex : dataType === 'phone' ? phoneIndex : emailIndex;
          const hit = idx.get(normalized);
          if (hit) {
            ownerId = hit.ownerId;
            propertyId = propertyId || hit.propertyId;
            source = hit.source;
            matchedBy = dataType === 'mailing_address' ? 'address' : dataType === 'phone' ? 'phone' : 'email';
          }
        }

        return {
          value: rec.value,
          normalized,
          ownerId,
          propertyId,
          source,
          matched: !!ownerId,
          matchedBy,
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
                    <th className="text-left p-2 font-medium">Matched by</th>
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
                      <td className="p-2 text-xs text-muted-foreground">
                        {p.matchedBy === 'contact_id' ? 'Contact ID'
                          : p.matchedBy === 'property_name' ? 'Property + name'
                          : p.matchedBy === 'address' ? 'Mailing address'
                          : p.matchedBy === 'phone' ? 'Phone'
                          : p.matchedBy === 'email' ? 'Email'
                          : '—'}
                      </td>
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