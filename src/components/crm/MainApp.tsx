import React, { useState, useEffect, useMemo } from 'react';
import { Property, ViewMode, ListViewMode, SavedList, FilterRule, FieldDefinition } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_COLUMNS } from '@/data/mockData';
import { useProperties, useTotalPropertyCount, useUpdateProperty, useDeleteProperties, useAddProperty } from '@/hooks/useProperties';
import { useSavedLists, useAddSavedList, useDeleteSavedList } from '@/hooks/useSavedLists';
import { usePipelineStages, useInitializePipelineStages } from '@/hooks/usePipelineStages';
import { useImportProperties } from '@/hooks/useImportProperties';
import { useFieldDefinitions, useInitializeFieldDefinitions, useAddFieldDefinition, useDeleteFieldDefinition, useUpdateFieldDefinition } from '@/hooks/useFieldDefinitions';
import { usePropertyFiltering } from '@/hooks/usePropertyFiltering';
import { usePropertySearch } from '@/hooks/usePropertySearch';
import { useServerFilteredProperties } from '@/hooks/useServerFilteredProperties';
import { Sidebar } from './Sidebar';
import { FilterBar } from './FilterBar';
import { PropertyTable } from './PropertyTable';
import { KanbanBoard } from './KanbanBoard';
import { AddPropertyModal } from './AddPropertyModal';
import { NewDealModal } from './NewDealModal';
import { ImportWizard } from './ImportWizard';
import { Settings } from './Settings';
import { OwnerTable } from './OwnerTable';
import { OwnerDetail } from './OwnerDetail';
import { Dashboard } from './Dashboard';
import { BulkActionsBar } from './BulkActionsBar';
import PropertyDetail from './PropertyDetail';
import { DataCleanupTool } from './DataCleanupTool';
import { ExclusionListManager } from './ExclusionListManager';
import { toast } from 'sonner';
import { Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MainApp: React.FC = () => {
  const { company } = useAuth();
  const companyId = company?.id;

  // Data hooks
  const { data: allProperties = [], isLoading: propertiesLoading, hasMore, loadMore, isFetchingMore } = useProperties();
  const { data: totalPropertyCount = 0 } = useTotalPropertyCount();
  const { data: savedLists = [] } = useSavedLists();
  const { data: stages = [], isLoading: stagesLoading } = usePipelineStages();
  const { data: fieldDefinitions = [], isLoading: fieldsLoading } = useFieldDefinitions();
  const { mutate: initStages } = useInitializePipelineStages();
  const { mutate: initFields } = useInitializeFieldDefinitions();

  const updatePropertyMutation = useUpdateProperty();
  const deletePropertiesMutation = useDeleteProperties();
  const addPropertyMutation = useAddProperty();
  const addSavedListMutation = useAddSavedList();
  const deleteSavedListMutation = useDeleteSavedList();
  const importPropertiesMutation = useImportProperties();
  const addFieldMutation = useAddFieldDefinition();
  const deleteFieldMutation = useDeleteFieldDefinition();
  const updateFieldMutation = useUpdateFieldDefinition();

  // Search state (must be declared before usePropertyFiltering which uses it)
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Server-side search
  const { data: searchResults, isFetching: isSearching } = usePropertySearch(debouncedSearchTerm);

  // Filter & Sort (extracted to hook)
  const {
    filterRules,
    setFilterRules,
    matchType,
    setMatchType,
    sortConfig,
    handleSort,
    deduplicateByOwner,
    setDeduplicateByOwner,
    filteredProperties: clientFilteredProperties,
    sortedProperties: clientSortedProperties,
    isServerSearch,
  } = usePropertyFiltering(allProperties, searchResults, debouncedSearchTerm);

  // Server-side filtering when rules are active
  const hasFilterRules = filterRules.length > 0;
  const { data: serverFilteredProperties = [], isFetching: isFiltering, isLoading: isInitialFilterLoad } = useServerFilteredProperties(
    filterRules,
    matchType,
    hasFilterRules && !isServerSearch // Only use server filtering when not already doing server search
  );

  // Determine which properties to use based on context
  const displayProperties = useMemo(() => {
    // If server search is active, use client filtered (which uses search results)
    if (isServerSearch) {
      return clientSortedProperties;
    }
    // If filter rules are active, always use server results
    if (hasFilterRules) {
      // Only show empty during INITIAL load (no cached data yet)
      // Keep showing cached data during background refetches
      if (isInitialFilterLoad) {
        return [];
      }
      // Apply client-side sorting and deduplication to server results
      let result = [...serverFilteredProperties];
      
      if (deduplicateByOwner) {
        const seen = new Set<string>();
        result = result.filter(p => {
          if (seen.has(p.owner.name)) return false;
          seen.add(p.owner.name);
          return true;
        });
      }
      
      // Sort
      result.sort((a, b) => {
        const { field, direction } = sortConfig;
        let aVal: any, bVal: any;

        if (field === 'estimatedRevenue') {
          aVal = a.marketData.projectedRevenue || 0;
          bVal = b.marketData.projectedRevenue || 0;
        } else if (field === 'ownerName') {
          aVal = a.owner.name;
          bVal = b.owner.name;
        } else {
          aVal = (a as any)[field];
          bVal = (b as any)[field];
        }

        if (typeof aVal === 'string') {
          return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      });
      
      return result;
    }
    // Otherwise use client sorted (from loaded properties)
    return clientSortedProperties;
  }, [isServerSearch, hasFilterRules, isFiltering, isInitialFilterLoad, serverFilteredProperties, clientSortedProperties, deduplicateByOwner, sortConfig]);

  // State
  const [view, setView] = useState<ViewMode>('dashboard');
  const [listViewMode, setListViewMode] = useState<ListViewMode>('table');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedOwnerName, setSelectedOwnerName] = useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal State
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isNewDealOpen, setIsNewDealOpen] = useState(false);
  
  // Pre-loaded import data from Data Cleanup Tool
  const [preLoadedImportData, setPreLoadedImportData] = useState<any[] | undefined>(undefined);
  const [preLoadedImportHeaders, setPreLoadedImportHeaders] = useState<string[] | undefined>(undefined);

  // Initialize pipeline stages and field definitions when company is ready
  useEffect(() => {
    if (companyId) {
      initStages();
      initFields();
    }
  }, [companyId, initStages, initFields]);

  // Filter visible fields (exclude hidden ones)
  const fields = useMemo(() => {
    return fieldDefinitions.filter(f => !f.isHidden);
  }, [fieldDefinitions]);

  // Handlers

  const handleUpdateProperty = (id: string, updates: Partial<Property>) => {
    updatePropertyMutation.mutate({ id, updates });
  };

  const handleAddProperty = (data: { address: string; city: string; state: string; zip: string; ownerName: string; ownerEmail: string; ownerPhone: string; stageId?: string }) => {
    addPropertyMutation.mutate(data);
  };

  const handleAddToPipeline = (propertyId: string, stageId: string) => {
    updatePropertyMutation.mutate({ id: propertyId, updates: { stageId } });
    toast.success('Property added to pipeline');
  };

  const handleCreatePropertyWithStage = (data: { 
    address: string; 
    city: string; 
    state: string; 
    zip: string; 
    ownerName: string; 
    ownerEmail: string; 
    ownerPhone: string;
    stageId: string;
  }) => {
    addPropertyMutation.mutate(data, {
      onSuccess: () => {
        toast.success('Property created and added to pipeline');
      }
    });
  };

  const handleImportData = async (data: any[], options: {
    standardize: boolean;
    globalTags?: string[];
    listName?: string;
    duplicateStrategy?: 'skip' | 'update' | 'merge' | 'review';
    duplicateDecisions?: Map<string, 'keep_existing' | 'use_import' | 'merge'>;
  }) => {
    importPropertiesMutation.mutate({
      data,
      options,
      existingProperties: allProperties,
    });
  };

  const handleSaveList = (name: string, customRules?: FilterRule[]) => {
    addSavedListMutation.mutate({
      name,
      rules: customRules || filterRules,
      matchType: customRules ? 'and' : matchType,
    });
  };

  const handleLoadList = (list: SavedList) => {
    setFilterRules(list.rules);
    setMatchType(list.matchType);
    toast.info(`Loaded list "${list.name}"`);
  };

  const handleDeleteList = (id: string) => {
    deleteSavedListMutation.mutate(id);
  };

  const handleAddField = (field: FieldDefinition) => {
    addFieldMutation.mutate({
      label: field.label,
      type: field.type,
      options: field.options,
    });
  };

  const handleDeleteField = (fieldId: string) => {
    deleteFieldMutation.mutate(fieldId);
  };

  const handleToggleFieldVisibility = (fieldId: string, isHidden: boolean) => {
    updateFieldMutation.mutate({ id: fieldId, updates: { is_hidden: isHidden } });
  };

  const handleDeleteProperties = (ids: string[]) => {
    deletePropertiesMutation.mutate(ids);
    setSelectedIds(new Set());
  };

  const handleSelectProperty = (id: string) => {
    setSelectedPropertyId(id);
    setSelectedOwnerName(null);
  };

  const handleSelectOwner = (ownerName: string) => {
    setSelectedOwnerName(ownerName);
    setSelectedPropertyId(null);
  };

  // Render selected property detail
  const selectedProperty = selectedPropertyId ? allProperties.find(p => p.id === selectedPropertyId) : null;

  // Loading state
  if (propertiesLoading || fieldsLoading || stagesLoading) {
    return (
      <div className="flex min-h-screen bg-background items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your properties...</p>
        </div>
      </div>
    );
  }

  // Main content based on view
  const renderContent = () => {
    if (selectedProperty) {
      return (
        <PropertyDetail
          property={selectedProperty}
          stages={stages}
          fields={fields}
          onBack={() => setSelectedPropertyId(null)}
          onUpdateProperty={handleUpdateProperty}
          onSelectOwner={handleSelectOwner}
        />
      );
    }

    if (selectedOwnerName) {
      return (
        <OwnerDetail
          ownerName={selectedOwnerName}
          properties={allProperties}
          stages={stages}
          onBack={() => setSelectedOwnerName(null)}
          onSelectProperty={handleSelectProperty}
          onSelectOwner={handleSelectOwner}
        />
      );
    }

    if (view === 'dashboard') {
      return (
        <Dashboard
          properties={allProperties}
          totalPropertyCount={totalPropertyCount}
          stages={stages}
          onSelectProperty={handleSelectProperty}
          onViewChange={setView}
        />
      );
    }

    if (view === 'settings') {
      return (
        <Settings
          fields={fieldDefinitions}
          onAddField={handleAddField}
          onDeleteField={handleDeleteField}
          onToggleFieldVisibility={handleToggleFieldVisibility}
        />
      );
    }

    if (view === 'dataCleanup') {
      return (
        <DataCleanupTool 
          onSendToImport={(data, headers) => {
            setPreLoadedImportData(data);
            setPreLoadedImportHeaders(headers);
            setIsImportOpen(true);
          }}
        />
      );
    }

    if (view === 'exclusions') {
      return <ExclusionListManager />;
    }

    if (view === 'owners') {
      return (
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-6">Owners</h1>
          <OwnerTable
            properties={allProperties}
            onSelectOwner={handleSelectOwner}
          />
        </div>
      );
    }

    if (view === 'kanban') {
      return (
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-6">Pipeline</h1>
          <div className="h-[calc(100vh-180px)]">
            <KanbanBoard
              properties={displayProperties}
              stages={stages}
              onMoveProperty={(pId, sId) => handleUpdateProperty(pId, { stageId: sId })}
              onSelectProperty={handleSelectProperty}
              onNewDeal={() => setIsNewDealOpen(true)}
            />
          </div>
        </div>
      );
    }

    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-6">Properties</h1>

        <FilterBar
          rules={filterRules}
          onRulesChange={setFilterRules}
          matchType={matchType}
          onMatchTypeChange={setMatchType}
          savedLists={savedLists}
          onSaveList={handleSaveList}
          onLoadList={handleLoadList}
          onDeleteList={handleDeleteList}
          stages={stages}
          fields={fields}
          visibleColumns={visibleColumns}
          onVisibleColumnsChange={setVisibleColumns}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          debouncedSearchTerm={debouncedSearchTerm}
          onDebouncedSearchTermChange={setDebouncedSearchTerm}
          isSearching={isSearching}
          listViewMode={listViewMode}
          onListViewModeChange={setListViewMode}
          deduplicateByOwner={deduplicateByOwner}
          onDeduplicateChange={setDeduplicateByOwner}
          resultCount={displayProperties.length}
          isFiltering={isFiltering}
        />

        <div className="mt-4">
          {isFiltering && (
            <div className="h-1 w-full bg-muted overflow-hidden rounded-full mb-4">
              <div 
                className="h-full bg-primary w-1/3 animate-pulse"
                style={{ 
                  animation: 'indeterminate 1.5s infinite ease-in-out',
                }}
              />
            </div>
          )}
          {listViewMode === 'table' ? (
            <>
              <PropertyTable
                properties={displayProperties}
                onSelectProperty={handleSelectProperty}
                sortConfig={sortConfig}
                onSort={handleSort}
                visibleColumns={visibleColumns}
                stages={stages}
                fields={fields}
                selectedIds={selectedIds}
                onToggleSelection={(id) => {
                  const newSelection = new Set(selectedIds);
                  if (newSelection.has(id)) newSelection.delete(id);
                  else newSelection.add(id);
                  setSelectedIds(newSelection);
                }}
                onSelectAll={(ids) => setSelectedIds(new Set(ids))}
                onSelectOwner={handleSelectOwner}
              />
              {hasMore && !isServerSearch && !hasFilterRules && (
                <div className="flex justify-center py-6">
                  <Button
                    variant="outline"
                    onClick={loadMore}
                    disabled={isFetchingMore}
                    className="gap-2"
                  >
                    {isFetchingMore ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    {isFetchingMore 
                      ? 'Loading...' 
                      : `Load more (${totalPropertyCount - allProperties.length} remaining)`}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="h-[calc(100vh-280px)]">
              <KanbanBoard
                properties={displayProperties}
                stages={stages}
                onMoveProperty={(pId, sId) => handleUpdateProperty(pId, { stageId: sId })}
                onSelectProperty={handleSelectProperty}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        view={view}
        onViewChange={setView}
        onImportClick={() => setIsImportOpen(true)}
        onAddPropertyClick={() => setIsAddPropertyOpen(true)}
        propertyCount={allProperties.length}
        totalPropertyCount={totalPropertyCount}
        savedLists={savedLists}
        onLoadList={handleLoadList}
        onDeleteList={handleDeleteList}
      />

      <main className="flex-1 p-6 overflow-auto">
        {renderContent()}
      </main>

      <AddPropertyModal
        isOpen={isAddPropertyOpen}
        onClose={() => setIsAddPropertyOpen(false)}
        onAdd={handleAddProperty}
      />

      <ImportWizard
        isOpen={isImportOpen}
        onClose={() => {
          setIsImportOpen(false);
          setPreLoadedImportData(undefined);
          setPreLoadedImportHeaders(undefined);
        }}
        onImport={handleImportData}
        fields={fields}
        existingProperties={allProperties}
        preLoadedData={preLoadedImportData}
        preLoadedHeaders={preLoadedImportHeaders}
      />

      <BulkActionsBar
        selectedIds={selectedIds}
        properties={allProperties}
        stages={stages}
        onClearSelection={() => setSelectedIds(new Set())}
        onUpdateProperty={handleUpdateProperty}
        onDeleteProperties={handleDeleteProperties}
        onSaveList={handleSaveList}
      />

      <NewDealModal
        isOpen={isNewDealOpen}
        onClose={() => setIsNewDealOpen(false)}
        stages={stages}
        onAddToPipeline={handleAddToPipeline}
        onCreateProperty={handleCreatePropertyWithStage}
      />
    </div>
  );
};

export default MainApp;
