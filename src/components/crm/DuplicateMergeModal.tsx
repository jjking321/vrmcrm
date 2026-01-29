import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DuplicateProperty, DuplicateGroup, useMergeDuplicates } from '@/hooks/useDuplicateDetection';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Check, Calendar, Phone, Mail, Users, PhoneOff, ChevronDown, CheckCircle2, AlertCircle, CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import { PhoneContact, EmailContact, OwnerContact, PhoneStatus, EmailStatus } from '@/types';
import { SourceBadge } from './SourceBadge';

interface DuplicateMergeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: DuplicateGroup | null;
  onMergeComplete: () => void;
}

interface MergeField {
  key: string;
  label: string;
  getValue: (prop: DuplicateProperty) => any;
  display: (value: any) => string;
  isOwnerField?: boolean;
  isArrayField?: boolean;
}

const MERGE_FIELDS: MergeField[] = [
  { key: 'bedrooms', label: 'Bedrooms', getValue: p => p.bedrooms, display: v => v?.toString() || '-' },
  { key: 'bathrooms', label: 'Bathrooms', getValue: p => p.bathrooms, display: v => v?.toString() || '-' },
  { key: 'guests', label: 'Guests', getValue: p => p.guests, display: v => v?.toString() || '-' },
  { key: 'squareFeet', label: 'Sq Ft', getValue: p => p.squareFeet, display: v => v?.toLocaleString() || '-' },
  { key: 'yearBuilt', label: 'Year Built', getValue: p => p.yearBuilt, display: v => v?.toString() || '-' },
  { key: 'propertyType', label: 'Property Type', getValue: p => p.propertyType, display: v => v || '-' },
  { key: 'airbnbUrl', label: 'Airbnb URL', getValue: p => p.airbnbUrl, display: v => v ? 'Set' : '-' },
  { key: 'zillowUrl', label: 'Zillow URL', getValue: p => p.zillowUrl, display: v => v ? 'Set' : '-' },
  { key: 'propertyUrl', label: 'Property URL', getValue: p => p.propertyUrl, display: v => v ? 'Set' : '-' },
  { key: 'bookingLink', label: 'Booking Link', getValue: p => p.bookingLink, display: v => v ? 'Set' : '-' },
  { key: 'adr', label: 'ADR', getValue: p => p.marketData?.adr, display: v => v ? `$${v}` : '-' },
  { key: 'projectedRevenue', label: 'Revenue', getValue: p => p.marketData?.projectedRevenue, display: v => v ? `$${v.toLocaleString()}` : '-' },
  { key: 'propertyValue', label: 'Property Value', getValue: p => p.marketData?.propertyValue, display: v => v ? `$${v.toLocaleString()}` : '-' },
  { key: 'latitude', label: 'Coordinates', getValue: p => p.latitude && p.longitude ? { lat: p.latitude, lng: p.longitude } : null, display: v => v ? 'Set' : '-' },
  // Owner fields
  { key: 'ownerName', label: 'Owner Name', getValue: p => p.owner?.name, display: v => v || '-', isOwnerField: true },
  { key: 'mailingAddress', label: 'Mailing Address', getValue: p => p.owner?.mailingAddress, display: v => v || '-', isOwnerField: true },
  // Array fields - displayed separately
  { key: 'phones', label: 'Phone Numbers', getValue: p => p.owner?.phones || [], display: v => v?.length > 0 ? `${v.length} phone(s)` : '-', isOwnerField: true, isArrayField: true },
  { key: 'emails', label: 'Email Addresses', getValue: p => p.owner?.emails || [], display: v => v?.length > 0 ? `${v.length} email(s)` : '-', isOwnerField: true, isArrayField: true },
  { key: 'ownerContacts', label: 'Owner Contacts', getValue: p => p.owner?.owners || [], display: v => v?.length > 0 ? `${v.length} owner(s)` : '-', isOwnerField: true, isArrayField: true },
];

// Helper to get phone status icon
const PhoneStatusIcon: React.FC<{ status?: PhoneStatus }> = ({ status }) => {
  switch (status) {
    case 'verified':
      return <CheckCircle className="w-3 h-3 text-emerald-500" />;
    case 'wrong_number':
    case 'disconnected':
      return <XCircle className="w-3 h-3 text-red-500" />;
    case 'no_answer':
      return <HelpCircle className="w-3 h-3 text-amber-500" />;
    default:
      return <HelpCircle className="w-3 h-3 text-muted-foreground/50" />;
  }
};

