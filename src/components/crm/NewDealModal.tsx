import React, { useState, useEffect } from 'react';
import { Property, PipelineStage } from '@/types';
import { usePropertySearch } from '@/hooks/usePropertySearch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Loader2, MapPin, User, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

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
}

export const NewDealModal: React.FC<NewDealModalProps> = ({
  isOpen,
  onClose,
  stages,
  onAddToPipeline,
  onCreateProperty,
}) => {
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

  const { data: searchResults = [], isFetching } = usePropertySearch(debouncedSearch, isOpen);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
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
    }
  }, [isOpen, stages]);

  const handleAddToPipeline = () => {
    if (selectedProperty && selectedStageId) {
      onAddToPipeline(selectedProperty.id, selectedStageId);
      onClose();
    }
  };

  const handleCreateProperty = () => {
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
          <Button variant="outline" onClick={() => setShowCreateForm(true)}>
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
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Create New Property</h3>
        <Button variant="ghost" size="sm" onClick={() => setShowCreateForm(false)}>
          Back to search
        </Button>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="address">Street Address *</Label>
          <Input
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Main St"
          />
        </div>
        <div>
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="FL"
            />
          </div>
          <div>
            <Label htmlFor="zip">Zip</Label>
            <Input
              id="zip"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="32931"
            />
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <h4 className="text-sm font-medium mb-3">Owner Information (Optional)</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label htmlFor="ownerName">Owner Name</Label>
            <Input
              id="ownerName"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="John Smith"
            />
          </div>
          <div>
            <Label htmlFor="ownerEmail">Email</Label>
            <Input
              id="ownerEmail"
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="john@example.com"
            />
          </div>
          <div>
            <Label htmlFor="ownerPhone">Phone</Label>
            <Input
              id="ownerPhone"
              type="tel"
              value={ownerPhone}
              onChange={(e) => setOwnerPhone(e.target.value)}
              placeholder="(555) 123-4567"
            />
          </div>
        </div>
      </div>

      <div>
        <Label>Pipeline Stage *</Label>
        <Select value={selectedStageId} onValueChange={setSelectedStageId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a stage" />
          </SelectTrigger>
          <SelectContent>
            {stages.map((stage) => (
              <SelectItem key={stage.id} value={stage.id}>
                {stage.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleCreateProperty} disabled={!address || !selectedStageId}>
          Create & Add to Pipeline
        </Button>
      </div>
    </div>
  );

  const renderStageSelection = () => (
    <div className="space-y-4 border-t pt-4 mt-4">
      <div>
        <Label>Add to Pipeline Stage</Label>
        <Select value={selectedStageId} onValueChange={setSelectedStageId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a stage" />
          </SelectTrigger>
          <SelectContent>
            {stages.map((stage) => (
              <SelectItem key={stage.id} value={stage.id}>
                {stage.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setSelectedProperty(null)}>
          Back
        </Button>
        <Button onClick={handleAddToPipeline}>
          Add to Pipeline
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Deal</DialogTitle>
        </DialogHeader>

        {showCreateForm ? (
          renderCreateForm()
        ) : (
          <div className="space-y-4">
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
                {debouncedSearch.length < 2 && (
                  <div className="flex justify-center pt-2">
                    <Button variant="outline" onClick={() => setShowCreateForm(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create New Property
                    </Button>
                  </div>
                )}
              </>
            )}

            {selectedProperty && renderStageSelection()}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
