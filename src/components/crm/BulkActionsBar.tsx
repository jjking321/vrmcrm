import React, { useState } from 'react';
import { Property, PipelineStage, FilterRule } from '@/types';
import { X, Tag, Trash2, RefreshCw, ArrowRight, Loader2, CheckSquare, ListFilter, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchZillowData, fetchAirbnbEstimateBatch, applyZillowDataWithStreetView, applyAirROIData } from '@/lib/enrichment';
import { toast } from 'sonner';
import { AddToCallListModal } from './AddToCallListModal';

interface BulkActionsBarProps {
  selectedIds: Set<string>;
  properties: Property[];
  stages: PipelineStage[];
  onClearSelection: () => void;
  onUpdateProperty: (id: string, updates: Partial<Property>) => void;
  onDeleteProperties: (ids: string[]) => void;
  onSaveList: (name: string, rules?: FilterRule[]) => void;
  pageSize?: number;
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedIds,
  properties,
  stages,
  onClearSelection,
  onUpdateProperty,
  onDeleteProperties,
  onSaveList,
  pageSize = 100,
}) => {
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [isMovingStage, setIsMovingStage] = useState(false);
  const [isLoadingZillow, setIsLoadingZillow] = useState(false);
  const [isLoadingAirROI, setIsLoadingAirROI] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState(0);
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isCallListModalOpen, setIsCallListModalOpen] = useState(false);

  const selectedCount = selectedIds.size;
  const selectedProperties = properties.filter(p => selectedIds.has(p.id));

  // Check if property needs Zillow enrichment
  const needsZillowEnrichment = (property: Property): boolean => {
    return !property.image || 
           !property.zillowUrl || 
           !property.marketData?.propertyValue;
  };

  // Check if property needs Airbnb enrichment (needs both ADR AND revenue to be considered complete)
  const needsAirbnbEnrichment = (property: Property): boolean => {
    const adr = property.marketData?.adr || 0;
    const revenue = property.marketData?.projectedRevenue || 0;
    // Need enrichment if missing ADR OR missing revenue (both required for complete data)
    return adr === 0 || revenue === 0;
  };

  // Calculate counts for button labels
  const zillowNeeded = selectedProperties.filter(needsZillowEnrichment).length;
  const airbnbNeeded = selectedProperties.filter(needsAirbnbEnrichment).length;

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.trim()) return;

    const tag = newTag.trim().toLowerCase();
    selectedProperties.forEach(property => {
      if (!property.tags.includes(tag)) {
        onUpdateProperty(property.id, { tags: [...property.tags, tag] });
      }
    });

    toast.success(`Added tag "${tag}" to ${selectedCount} properties`);
    setNewTag('');
    setIsAddingTag(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    selectedProperties.forEach(property => {
      onUpdateProperty(property.id, { tags: property.tags.filter(t => t !== tagToRemove) });
    });
    toast.success(`Removed tag "${tagToRemove}" from ${selectedCount} properties`);
  };

  const handleMoveToStage = (stageId: string) => {
    selectedProperties.forEach(property => {
      onUpdateProperty(property.id, { stageId });
    });
    const stage = stages.find(s => s.id === stageId);
    toast.success(`Moved ${selectedCount} properties to "${stage?.name}"`);
    setIsMovingStage(false);
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete ${selectedCount} properties? This cannot be undone.`)) {
      onDeleteProperties(Array.from(selectedIds));
      toast.success(`Deleted ${selectedCount} properties`);
      onClearSelection();
    }
  };

  const handleBulkZillow = async () => {
    const propertiesToEnrich = selectedProperties.filter(needsZillowEnrichment);
    
    if (propertiesToEnrich.length === 0) {
      toast.info('All selected properties already have Zillow data');
      return;
    }

    setIsLoadingZillow(true);
    setEnrichProgress(0);
    let successCount = 0;
    const skippedCount = selectedCount - propertiesToEnrich.length;

    for (let i = 0; i < propertiesToEnrich.length; i++) {
      const property = propertiesToEnrich[i];
      try {
        const result = await fetchZillowData(property);
        if (result.success && result.data) {
          const updates = await applyZillowDataWithStreetView(property, result.data);
          onUpdateProperty(property.id, updates);
          successCount++;
        }
      } catch (err) {
        console.error(`Failed to enrich ${property.address}:`, err);
      }
      setEnrichProgress(((i + 1) / propertiesToEnrich.length) * 100);
    }

    setIsLoadingZillow(false);
    const skippedMsg = skippedCount > 0 ? ` (${skippedCount} already had data)` : '';
    toast.success(`Enriched ${successCount} of ${propertiesToEnrich.length} properties with Zillow data${skippedMsg}`);
  };

  const handleBulkAirROI = async () => {
    const propertiesToEnrich = selectedProperties.filter(needsAirbnbEnrichment);
    
    if (propertiesToEnrich.length === 0) {
      toast.info('All selected properties already have Airbnb data');
      return;
    }

    setIsLoadingAirROI(true);
    setEnrichProgress(0);
    let successCount = 0;
    const skippedCount = selectedCount - propertiesToEnrich.length;

    // Use batch enrichment which handles listing IDs vs calculator intelligently
    const results = await fetchAirbnbEstimateBatch(
      propertiesToEnrich,
      (progress) => setEnrichProgress(progress)
    );

    // Apply results to properties
    results.forEach((result, propertyId) => {
      if (result.success && result.data) {
        const property = propertiesToEnrich.find(p => p.id === propertyId);
        if (property) {
          const updates = applyAirROIData(property, result.data);
          onUpdateProperty(propertyId, updates);
          successCount++;
        }
      }
    });

    setIsLoadingAirROI(false);
    const skippedMsg = skippedCount > 0 ? ` (${skippedCount} already had data)` : '';
    toast.success(`Enriched ${successCount} of ${propertiesToEnrich.length} properties with Airbnb data${skippedMsg}`);
  };

  // Get common tags across selected properties
  const commonTags = selectedProperties.length > 0
    ? selectedProperties[0].tags.filter(tag => 
        selectedProperties.every(p => p.tags.includes(tag))
      )
    : [];

  const handleCreateSmartList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    
    // Create a unique tag for this selection
    const listTag = `list-${Date.now()}`;
    
    // Add the tag to all selected properties
    selectedProperties.forEach(property => {
      if (!property.tags.includes(listTag)) {
        onUpdateProperty(property.id, { tags: [...property.tags, listTag] });
      }
    });
    
    // Save the list with the tag-based filter rule
    const tagRule: FilterRule = {
      id: Date.now().toString(),
      field: 'tags',
      operator: 'contains',
      value: listTag,
    };
    onSaveList(newListName.trim(), [tagRule]);
    
    toast.success(`Created smart list "${newListName}" with ${selectedCount} properties`);
    setNewListName('');
    setIsCreatingList(false);
  };

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className="bg-card border border-border rounded-xl shadow-xl px-4 py-3 flex items-center gap-3">
        {/* Selection count */}
        <div className="flex items-center gap-2 pr-3 border-r border-border">
          <CheckSquare className="w-4 h-4 text-brand" />
          <span className="text-sm font-medium text-foreground">
            {selectedCount.toLocaleString()} selected
            {selectedCount > pageSize && (
              <span className="text-muted-foreground ml-1">(across pages)</span>
            )}
          </span>
          <button
            onClick={onClearSelection}
            className="p-1 hover:bg-muted rounded transition-colors"
            title="Clear selection"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Tag actions */}
        <div className="relative">
          {isAddingTag ? (
            <form onSubmit={handleAddTag} className="flex items-center gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                className="w-32 px-2 py-1.5 text-sm border border-input rounded-lg bg-background focus:border-brand outline-none"
                placeholder="Tag name..."
                autoFocus
              />
              <button type="submit" className="p-1.5 bg-brand text-brand-foreground rounded-lg text-xs">
                Add
              </button>
              <button type="button" onClick={() => setIsAddingTag(false)} className="p-1.5 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <button
              onClick={() => setIsAddingTag(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              <Tag className="w-4 h-4" />
              Add Tag
            </button>
          )}
        </div>

        {/* Common tags to remove */}
        {commonTags.filter(tag => !tag.startsWith('list-')).length > 0 && (
          <div className="flex items-center gap-1 px-2 border-l border-border">
            <span className="text-xs text-muted-foreground mr-1">Remove:</span>
            {commonTags.filter(tag => !tag.startsWith('list-')).slice(0, 3).map(tag => (
              <button
                key={tag}
                onClick={() => handleRemoveTag(tag)}
                className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                {tag} ×
              </button>
            ))}
          </div>
        )}

        {/* Move to stage */}
        <div className="relative border-l border-border pl-3">
          {isMovingStage ? (
            <div className="flex items-center gap-2">
              <select
                onChange={(e) => handleMoveToStage(e.target.value)}
                className="px-2 py-1.5 text-sm border border-input rounded-lg bg-background focus:border-brand outline-none"
                defaultValue=""
              >
                <option value="" disabled>Select stage...</option>
                {stages.map(stage => (
                  <option key={stage.id} value={stage.id}>{stage.name}</option>
                ))}
              </select>
              <button onClick={() => setIsMovingStage(false)} className="p-1 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsMovingStage(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
              Move Stage
            </button>
          )}
        </div>

        {/* Enrich actions */}
        <div className="flex items-center gap-2 border-l border-border pl-3">
          <button
            onClick={handleBulkZillow}
            disabled={isLoadingZillow || isLoadingAirROI}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
              isLoadingZillow 
                ? "bg-blue-100 text-blue-700" 
                : "text-foreground hover:bg-muted"
            )}
          >
            {isLoadingZillow ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {Math.round(enrichProgress)}%
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Zillow {zillowNeeded > 0 && zillowNeeded < selectedCount && `(${zillowNeeded})`}
              </>
            )}
          </button>
          <button
            onClick={handleBulkAirROI}
            disabled={isLoadingZillow || isLoadingAirROI}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
              isLoadingAirROI 
                ? "bg-emerald-100 text-emerald-700" 
                : "text-foreground hover:bg-muted"
            )}
          >
            {isLoadingAirROI ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {Math.round(enrichProgress)}%
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Airbnb {airbnbNeeded > 0 && airbnbNeeded < selectedCount && `(${airbnbNeeded})`}
              </>
            )}
          </button>
        </div>

        {/* Create Smart List */}
        <div className="relative border-l border-border pl-3">
          {isCreatingList ? (
            <form onSubmit={handleCreateSmartList} className="flex items-center gap-2">
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                className="w-32 px-2 py-1.5 text-sm border border-input rounded-lg bg-background focus:border-brand outline-none"
                placeholder="List name..."
                autoFocus
              />
              <button type="submit" className="p-1.5 bg-brand text-brand-foreground rounded-lg text-xs">
                Save
              </button>
              <button type="button" onClick={() => setIsCreatingList(false)} className="p-1.5 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <button
              onClick={() => setIsCreatingList(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              <ListFilter className="w-4 h-4" />
              Smart List
            </button>
          )}
        </div>

        {/* Call List */}
        <div className="border-l border-border pl-3">
          <button
            onClick={() => setIsCallListModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <Phone className="w-4 h-4" />
            Call List
          </button>
        </div>

        {/* Delete */}
        <button
          onClick={handleDelete}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors border-l border-border pl-3"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      </div>
      
      {/* Call List Modal */}
      <AddToCallListModal
        isOpen={isCallListModalOpen}
        onClose={() => setIsCallListModalOpen(false)}
        selectedProperties={selectedProperties}
      />
    </div>
  );
};