// Helper to get email status icon
const EmailStatusIcon: React.FC<{ status?: EmailStatus }> = ({ status }) => {
  switch (status) {
    case 'verified':
      return <CheckCircle className="w-3 h-3 text-emerald-500" />;
    case 'bounced':
      return <XCircle className="w-3 h-3 text-red-500" />;
    case 'unsubscribed':
      return <XCircle className="w-3 h-3 text-amber-500" />;
    default:
      return <HelpCircle className="w-3 h-3 text-muted-foreground/50" />;
  }
};

// Helper to render phone list with source badges
const PhoneList: React.FC<{ phones: PhoneContact[] }> = ({ phones }) => {
  if (!phones || phones.length === 0) return <span className="text-muted-foreground/50">-</span>;
  return (
    <div className="space-y-1.5">
      {phones.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5 text-xs">
          {p.doNotCall ? (
            <PhoneOff className="w-3 h-3 text-amber-500" />
          ) : (
            <PhoneStatusIcon status={p.status} />
          )}
          <span className={cn(p.doNotCall && "text-amber-600", p.status === 'wrong_number' && "line-through text-muted-foreground")}>{p.number}</span>
          {p.type && p.type !== 'unknown' && <Badge variant="outline" className="text-[10px] px-1 py-0">{p.type}</Badge>}
          <SourceBadge source={p.source} />
        </div>
      ))}
    </div>
  );
};

// Helper to render email list with source badges
const EmailList: React.FC<{ emails: EmailContact[] }> = ({ emails }) => {
  if (!emails || emails.length === 0) return <span className="text-muted-foreground/50">-</span>;
  return (
    <div className="space-y-1.5">
      {emails.map((e, i) => (
        <div key={i} className="flex items-center gap-1.5 text-xs">
          <EmailStatusIcon status={e.status} />
          <span className={cn("truncate max-w-[120px]", e.status === 'bounced' && "line-through text-muted-foreground")}>{e.address}</span>
          <SourceBadge source={e.source} />
        </div>
      ))}
    </div>
  );
};

