import React, { useState, useEffect } from 'react';
import { Property, PipelineStage, Realtor } from '@/types';
import { usePropertySearch } from '@/hooks/usePropertySearch';
import { useRealtors, useAddRealtor } from '@/hooks/useRealtors';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Search, Plus, Loader2, MapPin, User, Check, AlertTriangle, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface NewDealModalProps {
  isOpen: boolean;
  onClose: () => void;
  stages: PipelineStage[];
  onAddToPipeline: (propertyId: string, stageId: string) => void;
  onCreateProperty: (data: {
    address: string;
    city: string;
    state: string;
    zip: string;
    ownerName: string;
    ownerEmail: string;
    ownerPhone: string;
    stageId: string;
  }) => void;
  onCreateDeal?: (data: {
    contactName: string;
    contactPhone?: string;
    contactEmail?: string;
    notes?: string;
    dealValue?: number;
    stageId: string;
  }) => void;
}

export const NewDealModal: React.FC<NewDealModalProps> = ({
  isOpen,
  onClose,
  stages,
  onAddToPipeline,
  onCreateProperty,
  onCreateDeal,
}) => {
  const { profile } = useAuth();
  const [tab, setTab] = useState('search');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string>(stages[0]?.id || '');
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Create form state
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');

  // Duplicate check state
  const [duplicateMatches, setDuplicateMatches] = useState<any[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);

  // Contact-only deal state
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactNotes, setContactNotes] = useState('');
  const [dealValue, setDealValue] = useState('');

  const { data: searchResults = [], isFetching } = usePropertySearch(debouncedSearch, isOpen && tab === 'search');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Update selectedStageId when stages load
  useEffect(() => {
    if (stages.length > 0 && !selectedStageId) {
      setSelectedStageId(stages[0].id);
    }
  }, [stages, selectedStageId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTab('search');
      setSearchTerm('');
      setDebouncedSearch('');
      setSelectedProperty(null);
      setSelectedStageId(stages[0]?.id || '');
      setShowCreateForm(false);
      setAddress('');
      setCity('');
      setState('');
      setZip('');
      setOwnerName('');
      setOwnerEmail('');
      setOwnerPhone('');
      setContactName('');
      setContactPhone('');
      setContactEmail('');
      setContactNotes('');
      setDealValue('');
      setDuplicateMatches([]);
      setIsCheckingDuplicates(false);
    }
  }, [isOpen, stages]);

  const handleAddToPipeline = () => {
    if (selectedProperty && selectedStageId) {
      onAddToPipeline(selectedProperty.id, selectedStageId);
      onClose();
    }
  };

  const handleCreateProperty = async () => {
    if (!address || !selectedStageId) return;

    // Check for duplicates first
    setIsCheckingDuplicates(true);
    try {
      const query = supabase
        .from('properties')
        .select('id, address, city, state, zip, stage_id')
        .ilike('address', `%${address.trim()}%`);

      if (profile?.company_id) {
        query.eq('company_id', profile.company_id);
      }

      const { data: matches } = await query.limit(10);

      if (matches && matches.length > 0) {
        setDuplicateMatches(matches);
        setIsCheckingDuplicates(false);
        return; // Show warning instead of creating
      }
    } catch (err) {
      // If check fails, proceed with creation
    }
    setIsCheckingDuplicates(false);
    handleForceCreate();
  };

  const handleForceCreate = () => {
    if (address && selectedStageId) {
      onCreateProperty({
        address,
        city,
        state,
        zip,
        ownerName,
        ownerEmail,
        ownerPhone,
        stageId: selectedStageId,
      });
      onClose();
    }
  };

  const handleUseExisting = (propertyId: string) => {
    onAddToPipeline(propertyId, selectedStageId);
    onClose();
  };

  const handleCreateDeal = () => {
    if (contactName && selectedStageId && onCreateDeal) {
      onCreateDeal({
        contactName,
        contactPhone: contactPhone || undefined,
        contactEmail: contactEmail || undefined,
        notes: contactNotes || undefined,
        dealValue: dealValue ? Number(dealValue) : undefined,
        stageId: selectedStageId,
      });
      onClose();
    }
  };

  const renderSearchResults = () => {
    if (isFetching) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (debouncedSearch.length >= 2 && searchResults.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">No properties found matching "{debouncedSearch}"</p>
          <Button variant="outline" onClick={() => { setTab('property'); }}>
            <Plus className="w-4 h-4 mr-2" />
            Create New Property
          </Button>
        </div>
      );
    }

    if (searchResults.length > 0) {
      return (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {searchResults.map((property) => {
            const isInPipeline = !!property.stageId;
            const stageName = stages.find(s => s.id === property.stageId)?.name;
            
            return (
              <button
                key={property.id}
                onClick={() => setSelectedProperty(property)}
                className={cn(
                  "w-full p-3 rounded-lg border text-left transition-all",
                  selectedProperty?.id === property.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium truncate">{property.address}</span>
                    </div>
                    <p className="text-sm text-muted-foreground ml-6">
                      {property.city}, {property.state} {property.zip}
                    </p>
                    {property.owner.name && (
                      <div className="flex items-center gap-2 mt-1 ml-6">
                        <User className="w-3 h-3 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{property.owner.name}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {isInPipeline ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-600">
                        In {stageName}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                        Not in pipeline
                      </span>
                    )}
                  </div>
                </div>
                {selectedProperty?.id === property.id && (
                  <div className="mt-2 ml-6">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      );
    }

    return (
      <div className="text-center py-8 text-muted-foreground">
        <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Search for a property by address or owner name</p>
      </div>
    );
  };

  const renderCreateForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="address">Street Address *</Label>
          <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" />
        </div>
        <div>
          <Label htmlFor="city">City</Label>
          <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="state">State</Label>
            <Input id="state" value={state} onChange={(e) => setState(e.target.value)} placeholder="FL" />
          </div>
          <div>
            <Label htmlFor="zip">Zip</Label>
            <Input id="zip" value={zip} onChange={(e) => setZip(e.target.value)} placeholder="32931" />
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <h4 className="text-sm font-medium mb-3">Owner Information (Optional)</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label htmlFor="ownerName">Owner Name</Label>
            <Input id="ownerName" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="John Smith" />
          </div>
          <div>
            <Label htmlFor="ownerEmail">Email</Label>
            <Input id="ownerEmail" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="john@example.com" />
          </div>
          <div>
            <Label htmlFor="ownerPhone">Phone</Label>
            <Input id="ownerPhone" type="tel" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} placeholder="(555) 123-4567" />
          </div>
        </div>
      </div>

      <div>
        <Label>Pipeline Stage *</Label>
        <Select value={selectedStageId} onValueChange={setSelectedStageId}>
          <SelectTrigger><SelectValue placeholder="Select a stage" /></SelectTrigger>
          <SelectContent>
            {stages.map((stage) => (
              <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Duplicate warning */}
      {duplicateMatches.length > 0 && (
        <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10 text-foreground">
          <AlertTriangle className="h-4 w-4 !text-amber-500" />
          <AlertTitle className="text-amber-600">Possible duplicate found</AlertTitle>
          <AlertDescription className="space-y-3">
            <p className="text-sm text-muted-foreground">
              We found {duplicateMatches.length} existing {duplicateMatches.length === 1 ? 'property' : 'properties'} with a similar address:
            </p>
            <div className="space-y-2">
              {duplicateMatches.map((match) => {
                const stageName = stages.find(s => s.id === match.stage_id)?.name;
                return (
                  <div key={match.id} className="flex items-center justify-between p-2 rounded-md border bg-background">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{match.address}</p>
                      <p className="text-xs text-muted-foreground">{match.city}, {match.state} {match.zip}</p>
                      {stageName && <p className="text-xs text-muted-foreground">Pipeline: {stageName}</p>}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleUseExisting(match.id)}>
                      Use This
                    </Button>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={() => setDuplicateMatches([])}>Back</Button>
              <Button size="sm" variant="outline" onClick={handleForceCreate}>Create Anyway</Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleCreateProperty} 
          disabled={!address || !selectedStageId || isCheckingDuplicates || duplicateMatches.length > 0}
        >
          {isCheckingDuplicates ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Checking...</> : 'Create & Add to Pipeline'}
        </Button>
      </div>
    </div>
  );

  const renderContactForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="contactName">Contact Name *</Label>
          <Input id="contactName" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Jane Doe" autoFocus />
        </div>
        <div>
          <Label htmlFor="contactPhone">Phone</Label>
          <Input id="contactPhone" type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="(555) 123-4567" />
        </div>
        <div>
          <Label htmlFor="contactEmail">Email</Label>
          <Input id="contactEmail" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="jane@example.com" />
        </div>
        <div>
          <Label htmlFor="dealValue">Deal Value ($)</Label>
          <Input id="dealValue" type="number" value={dealValue} onChange={(e) => setDealValue(e.target.value)} placeholder="0" />
        </div>
        <div>
          <Label>Pipeline Stage *</Label>
          <Select value={selectedStageId} onValueChange={setSelectedStageId}>
            <SelectTrigger><SelectValue placeholder="Select a stage" /></SelectTrigger>
            <SelectContent>
              {stages.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label htmlFor="contactNotes">Notes</Label>
          <Textarea id="contactNotes" value={contactNotes} onChange={(e) => setContactNotes(e.target.value)} placeholder="Any notes about this lead..." rows={3} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleCreateDeal} disabled={!contactName || !selectedStageId}>Add Contact Deal</Button>
      </div>
    </div>
  );

  const renderStageSelection = () => (
    <div className="space-y-4 border-t pt-4 mt-4">
      <div>
        <Label>Add to Pipeline Stage</Label>
        <Select value={selectedStageId} onValueChange={setSelectedStageId}>
          <SelectTrigger><SelectValue placeholder="Select a stage" /></SelectTrigger>
          <SelectContent>
            {stages.map((stage) => (
              <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setSelectedProperty(null)}>Back</Button>
        <Button onClick={handleAddToPipeline}>Add to Pipeline</Button>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Deal</DialogTitle>
        </DialogHeader>

        {stages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Loading pipeline stages...</p>
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="search" className="flex-1 gap-1.5">
                <Search className="w-3.5 h-3.5" />
                Search Property
              </TabsTrigger>
              <TabsTrigger value="property" className="flex-1 gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                New Property
              </TabsTrigger>
              <TabsTrigger value="contact" className="flex-1 gap-1.5">
                <User className="w-3.5 h-3.5" />
                Contact Only
              </TabsTrigger>
            </TabsList>

            <TabsContent value="search">
              {!selectedProperty && (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by address or owner name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                      autoFocus
                    />
                  </div>
                  {renderSearchResults()}
                </>
              )}
              {selectedProperty && renderStageSelection()}
            </TabsContent>

            <TabsContent value="property">
              {renderCreateForm()}
            </TabsContent>

            <TabsContent value="contact">
              {renderContactForm()}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
