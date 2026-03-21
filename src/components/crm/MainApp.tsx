import React, { useState, useEffect, useMemo } from 'react';
import { Property, ViewMode, ListViewMode, SavedList, FilterRule, FieldDefinition, Deal } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_COLUMNS } from '@/data/mockData';
import { useProperties, useTotalPropertyCount, useUpdateProperty, useDeleteProperties, useAddProperty, usePropertyById } from '@/hooks/useProperties';
import { useSavedLists, useAddSavedList, useDeleteSavedList } from '@/hooks/useSavedLists';
import { usePipelineStages, useInitializePipelineStages } from '@/hooks/usePipelineStages';
import { useImportProperties } from '@/hooks/useImportProperties';
import { useFieldDefinitions, useInitializeFieldDefinitions, useAddFieldDefinition, useDeleteFieldDefinition, useUpdateFieldDefinition } from '@/hooks/useFieldDefinitions';
import { usePropertyFiltering } from '@/hooks/usePropertyFiltering';
import { usePropertySearch } from '@/hooks/usePropertySearch';
import { useAllOwners } from '@/hooks/useAllOwners';
import { useServerFilteredProperties } from '@/hooks/useServerFilteredProperties';
import { useDeals, useAddDeal, useUpdateDeal } from '@/hooks/useDeals';
import { useRealtors } from '@/hooks/useRealtors';
import { usePagination } from '@/hooks/usePagination';
import { Sidebar } from './Sidebar';
import { FilterBar } from './FilterBar';
import { PropertyTable } from './PropertyTable';
import { KanbanBoard } from './KanbanBoard';
import { AddPropertyModal } from './AddPropertyModal';
import { NewDealModal } from './NewDealModal';
import { ImportWizard } from './ImportWizard';
import { Settings } from './Settings';
import { OwnerTable } from './OwnerTable';
import { OwnersView } from './OwnersView';
import { OwnerDetail } from './OwnerDetail';
import { Dashboard } from './Dashboard';
import { BulkActionsBar } from './BulkActionsBar';
import PropertyDetail from './PropertyDetail';
import { DataCleanupTool } from './DataCleanupTool';
import { ExclusionListManager } from './ExclusionListManager';
import { CallListsView } from './CallListsView';
import { CallDialer } from './CallDialer';
import { MailingListsView } from './MailingListsView';
import { RealtorsView } from './RealtorsView';
import { RealtorDetail } from './RealtorDetail';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

// Separate component for property table with pagination to manage its own state
const PropertyTableWithPagination: React.FC<{
  displayProperties: Property[];
  isFiltering: boolean;
  listViewMode: ListViewMode;
  handleSelectProperty: (id: string) => void;
  sortConfig: { field: string; direction: 'asc' | 'desc' };
  handleSort: (field: string) => void;
  visibleColumns: string[];
  stages: any[];
  fields: FieldDefinition[];
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  handleSelectOwner: (ownerName: string) => void;
  handleUpdateProperty: (id: string, updates: Partial<Property>) => void;
}> = ({
  displayProperties,
  isFiltering,
  listViewMode,
  handleSelectProperty,
  sortConfig,
  handleSort,
  visibleColumns,
  stages,
  fields,
  selectedIds,
  setSelectedIds,
  handleSelectOwner,
  handleUpdateProperty,
}) => {
  const pagination = usePagination(displayProperties, 100);
  
  return (
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
            properties={pagination.paginatedItems}
            allMatchingProperties={displayProperties}
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
          <PaginationControls
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            startIndex={pagination.startIndex}
            endIndex={pagination.endIndex}
            onPageChange={pagination.setCurrentPage}
            onNextPage={pagination.goToNextPage}
            onPrevPage={pagination.goToPrevPage}
            hasNextPage={pagination.hasNextPage}
            hasPrevPage={pagination.hasPrevPage}
          />
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
  );
};