// Helper to render owner contacts list with source badges
const OwnerContactsList: React.FC<{ owners: OwnerContact[] }> = ({ owners }) => {
  if (!owners || owners.length === 0) return <span className="text-muted-foreground/50">-</span>;
  return (
    <div className="space-y-1.5">
      {owners.map((o, i) => (
        <div key={i} className="flex items-center gap-1.5 text-xs">
          <Users className="w-3 h-3 text-muted-foreground" />
          <span className="truncate max-w-[100px]">
            {o.firstName} {o.lastName}
          </span>
          <SourceBadge source={o.source} />
        </div>
      ))}
    </div>
  );
};
export const DuplicateMergeModal: React.FC<DuplicateMergeModalProps> = ({
  open,
  onOpenChange,
  group,
  onMergeComplete,
}) => {
  const [primaryId, setPrimaryId] = useState<string>('');
  const [fieldSelections, setFieldSelections] = useState<Record<string, string>>({});
  const [contactMergeMode, setContactMergeMode] = useState<'stack' | 'override'>('stack');
  const [autoResolvedExpanded, setAutoResolvedExpanded] = useState(false);
  const mergeMutation = useMergeDuplicates();

  const properties = group?.properties || [];

  // Categorize fields into autoResolved, conflicting, and empty
  const fieldCategories = useMemo(() => {
    if (!group) return { autoResolved: [] as Array<{ field: typeof MERGE_FIELDS[0]; selectedPropId: string; value: any; displayValue: string }>, conflicting: [] as typeof MERGE_FIELDS, empty: [] as typeof MERGE_FIELDS };
    
    const autoResolved: Array<{ field: typeof MERGE_FIELDS[0]; selectedPropId: string; value: any; displayValue: string }> = [];
    const conflicting: typeof MERGE_FIELDS = [];
    const empty: typeof MERGE_FIELDS = [];
    
    MERGE_FIELDS.filter(f => !f.isArrayField).forEach(field => {
      const propValues = group.properties.map(p => ({
        id: p.id,
        value: field.getValue(p),
        displayValue: field.display(field.getValue(p)),
        isEmpty: !field.getValue(p) || field.display(field.getValue(p)) === '-'
      }));
      
      const nonEmptyProps = propValues.filter(pv => !pv.isEmpty);
      
      if (nonEmptyProps.length === 0) {
        // All empty - skip display
        empty.push(field);
      } else if (nonEmptyProps.length === 1) {
        // Only one has data - auto-select it
        autoResolved.push({ 
          field, 
          selectedPropId: nonEmptyProps[0].id, 
          value: nonEmptyProps[0].value,
          displayValue: nonEmptyProps[0].displayValue
        });
      } else {
        // Multiple have data - check if same or different
        const uniqueValues = new Set(nonEmptyProps.map(pv => JSON.stringify(pv.value)));
        if (uniqueValues.size === 1) {
          // All same value - auto-select first non-empty
          autoResolved.push({ 
            field, 
            selectedPropId: nonEmptyProps[0].id, 
            value: nonEmptyProps[0].value,
            displayValue: nonEmptyProps[0].displayValue
          });
        } else {
          // Different values - needs user selection
          conflicting.push(field);
        }
      }
    });
    
    return { autoResolved, conflicting, empty };
  }, [group]);

  // Reset state when group changes
  React.useEffect(() => {
    if (group) {
      // Default to newest record (most up-to-date info) but still stack all contacts
      const newest = [...group.properties].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      setPrimaryId(newest.id);
      setContactMergeMode('stack');
      setAutoResolvedExpanded(false);
      
      // Initialize field selections with smart auto-resolution
      const selections: Record<string, string> = {};
      
      MERGE_FIELDS.filter(f => !f.isArrayField).forEach(field => {
        const propValues = group.properties.map(p => ({
          id: p.id,
          value: field.getValue(p),
          isEmpty: !field.getValue(p) || field.display(field.getValue(p)) === '-'
        }));
        
        const nonEmptyProps = propValues.filter(pv => !pv.isEmpty);
        
        if (nonEmptyProps.length === 1) {
          // Auto-select the one with data
          selections[field.key] = nonEmptyProps[0].id;
        } else if (nonEmptyProps.length > 1) {
          // Check if all same - if so, pick first; otherwise default to oldest
          const uniqueValues = new Set(nonEmptyProps.map(pv => JSON.stringify(pv.value)));
          if (uniqueValues.size === 1) {
            selections[field.key] = nonEmptyProps[0].id;
          } else {
            // True conflict - default to newest (most up-to-date)
            selections[field.key] = newest.id;
          }
        } else {
          // All empty, default to newest
          selections[field.key] = newest.id;
        }
      });
      
      setFieldSelections(selections);
    }
  }, [group]);

  // Calculate combined contact counts for preview
  const combinedCounts = useMemo(() => {
    if (!group) return { phones: 0, emails: 0, owners: 0 };
    
    const allPhones = new Set<string>();
    const allEmails = new Set<string>();
    const allOwners = new Set<string>();
    
    group.properties.forEach(p => {
      (p.owner?.phones || []).forEach((ph: PhoneContact) => {
        const normalized = ph.number.replace(/\D/g, '').slice(-10);
        if (normalized) allPhones.add(normalized);
      });
      (p.owner?.emails || []).forEach((em: EmailContact) => {
        if (em.address) allEmails.add(em.address.toLowerCase());
      });
      (p.owner?.owners || []).forEach((ow: OwnerContact) => {
        const key = `${ow.firstName || ''} ${ow.lastName || ''}`.trim().toLowerCase();
        if (key) allOwners.add(key);
      });
    });
    
    return {
      phones: allPhones.size,
      emails: allEmails.size,
      owners: allOwners.size,
    };
  }, [group]);

  const handleMerge = async () => {
    if (!group || !primaryId) return;

    const deleteIds = properties.filter(p => p.id !== primaryId).map(p => p.id);
    
    // Build merged data based on field selections
    const mergedData: Partial<DuplicateProperty> = {};
    const mergedOwnerData: Partial<DuplicateProperty['owner']> = {};

    MERGE_FIELDS.filter(f => !f.isArrayField).forEach(field => {
      const selectedPropId = fieldSelections[field.key];
      const selectedProp = properties.find(p => p.id === selectedPropId);
      if (selectedProp) {
        const value = field.getValue(selectedProp);
        if (field.isOwnerField) {
          if (field.key === 'ownerName') mergedOwnerData.name = value;
          if (field.key === 'mailingAddress') mergedOwnerData.mailingAddress = value;
        } else if (field.key === 'adr' || field.key === 'projectedRevenue' || field.key === 'propertyValue') {
          // Market data fields need to be merged into marketData object
          const primaryProp = properties.find(p => p.id === primaryId);
          mergedData.marketData = { 
            ...(primaryProp?.marketData || {}),
            [field.key]: value 
          };
        } else if (field.key === 'latitude') {
          if (value) {
            mergedData.latitude = value.lat;
            mergedData.longitude = value.lng;
          }
        } else {
          (mergedData as any)[field.key] = value;
        }
      }
    });

    // For override mode, set contact data from primary record
    if (contactMergeMode === 'override') {
      const primaryProp = properties.find(p => p.id === primaryId);
      if (primaryProp?.owner) {
        mergedOwnerData.phones = primaryProp.owner.phones;
        mergedOwnerData.emails = primaryProp.owner.emails;
        mergedOwnerData.owners = primaryProp.owner.owners;
      }
    }

    // Merge all tags
    const allTags = new Set<string>();
    properties.forEach(p => p.tags.forEach(t => allTags.add(t)));
    mergedData.tags = Array.from(allTags);

    await mergeMutation.mutateAsync({
      keepPropertyId: primaryId,
      deletePropertyIds: deleteIds,
      mergedData,
      mergedOwnerData,
      contactMergeMode,
      allProperties: properties,
    });

    onMergeComplete();
    onOpenChange(false);
  };

  if (!group) return null;

  const arrayFields = MERGE_FIELDS.filter(f => f.isArrayField);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Merge Duplicates: {group.displayAddress}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {/* Primary Record Selection */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Select primary record (will be kept):</Label>
            <RadioGroup value={primaryId} onValueChange={setPrimaryId} className="flex flex-wrap gap-3">
              {properties.map((prop, idx) => (
                <div key={prop.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={prop.id} id={prop.id} />
                  <Label htmlFor={prop.id} className="cursor-pointer flex items-center gap-2">
                    <span className="font-medium">Record {String.fromCharCode(65 + idx)}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(prop.createdAt), 'MMM d, yyyy')}
                    </span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Contact Merge Mode Selection */}
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <Label className="text-sm font-medium mb-2 block">
              How to handle phones, emails, and owner contacts?
            </Label>
            <RadioGroup 
              value={contactMergeMode} 
              onValueChange={(v) => setContactMergeMode(v as 'stack' | 'override')}
              className="space-y-2"
            >
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="stack" id="stack" className="mt-1" />
                <Label htmlFor="stack" className="cursor-pointer">
                  <span className="font-medium">Combine all contacts</span>
                  <span className="text-xs text-muted-foreground block">
                    Merge phones, emails, and owners from all records (recommended)
                  </span>
                </Label>
              </div>
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="override" id="override" className="mt-1" />
                <Label htmlFor="override" className="cursor-pointer">
                  <span className="font-medium">Use primary only</span>
                  <span className="text-xs text-muted-foreground block">
                    Keep only the primary record's contacts
                  </span>
                </Label>
              </div>
            </RadioGroup>
            {contactMergeMode === 'stack' && (
              <div className="mt-2 text-xs text-purple-700 dark:text-purple-300 flex items-center gap-2">
                <span>Combined result:</span>
                <Badge variant="secondary" className="text-xs">{combinedCounts.phones} phones</Badge>
                <Badge variant="secondary" className="text-xs">{combinedCounts.emails} emails</Badge>
                <Badge variant="secondary" className="text-xs">{combinedCounts.owners} owners</Badge>
              </div>
            )}
          </div>

          {/* Smart Resolution Summary */}
          <div className="flex items-center gap-4 text-sm">
            {fieldCategories.autoResolved.length > 0 && (
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>{fieldCategories.autoResolved.length} fields auto-resolved</span>
              </div>
            )}
            {fieldCategories.conflicting.length > 0 && (
              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-4 h-4" />
                <span>{fieldCategories.conflicting.length} field{fieldCategories.conflicting.length !== 1 ? 's' : ''} need{fieldCategories.conflicting.length === 1 ? 's' : ''} your selection</span>
              </div>
            )}
          </div>

          <ScrollArea className="h-[300px] border rounded-md">
            <div className="p-2 space-y-4">
              {/* Conflicts Section - Needs User Selection */}
              {fieldCategories.conflicting.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Select value for each field</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-amber-500/10 border-b border-amber-500/20">
                      <tr>
                        <th className="text-left p-2 font-medium w-32">Field</th>
                        {properties.map((prop, idx) => (
                          <th key={prop.id} className="text-left p-2 font-medium">
                            <div className="flex items-center gap-2">
                              Record {String.fromCharCode(65 + idx)}
                              {prop.id === primaryId && (
                                <Badge variant="secondary" className="text-xs">Primary</Badge>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fieldCategories.conflicting.map(field => (
                        <tr key={field.key} className="border-b border-amber-500/10 bg-amber-500/5">
                          <td className="p-2 font-medium text-muted-foreground">
                            {field.label}
                          </td>
                          {properties.map(prop => {
                            const value = field.getValue(prop);
                            const displayed = field.display(value);
                            const isSelected = fieldSelections[field.key] === prop.id;
                            const isEmpty = displayed === '-' || !value;
                            
                            return (
                              <td 
                                key={prop.id} 
                                className={cn(
                                  "p-2 cursor-pointer hover:bg-amber-500/10 transition-colors",
                                  isSelected && "bg-primary/10 ring-1 ring-primary/30",
                                  isEmpty && "text-muted-foreground/50"
                                )}
                                onClick={() => {
                                  if (!isEmpty) {
                                    setFieldSelections(prev => ({ ...prev, [field.key]: prop.id }));
                                  }
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  {isSelected && <Check className="w-3 h-3 text-primary" />}
                                  <span className={cn("truncate max-w-[150px]", isSelected && "font-medium")}>
                                    {displayed}
                                  </span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Auto-Resolved Section - Collapsible */}
              {fieldCategories.autoResolved.length > 0 && (
                <Collapsible open={autoResolvedExpanded} onOpenChange={setAutoResolvedExpanded}>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 hover:underline w-full">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="font-medium">{fieldCategories.autoResolved.length} fields auto-resolved</span>
                    <ChevronDown className={cn("w-4 h-4 transition-transform", autoResolvedExpanded && "rotate-180")} />
                    <span className="text-xs text-muted-foreground ml-auto">(click to review)</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <table className="w-full text-sm">
                      <thead className="bg-emerald-500/10 border-b border-emerald-500/20">
                        <tr>
                          <th className="text-left p-2 font-medium w-32">Field</th>
                          <th className="text-left p-2 font-medium">Selected Value</th>
                          <th className="text-left p-2 font-medium w-24">Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fieldCategories.autoResolved.map(({ field, selectedPropId, displayValue }) => {
                          const sourceIdx = properties.findIndex(p => p.id === selectedPropId);
                          return (
                            <tr key={field.key} className="border-b border-emerald-500/10">
                              <td className="p-2 font-medium text-muted-foreground">{field.label}</td>
                              <td className="p-2">
                                <div className="flex items-center gap-2">
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span className="truncate max-w-[200px]">{displayValue}</span>
                                </div>
                              </td>
                              <td className="p-2 text-muted-foreground text-xs">
                                Record {String.fromCharCode(65 + sourceIdx)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Contact Data Section */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Contact Data {contactMergeMode === 'stack' ? '(will be combined)' : '(from primary only)'}
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 border-b">
                    <tr>
                      <th className="text-left p-2 font-medium w-32">Field</th>
                      {properties.map((prop, idx) => (
                        <th key={prop.id} className="text-left p-2 font-medium">
                          Record {String.fromCharCode(65 + idx)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {arrayFields.map(field => (
                      <tr key={field.key} className="border-b">
                        <td className="p-2 font-medium text-muted-foreground">{field.label}</td>
                        {properties.map(prop => {
                          const value = field.getValue(prop);
                          return (
                            <td key={prop.id} className="p-2">
                              {field.key === 'phones' && <PhoneList phones={value} />}
                              {field.key === 'emails' && <EmailList emails={value} />}
                              {field.key === 'ownerContacts' && <OwnerContactsList owners={value} />}
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    {/* Tags row */}
                    <tr className="border-b">
                      <td className="p-2 font-medium text-muted-foreground">Tags</td>
                      {properties.map(prop => (
                        <td key={prop.id} className="p-2">
                          <div className="flex flex-wrap gap-1">
                            {prop.tags.filter(t => !t.startsWith('list-')).length > 0 
                              ? prop.tags.filter(t => !t.startsWith('list-')).map(t => (
                                  <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                                ))
                              : <span className="text-muted-foreground/50">-</span>
                            }
                          </div>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </ScrollArea>

          <p className="text-xs text-muted-foreground">
            Tags from all records will be combined automatically.
          </p>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Skip
          </Button>
          <Button 
            onClick={handleMerge} 
            disabled={mergeMutation.isPending}
          >
            {mergeMutation.isPending ? 'Merging...' : `Merge & Delete ${properties.length - 1} Duplicate(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
