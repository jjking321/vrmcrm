import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { DuplicateProperty, DuplicateGroup, useMergeDuplicates } from '@/hooks/useDuplicateDetection';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { 
  Check, Calendar, Phone, Mail, Users, PhoneOff, ChevronDown, 
  CheckCircle2, AlertCircle, ChevronRight, ChevronLeft, PartyPopper, Merge, Tag
} from 'lucide-react';
import { PhoneContact, EmailContact, OwnerContact } from '@/types';

// Extract meaningful source tags (filter out internal list- prefixed tags)
const getSourceTags = (tags: string[]): string[] => {
  return (tags || []).filter(t => !t.startsWith('list-'));
};

interface DuplicateWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: DuplicateGroup[];
  onComplete: () => void;
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
  { key: 'ownerName', label: 'Owner Name', getValue: p => p.owner?.name, display: v => v || '-', isOwnerField: true },
  { key: 'mailingAddress', label: 'Mailing Address', getValue: p => p.owner?.mailingAddress, display: v => v || '-', isOwnerField: true },
  { key: 'phones', label: 'Phone Numbers', getValue: p => p.owner?.phones || [], display: v => v?.length > 0 ? `${v.length} phone(s)` : '-', isOwnerField: true, isArrayField: true },
  { key: 'emails', label: 'Email Addresses', getValue: p => p.owner?.emails || [], display: v => v?.length > 0 ? `${v.length} email(s)` : '-', isOwnerField: true, isArrayField: true },
  { key: 'ownerContacts', label: 'Owner Contacts', getValue: p => p.owner?.owners || [], display: v => v?.length > 0 ? `${v.length} owner(s)` : '-', isOwnerField: true, isArrayField: true },
];

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

