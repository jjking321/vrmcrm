import React, { useState, useMemo } from 'react';
import { Property } from '@/types';
import { X, ChevronRight, ChevronLeft, Plus, ArrowRight, Check, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DuplicateMatch {
  importRow: Record<string, any>;
  existingProperty: Property;
  normalizedAddress: string;
}

export interface DuplicateDecision {
  mergeMode: 'stack' | 'replace';
  // Track which specific fields to take from import vs existing
  fieldOverrides?: Record<string, 'existing' | 'import'>;
}

interface DuplicateMergeReviewProps {
  isOpen: boolean;
  onClose: () => void;
  duplicates: DuplicateMatch[];
  nonDuplicatesCount: number;
  onConfirm: (decisions: Map<string, DuplicateDecision>) => void;
  globalContactMergeMode: 'stack' | 'override';
}

// Field definitions for comparison
const COMPARE_FIELDS = [
  { key: 'ownerName', label: 'Owner Name', importKeys: ['ownerName', 'owner1FirstName', 'owner1LastName'] },
  { key: 'bedrooms', label: 'Bedrooms', importKeys: ['bedrooms'] },
  { key: 'bathrooms', label: 'Bathrooms', importKeys: ['bathrooms'] },
  { key: 'listingTitle', label: 'Listing Title', importKeys: ['listingTitle'] },
  { key: 'propertyManager', label: 'Property Manager', importKeys: ['propertyManager'] },
  { key: 'host', label: 'Host', importKeys: ['host'] },
  { key: 'propertyType', label: 'Property Type', importKeys: ['propertyType', 'roomType'] },
  { key: 'mailingAddress', label: 'Mailing Address', importKeys: ['mailingAddress'] },
  { key: 'ownershipLength', label: 'Ownership Length', importKeys: ['ownershipLength'] },
  { key: 'ownerType', label: 'Owner Type', importKeys: ['ownerType'] },
];

function getExistingValue(prop: Property, key: string): string {
  switch (key) {
    case 'ownerName':
      return prop.owner?.name || '';
    case 'bedrooms':
      return prop.bedrooms?.toString() || '';
    case 'bathrooms':
      return prop.bathrooms?.toString() || '';
    case 'listingTitle':
      return prop.listingTitle || '';
    case 'propertyManager':
      return prop.propertyManager || '';
    case 'host':
      return prop.host || '';
    case 'propertyType':
      return prop.propertyType || '';
    case 'mailingAddress':
      return prop.owner?.mailingAddress || '';
    case 'ownershipLength':
      return prop.owner?.ownershipLengthMonths?.toString() || '';
    case 'ownerType':
      return prop.owner?.ownerType || '';
    default:
      return '';
  }
}

function getImportValue(row: Record<string, any>, importKeys: string[]): string {
  // Handle owner name specially - combine first/last if available
  if (importKeys.includes('owner1FirstName')) {
    const first = row['owner1FirstName'] || '';
    const last = row['owner1LastName'] || '';
    if (first || last) return `${first} ${last}`.trim();
    return row['ownerName'] || '';
  }
  
  for (const k of importKeys) {
    if (row[k]) return row[k];
  }
  return '';
}

// Extract phones from import row
function getImportPhones(row: Record<string, any>): { number: string; type?: string; dnc?: boolean }[] {
  const phones: { number: string; type?: string; dnc?: boolean }[] = [];
  
  for (let i = 1; i <= 3; i++) {
    const phone = row[`phone${i}`] || (i === 1 ? row['phone'] : null);
    if (phone) {
      phones.push({
        number: phone,
        type: row[`phone${i}Type`],
        dnc: row[`phone${i}DNC`] === 'true' || row[`phone${i}DNC`] === true,
      });
    }
  }
  
  // Legacy single phone
  if (phones.length === 0 && row['ownerPhone']) {
    phones.push({ number: row['ownerPhone'] });
  }
  
  return phones;
}

// Extract emails from import row
function getImportEmails(row: Record<string, any>): string[] {
  const emails: string[] = [];
  
  for (let i = 1; i <= 4; i++) {
    const email = row[`email${i}`] || (i === 1 ? row['email'] : null);
    if (email) emails.push(email);
  }
  
  // Legacy single email
  if (emails.length === 0 && row['ownerEmail']) {
    emails.push(row['ownerEmail']);
  }
  
  return emails;
}

// Get existing phones from property
function getExistingPhones(prop: Property): string[] {
  const phones: string[] = [];
  if (prop.owner?.phone) phones.push(prop.owner.phone);
  if (prop.owner?.phones) {
    prop.owner.phones.forEach((p: any) => {
      if (p.number && !phones.includes(p.number)) phones.push(p.number);
    });
  }
  return phones;
}

// Get existing emails from property
function getExistingEmails(prop: Property): string[] {
  const emails: string[] = [];
  if (prop.owner?.email) emails.push(prop.owner.email);
  if (prop.owner?.emails) {
    prop.owner.emails.forEach((e: any) => {
      if (e.address && !emails.includes(e.address)) emails.push(e.address);
    });
  }
  return emails;
}

export const DuplicateMergeReview: React.FC<DuplicateMergeReviewProps> = ({
  isOpen,
  onClose,
  duplicates,
  nonDuplicatesCount,
  onConfirm,
  globalContactMergeMode,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [decisions, setDecisions] = useState<Map<string, DuplicateDecision>>(() => {
    // Initialize all duplicates with default stack mode
    const initial = new Map<string, DuplicateDecision>();
    duplicates.forEach(d => {
      initial.set(d.normalizedAddress, { mergeMode: globalContactMergeMode === 'override' ? 'replace' : 'stack' });
    });
    return initial;
  });

  const currentDuplicate = duplicates[currentIndex];
  const currentDecision = decisions.get(currentDuplicate?.normalizedAddress);

  const handleMergeModeChange = (mode: 'stack' | 'replace') => {
    const newDecisions = new Map(decisions);
    newDecisions.set(currentDuplicate.normalizedAddress, {
      ...currentDecision,
      mergeMode: mode,
    });
    setDecisions(newDecisions);
  };

  const handleApplyToAll = () => {
    const newDecisions = new Map<string, DuplicateDecision>();
    const currentMode = currentDecision?.mergeMode || 'stack';
    duplicates.forEach(d => {
      newDecisions.set(d.normalizedAddress, { mergeMode: currentMode });
    });
    setDecisions(newDecisions);
  };

  const handleConfirm = () => {
    onConfirm(decisions);
  };

  // Calculate what will change for current duplicate
  const fieldComparison = useMemo(() => {
    if (!currentDuplicate) return [];
    
    return COMPARE_FIELDS.map(field => {
      const existing = getExistingValue(currentDuplicate.existingProperty, field.key);
      const imported = getImportValue(currentDuplicate.importRow, field.importKeys);
      
      let status: 'same' | 'update' | 'add' | 'empty' = 'empty';
      let result = existing;
      
      if (existing && imported && existing !== imported) {
        status = 'update';
        result = imported; // Import wins for non-contact fields
      } else if (!existing && imported) {
        status = 'add';
        result = imported;
      } else if (existing === imported && existing) {
        status = 'same';
      }
      
      return { ...field, existing, imported, status, result };
    }).filter(f => f.existing || f.imported); // Only show fields with data
  }, [currentDuplicate]);

  // Contact stacking preview
  const contactPreview = useMemo(() => {
    if (!currentDuplicate) return { phones: { existing: [], new: [] }, emails: { existing: [], new: [] } };
    
    const existingPhones = getExistingPhones(currentDuplicate.existingProperty);
    const importPhones = getImportPhones(currentDuplicate.importRow);
    const newPhones = importPhones.filter(p => !existingPhones.includes(p.number));
    
    const existingEmails = getExistingEmails(currentDuplicate.existingProperty);
    const importEmails = getImportEmails(currentDuplicate.importRow);
    const newEmails = importEmails.filter(e => !existingEmails.includes(e));
    
    return {
      phones: { existing: existingPhones, new: newPhones },
      emails: { existing: existingEmails, new: newEmails },
    };
  }, [currentDuplicate]);

  if (!isOpen || duplicates.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div>
            <h2 className="text-lg font-bold text-foreground">Review Matching Properties</h2>
            <p className="text-xs text-muted-foreground">
              {duplicates.length} properties match existing records • {nonDuplicatesCount} new will be added
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <div className="px-6 py-3 border-b border-border flex items-center justify-between bg-muted/10">
          <button
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded-lg hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              {currentDuplicate?.existingProperty.address}, {currentDuplicate?.existingProperty.city}
            </p>
            <p className="text-xs text-muted-foreground">
              Property {currentIndex + 1} of {duplicates.length}
            </p>
          </div>
          <button
            onClick={() => setCurrentIndex(Math.min(duplicates.length - 1, currentIndex + 1))}
            disabled={currentIndex === duplicates.length - 1}
            className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded-lg hover:bg-muted transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Field Comparison Table */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Field Changes</h3>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Field</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Existing</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Import</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {fieldComparison.map(field => (
                    <tr key={field.key} className={cn(
                      field.status === 'update' && "bg-amber-50/50",
                      field.status === 'add' && "bg-emerald-50/50"
                    )}>
                      <td className="px-4 py-2 font-medium text-foreground">{field.label}</td>
                      <td className="px-4 py-2 text-muted-foreground">{field.existing || '—'}</td>
                      <td className="px-4 py-2">
                        {field.imported ? (
                          <span className={cn(
                            field.status === 'update' && "text-amber-700 font-medium",
                            field.status === 'add' && "text-emerald-700 font-medium"
                          )}>
                            {field.imported}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          {field.status === 'same' && (
                            <span className="text-muted-foreground">{field.result}</span>
                          )}
                          {field.status === 'update' && (
                            <>
                              <span className="text-amber-700 font-medium">{field.result}</span>
                              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Update</span>
                            </>
                          )}
                          {field.status === 'add' && (
                            <>
                              <span className="text-emerald-700 font-medium">{field.result}</span>
                              <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Add</span>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {fieldComparison.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-center text-muted-foreground">
                        No field changes detected
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Contact Stacking Preview */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Contact Information</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleMergeModeChange('stack')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5",
                    currentDecision?.mergeMode === 'stack'
                      ? "bg-brand text-brand-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Stack Contacts
                </button>
                <button
                  onClick={() => handleMergeModeChange('replace')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5",
                    currentDecision?.mergeMode === 'replace'
                      ? "bg-brand text-brand-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Replace Contacts
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Phones */}
              <div className="border border-border rounded-lg p-4">
                <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Phone Numbers</h4>
                <div className="space-y-1.5">
                  {contactPreview.phones.existing.map((phone, i) => (
                    <div key={i} className="text-sm text-foreground flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-muted-foreground" />
                      {phone}
                    </div>
                  ))}
                  {currentDecision?.mergeMode === 'stack' && contactPreview.phones.new.map((phone, i) => (
                    <div key={`new-${i}`} className="text-sm text-emerald-700 flex items-center gap-2">
                      <Plus className="w-3.5 h-3.5" />
                      {phone.number}
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">New</span>
                    </div>
                  ))}
                  {currentDecision?.mergeMode === 'replace' && contactPreview.phones.new.length > 0 && (
                    <div className="text-xs text-amber-600 mt-2 p-2 bg-amber-50 rounded">
                      Will replace with {contactPreview.phones.new.length} phone(s) from import
                    </div>
                  )}
                  {contactPreview.phones.existing.length === 0 && contactPreview.phones.new.length === 0 && (
                    <p className="text-sm text-muted-foreground">No phones</p>
                  )}
                </div>
              </div>

              {/* Emails */}
              <div className="border border-border rounded-lg p-4">
                <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Email Addresses</h4>
                <div className="space-y-1.5">
                  {contactPreview.emails.existing.map((email, i) => (
                    <div key={i} className="text-sm text-foreground flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-muted-foreground" />
                      {email}
                    </div>
                  ))}
                  {currentDecision?.mergeMode === 'stack' && contactPreview.emails.new.map((email, i) => (
                    <div key={`new-${i}`} className="text-sm text-emerald-700 flex items-center gap-2">
                      <Plus className="w-3.5 h-3.5" />
                      {email}
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">New</span>
                    </div>
                  ))}
                  {currentDecision?.mergeMode === 'replace' && contactPreview.emails.new.length > 0 && (
                    <div className="text-xs text-amber-600 mt-2 p-2 bg-amber-50 rounded">
                      Will replace with {contactPreview.emails.new.length} email(s) from import
                    </div>
                  )}
                  {contactPreview.emails.existing.length === 0 && contactPreview.emails.new.length === 0 && (
                    <p className="text-sm text-muted-foreground">No emails</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-muted/30">
          <button
            onClick={handleApplyToAll}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Apply "{currentDecision?.mergeMode === 'stack' ? 'Stack' : 'Replace'}" to all remaining
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 bg-brand text-brand-foreground rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors"
            >
              Confirm Import ({duplicates.length} updates + {nonDuplicatesCount} new)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