const MainApp: React.FC = () => {
  const { company } = useAuth();
  const companyId = company?.id;

  // Data hooks
  const { data: allProperties = [], isLoading: propertiesLoading } = useProperties();
  const { data: totalPropertyCount = 0 } = useTotalPropertyCount();
  const { data: savedLists = [] } = useSavedLists();
  const { data: stages = [], isLoading: stagesLoading } = usePipelineStages();
  const { data: fieldDefinitions = [], isLoading: fieldsLoading } = useFieldDefinitions();
  const { data: ownersData, isLoading: ownersLoading } = useAllOwners();
  const { data: deals = [] } = useDeals();
  const { data: realtors = [] } = useRealtors();
  const addDealMutation = useAddDeal();
  const updateDealMutation = useUpdateDeal();
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
  const [searchTerm, setSearchTerm] = useState(() => {
    try {
      const stored = sessionStorage.getItem('crm-search-term');
      return stored ? JSON.parse(stored) : '';
    } catch { return ''; }
  });
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(() => {
    try {
      const stored = sessionStorage.getItem('crm-search-term');
      return stored ? JSON.parse(stored) : '';
    } catch { return ''; }
  });

  // Persist search term to sessionStorage
  React.useEffect(() => {
    sessionStorage.setItem('crm-search-term', JSON.stringify(searchTerm));
  }, [searchTerm]);

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
  const [view, setViewInternal] = useState<ViewMode>('dashboard');
  
  // Handler that clears filters when navigating to properties view
  const handleViewChange = (newView: ViewMode, options?: { preserveFilters?: boolean }) => {
    if (newView === 'properties' && !options?.preserveFilters) {
      setFilterRules([]);
      setSearchTerm('');
      setDebouncedSearchTerm('');
      setDeduplicateByOwner(false);
    }
    setViewInternal(newView);
    setSelectedPropertyId(null);
    setSelectedOwnerName(null);
    setSelectedRealtorId(null);
    setSelectedIds(new Set());
  };

  // Clear selection when search term changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [debouncedSearchTerm]);
  
  // Alias for internal use
  const setView = setViewInternal;
  const [listViewMode, setListViewMode] = useState<ListViewMode>('table');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedOwnerName, setSelectedOwnerName] = useState<string | null>(null);
  const [selectedRealtorId, setSelectedRealtorId] = useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal State
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isNewDealOpen, setIsNewDealOpen] = useState(false);
  
  // Pre-loaded import data from Data Cleanup Tool
  const [preLoadedImportData, setPreLoadedImportData] = useState<any[] | undefined>(undefined);
  const [preLoadedImportHeaders, setPreLoadedImportHeaders] = useState<string[] | undefined>(undefined);
  
  // Call list dialer state
  const [dialerListId, setDialerListId] = useState<string | null>(null);

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
    duplicateDecisions?: Map<string, { mergeMode: 'stack' | 'replace' }>;
    contactMergeMode?: 'stack' | 'override';
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
    // Handle special case for properties without owner names
    if (ownerName === '__NO_OWNER__') {
      setFilterRules([{
        id: 'no-owner-filter',
        field: 'owner.name',
        operator: 'is_not_set',
        value: ''
      }]);
      setView('properties');
      setSelectedOwnerName(null);
      setSelectedPropertyId(null);
      return;
    }
    setSelectedOwnerName(ownerName);
    setSelectedPropertyId(null);
  };

  // Find property in local arrays first
  const localProperty = selectedPropertyId 
    ? (allProperties.find(p => p.id === selectedPropertyId) || displayProperties.find(p => p.id === selectedPropertyId)) 
    : null;

  // Fetch from server if not found locally
  const { data: fetchedProperty, isLoading: isLoadingProperty } = usePropertyById(
    localProperty ? null : selectedPropertyId
  );

  const selectedProperty = localProperty || fetchedProperty;

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

  // Loading state for single property fetch
  if (selectedPropertyId && isLoadingProperty && !selectedProperty) {
    return (
      <div className="flex min-h-screen bg-background items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading property...</p>
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
          onDeleteProperty={(id) => {
            deletePropertiesMutation.mutate([id], {
              onSuccess: () => {
                toast.success('Property deleted');
                setSelectedPropertyId(null);
              },
              onError: () => {
                toast.error('Failed to delete property');
              }
            });
          }}
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

    if (view === 'callLists') {
      if (dialerListId) {
        return (
          <CallDialer 
            listId={dialerListId} 
            onBack={() => setDialerListId(null)} 
          />
        );
      }
      return (
        <CallListsView 
          onOpenDialer={(listId) => setDialerListId(listId)} 
        />
      );
    }

    if (view === 'mailingLists') {
      return <MailingListsView />;
    }

    if (view === 'realtors') {
      return <RealtorsView />;
    }

    if (view === 'owners') {
      return (
        <OwnersView
          ownersData={ownersData}
          ownersLoading={ownersLoading}
          onSelectOwner={handleSelectOwner}
        />
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
              deals={deals}
              realtors={realtors}
              onMoveProperty={(pId, sId) => handleUpdateProperty(pId, { stageId: sId })}
              onMoveDeal={(dealId, newStageId) => updateDealMutation.mutate({ id: dealId, updates: { stageId: newStageId } })}
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

        <PropertyTableWithPagination 
          displayProperties={displayProperties}
          isFiltering={isFiltering}
          listViewMode={listViewMode}
          handleSelectProperty={handleSelectProperty}
          sortConfig={sortConfig}
          handleSort={handleSort}
          visibleColumns={visibleColumns}
          stages={stages}
          fields={fields}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          handleSelectOwner={handleSelectOwner}
          handleUpdateProperty={handleUpdateProperty}
        />
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        view={view}
        onViewChange={handleViewChange}
        onImportClick={() => setIsImportOpen(true)}
        onAddPropertyClick={() => setIsAddPropertyOpen(true)}
        propertyCount={allProperties.length}
        totalPropertyCount={totalPropertyCount}
          ownerCount={ownersData?.owners.length}
          realtorCount={realtors.length}
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
        onCreateDeal={(data) => {
          addDealMutation.mutate(data, {
            onSuccess: () => {
              toast.success('Contact deal added to pipeline');
            }
          });
        }}
      />
    </div>
  );
};

export default MainApp;