export const DuplicateWizard: React.FC<DuplicateWizardProps> = ({
  open,
  onOpenChange,
  groups,
  onComplete,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mergedCount, setMergedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  
  // Per-group state
  const [primaryId, setPrimaryId] = useState<string>('');
  const [fieldSelections, setFieldSelections] = useState<Record<string, string>>({});
  const [contactMergeMode, setContactMergeMode] = useState<'stack' | 'override'>('stack');
  const [autoResolvedExpanded, setAutoResolvedExpanded] = useState(false);
  
  const mergeMutation = useMergeDuplicates();

  const currentGroup = groups[currentIndex];
  const properties = currentGroup?.properties || [];
  const isComplete = currentIndex >= groups.length;
  const progress = groups.length > 0 ? ((currentIndex) / groups.length) * 100 : 0;

  // Reset per-group state when current group changes
  React.useEffect(() => {
    if (currentGroup) {
      const oldest = [...currentGroup.properties].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )[0];
      setPrimaryId(oldest.id);
      setContactMergeMode('stack');
      setAutoResolvedExpanded(false);
      
      const selections: Record<string, string> = {};
      MERGE_FIELDS.filter(f => !f.isArrayField).forEach(field => {
        const propValues = currentGroup.properties.map(p => ({
          id: p.id,
          value: field.getValue(p),
          isEmpty: !field.getValue(p) || field.display(field.getValue(p)) === '-'
        }));
        const nonEmptyProps = propValues.filter(pv => !pv.isEmpty);
        if (nonEmptyProps.length === 1) {
          selections[field.key] = nonEmptyProps[0].id;
        } else if (nonEmptyProps.length > 1) {
          const uniqueValues = new Set(nonEmptyProps.map(pv => JSON.stringify(pv.value)));
          selections[field.key] = uniqueValues.size === 1 ? nonEmptyProps[0].id : oldest.id;
        } else {
          selections[field.key] = oldest.id;
        }
      });
      setFieldSelections(selections);
    }
  }, [currentGroup]);

  // Reset wizard state when opened
  React.useEffect(() => {
    if (open) {
      setCurrentIndex(0);
      setMergedCount(0);
      setSkippedCount(0);
    }
  }, [open]);

  const fieldCategories = useMemo(() => {
    if (!currentGroup) return { autoResolved: [] as any[], conflicting: [] as any[], empty: [] as any[] };
    
    const autoResolved: Array<{ field: MergeField; selectedPropId: string; value: any; displayValue: string }> = [];
    const conflicting: MergeField[] = [];
    const empty: MergeField[] = [];
    
    MERGE_FIELDS.filter(f => !f.isArrayField).forEach(field => {
      const propValues = currentGroup.properties.map(p => ({
        id: p.id,
        value: field.getValue(p),
        displayValue: field.display(field.getValue(p)),
        isEmpty: !field.getValue(p) || field.display(field.getValue(p)) === '-'
      }));
      const nonEmptyProps = propValues.filter(pv => !pv.isEmpty);
      
      if (nonEmptyProps.length === 0) {
        empty.push(field);
      } else if (nonEmptyProps.length === 1) {
        autoResolved.push({ field, selectedPropId: nonEmptyProps[0].id, value: nonEmptyProps[0].value, displayValue: nonEmptyProps[0].displayValue });
      } else {
        const uniqueValues = new Set(nonEmptyProps.map(pv => JSON.stringify(pv.value)));
        if (uniqueValues.size === 1) {
          autoResolved.push({ field, selectedPropId: nonEmptyProps[0].id, value: nonEmptyProps[0].value, displayValue: nonEmptyProps[0].displayValue });
        } else {
          conflicting.push(field);
        }
      }
    });
    
    return { autoResolved, conflicting, empty };
  }, [currentGroup]);

  const combinedCounts = useMemo(() => {
    if (!currentGroup) return { phones: 0, emails: 0, owners: 0 };
    const allPhones = new Set<string>();
    const allEmails = new Set<string>();
    const allOwners = new Set<string>();
    
    currentGroup.properties.forEach(p => {
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
    
    return { phones: allPhones.size, emails: allEmails.size, owners: allOwners.size };
  }, [currentGroup]);

  const handleMerge = async () => {
    if (!currentGroup || !primaryId) return;

    const deleteIds = properties.filter(p => p.id !== primaryId).map(p => p.id);
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
        } else if (['adr', 'projectedRevenue', 'propertyValue'].includes(field.key)) {
          const primaryProp = properties.find(p => p.id === primaryId);
          mergedData.marketData = { ...(primaryProp?.marketData || {}), [field.key]: value };
        } else if (field.key === 'latitude' && value) {
          mergedData.latitude = value.lat;
          mergedData.longitude = value.lng;
        } else {
          (mergedData as any)[field.key] = value;
        }
      }
    });

    if (contactMergeMode === 'override') {
      const primaryProp = properties.find(p => p.id === primaryId);
      if (primaryProp?.owner) {
        mergedOwnerData.phones = primaryProp.owner.phones;
        mergedOwnerData.emails = primaryProp.owner.emails;
        mergedOwnerData.owners = primaryProp.owner.owners;
      }
    }

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

    setMergedCount(prev => prev + 1);
    setCurrentIndex(prev => prev + 1);
  };

  const handleSkip = () => {
    setSkippedCount(prev => prev + 1);
    setCurrentIndex(prev => prev + 1);
  };

  const handleClose = () => {
    onOpenChange(false);
    if (mergedCount > 0) {
      onComplete();
    }
  };

  const arrayFields = MERGE_FIELDS.filter(f => f.isArrayField);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Merge className="w-5 h-5" />
              Duplicate Merge Wizard
            </DialogTitle>
            <div className="text-sm text-muted-foreground">
              {!isComplete && `${currentIndex + 1} of ${groups.length}`}
            </div>
          </div>
          <Progress value={progress} className="h-2 mt-2" />
        </DialogHeader>

        {isComplete ? (
          // Completion screen
          <div className="flex-1 flex flex-col items-center justify-center py-12 space-y-4">
            <PartyPopper className="w-16 h-16 text-primary" />
            <h2 className="text-2xl font-bold text-foreground">All Done!</h2>
            <div className="text-center text-muted-foreground">
              <p>Merged: <span className="font-semibold text-emerald-600">{mergedCount}</span> duplicate groups</p>
              <p>Skipped: <span className="font-semibold text-muted-foreground">{skippedCount}</span> groups</p>
            </div>
            <Button onClick={handleClose} size="lg" className="mt-4">
              Close Wizard
            </Button>
          </div>
        ) : currentGroup ? (
          // Current group review
          <div className="flex-1 overflow-hidden space-y-4">
            {/* Address header */}
            <div className="text-center py-2 border-b">
              <p className="text-lg font-semibold">{currentGroup.displayAddress}</p>
              <p className="text-sm text-muted-foreground">
                {properties.length} duplicate records
                {(() => {
                  const allSources = new Set<string>();
                  properties.forEach(p => getSourceTags(p.tags).forEach(t => allSources.add(t)));
                  return allSources.size > 0 ? ` • Sources: ${Array.from(allSources).join(', ')}` : '';
                })()}
              </p>
            </div>

            {/* Primary Record Selection */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Keep this record:</Label>
              <RadioGroup value={primaryId} onValueChange={setPrimaryId} className="space-y-2">
                {properties.map((prop, idx) => {
                  const sourceTags = getSourceTags(prop.tags);
                  return (
                    <div key={prop.id} className="flex items-center space-x-3 p-2 rounded-lg border hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value={prop.id} id={`wizard-${prop.id}`} />
                      <Label htmlFor={`wizard-${prop.id}`} className="cursor-pointer flex-1 flex items-center gap-3">
                        <span className="font-medium">Record {String.fromCharCode(65 + idx)}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(prop.createdAt), 'MMM d, yyyy')}
                        </span>
                        {sourceTags.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            {sourceTags.map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
                                <Tag className="w-3 h-3 mr-1" />
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>

            {/* Contact Merge Mode */}
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <Label className="text-sm font-medium mb-2 block">Phone & email handling:</Label>
              <RadioGroup 
                value={contactMergeMode} 
                onValueChange={(v) => setContactMergeMode(v as 'stack' | 'override')}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="stack" id="wizard-stack" />
                  <Label htmlFor="wizard-stack" className="cursor-pointer text-sm">Stack all phones & emails</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="override" id="wizard-override" />
                  <Label htmlFor="wizard-override" className="cursor-pointer text-sm">Keep primary's phones & emails only</Label>
                </div>
              </RadioGroup>
              <div className="mt-2 text-xs text-purple-700 dark:text-purple-300">
                {contactMergeMode === 'stack' ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{combinedCounts.phones} phones</Badge>
                    <Badge variant="secondary" className="text-xs">{combinedCounts.emails} emails</Badge>
                  </div>
                ) : (
                  <span>Owner contacts ({combinedCounts.owners}) are always preserved from all records</span>
                )}
              </div>
            </div>

            {/* Smart Resolution Summary */}
            <div className="flex items-center gap-4 text-sm">
              {fieldCategories.autoResolved.length > 0 && (
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{fieldCategories.autoResolved.length} auto-resolved</span>
                </div>
              )}
              {fieldCategories.conflicting.length > 0 && (
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="w-4 h-4" />
                  <span>{fieldCategories.conflicting.length} need selection</span>
                </div>
              )}
            </div>

            <ScrollArea className="h-[250px] border rounded-md">
              <div className="p-2 space-y-4">
                {/* Conflicts */}
                {fieldCategories.conflicting.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">Select values:</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-amber-500/10 border-b border-amber-500/20">
                        <tr>
                          <th className="text-left p-2 font-medium w-32">Field</th>
                          {properties.map((prop, idx) => {
                            const sourceTags = getSourceTags(prop.tags);
                            return (
                              <th key={prop.id} className="text-left p-2 font-medium">
                                <div className="flex flex-col">
                                  <span>Record {String.fromCharCode(65 + idx)}</span>
                                  {sourceTags.length > 0 && (
                                    <span className="text-xs font-normal text-muted-foreground">
                                      ({sourceTags.slice(0, 2).join(', ')})
                                    </span>
                                  )}
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {fieldCategories.conflicting.map(field => (
                          <tr key={field.key} className="border-b border-amber-500/10 bg-amber-500/5">
                            <td className="p-2 font-medium text-muted-foreground">{field.label}</td>
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
                                  onClick={() => !isEmpty && setFieldSelections(prev => ({ ...prev, [field.key]: prop.id }))}
                                >
                                  <div className="flex items-center gap-2">
                                    {isSelected && <Check className="w-3 h-3 text-primary" />}
                                    <span className={cn("truncate max-w-[150px]", isSelected && "font-medium")}>{displayed}</span>
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

                {/* Auto-Resolved */}
                {fieldCategories.autoResolved.length > 0 && (
                  <Collapsible open={autoResolvedExpanded} onOpenChange={setAutoResolvedExpanded}>
                    <CollapsibleTrigger className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 hover:underline w-full">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="font-medium">{fieldCategories.autoResolved.length} fields auto-resolved</span>
                      <ChevronDown className={cn("w-4 h-4 transition-transform", autoResolvedExpanded && "rotate-180")} />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <table className="w-full text-sm">
                        <thead className="bg-emerald-500/10 border-b border-emerald-500/20">
                          <tr>
                            <th className="text-left p-2 font-medium w-32">Field</th>
                            <th className="text-left p-2 font-medium">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fieldCategories.autoResolved.map(({ field, displayValue }) => (
                            <tr key={field.key} className="border-b border-emerald-500/10">
                              <td className="p-2 font-medium text-muted-foreground">{field.label}</td>
                              <td className="p-2">
                                <div className="flex items-center gap-2">
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span>{displayValue}</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Contacts */}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground uppercase">Contacts</div>
                  <table className="w-full text-sm">
                    <tbody>
                      {arrayFields.map(field => (
                        <tr key={field.key} className="border-b">
                          <td className="p-2 font-medium text-muted-foreground w-32">{field.label}</td>
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
                    </tbody>
                  </table>
                </div>
              </div>
            </ScrollArea>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-2 border-t">
              <Button 
                variant="outline" 
                onClick={handleSkip}
                disabled={mergeMutation.isPending}
              >
                Skip <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
              <Button 
                onClick={handleMerge} 
                disabled={mergeMutation.isPending}
              >
                {mergeMutation.isPending ? 'Merging...' : 'Merge & Next'}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
