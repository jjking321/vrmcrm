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
import { DuplicateProperty, DuplicateGroup, useMergeDuplicates } from '@/hooks/useDuplicateDetection';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Check, Calendar, Phone, Mail, Users, PhoneOff } from 'lucide-react';
import { PhoneContact, EmailContact, OwnerContact } from '@/types';

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

// Helper to render phone list
const PhoneList: React.FC<{ phones: PhoneContact[] }> = ({ phones }) => {
  if (!phones || phones.length === 0) return <span className="text-muted-foreground/50">-</span>;
  return (
    <div className="space-y-1">
      {phones.map((p, i) => (
        <div key={i} className="flex items-center gap-1 text-xs">
          {p.doNotCall ? (
            <PhoneOff className="w-3 h-3 text-amber-500" />
          ) : (
            <Phone className="w-3 h-3 text-muted-foreground" />
          )}
          <span className={cn(p.doNotCall && "text-amber-600")}>{p.number}</span>
          {p.type && <Badge variant="outline" className="text-[10px] px-1 py-0">{p.type}</Badge>}
        </div>
      ))}
    </div>
  );
};

// Helper to render email list
const EmailList: React.FC<{ emails: EmailContact[] }> = ({ emails }) => {
  if (!emails || emails.length === 0) return <span className="text-muted-foreground/50">-</span>;
  return (
    <div className="space-y-1">
      {emails.map((e, i) => (
        <div key={i} className="flex items-center gap-1 text-xs">
          <Mail className="w-3 h-3 text-muted-foreground" />
          <span className="truncate max-w-[120px]">{e.address}</span>
        </div>
      ))}
    </div>
  );
};

// Helper to render owner contacts list
const OwnerContactsList: React.FC<{ owners: OwnerContact[] }> = ({ owners }) => {
  if (!owners || owners.length === 0) return <span className="text-muted-foreground/50">-</span>;
  return (
    <div className="space-y-1">
      {owners.map((o, i) => (
        <div key={i} className="flex items-center gap-1 text-xs">
          <Users className="w-3 h-3 text-muted-foreground" />
          <span className="truncate max-w-[120px]">
            {o.firstName} {o.lastName}
          </span>
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
  const mergeMutation = useMergeDuplicates();

  // Reset state when group changes
  React.useEffect(() => {
    if (group) {
      // Default to oldest record
      const oldest = [...group.properties].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )[0];
      setPrimaryId(oldest.id);
      setContactMergeMode('stack');
      
      // Initialize field selections with primary's values
      const selections: Record<string, string> = {};
      MERGE_FIELDS.forEach(field => {
        selections[field.key] = oldest.id;
      });
      setFieldSelections(selections);
    }
  }, [group]);

  const properties = group?.properties || [];

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

  // Determine which fields have different values across duplicates
  const fieldsWithDifferences = useMemo(() => {
    if (!group) return new Set<string>();
    const diffs = new Set<string>();
    
    MERGE_FIELDS.filter(f => !f.isArrayField).forEach(field => {
      const values = group.properties.map(p => {
        const val = field.getValue(p);
        return JSON.stringify(val);
      });
      const uniqueValues = new Set(values.filter(v => v !== 'null' && v !== '"-"' && v !== '""'));
      if (uniqueValues.size > 1) {
        diffs.add(field.key);
      }
    });
    
    return diffs;
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

  const nonArrayFields = MERGE_FIELDS.filter(f => !f.isArrayField);
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

          {/* Field Comparison Table */}
          <ScrollArea className="h-[300px] border rounded-md">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card border-b z-10">
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
                {nonArrayFields.map(field => {
                  const hasDiff = fieldsWithDifferences.has(field.key);
                  return (
                    <tr key={field.key} className={cn("border-b", hasDiff && "bg-amber-500/5")}>
                      <td className="p-2 font-medium text-muted-foreground">
                        {field.label}
                        {hasDiff && <span className="text-amber-500 ml-1">*</span>}
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
                              "p-2 cursor-pointer hover:bg-muted/50 transition-colors",
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
                  );
                })}

                {/* Array fields section */}
                <tr className="bg-muted/30">
                  <td colSpan={properties.length + 1} className="p-2 font-medium text-xs text-muted-foreground uppercase tracking-wide">
                    Contact Data {contactMergeMode === 'stack' ? '(will be combined)' : '(from primary only)'}
                  </td>
                </tr>
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
          </ScrollArea>

          <p className="text-xs text-muted-foreground">
            <span className="text-amber-500">*</span> Fields with different values. Click a cell to select that value for the merged record. Tags from all records will be combined.
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
