import React, { useState, useEffect, useMemo } from 'react';
import { Property, ViewMode, ListViewMode, SavedList, FilterRule, FieldDefinition } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_STAGES, DEFAULT_COLUMNS } from '@/data/mockData';
import { useProperties, useTotalPropertyCount, useUpdateProperty, useDeleteProperties, useAddProperty } from '@/hooks/useProperties';
import { useSavedLists, useAddSavedList, useDeleteSavedList } from '@/hooks/useSavedLists';
import { usePipelineStages, useInitializePipelineStages } from '@/hooks/usePipelineStages';
import { useImportProperties } from '@/hooks/useImportProperties';
import { useFieldDefinitions, useInitializeFieldDefinitions, useAddFieldDefinition, useDeleteFieldDefinition, useUpdateFieldDefinition } from '@/hooks/useFieldDefinitions';
import { usePropertyFiltering } from '@/hooks/usePropertyFiltering';
import { Sidebar } from './Sidebar';
import { FilterBar } from './FilterBar';
import { PropertyTable } from './PropertyTable';
import { KanbanBoard } from './KanbanBoard';
import { AddPropertyModal } from './AddPropertyModal';
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
  const { data: stages = DEFAULT_STAGES } = usePipelineStages();
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

  // Filter & Sort (extracted to hook)
  const {
    searchTerm,
    setSearchTerm,
    filterRules,
    setFilterRules,
    matchType,
    setMatchType,
    sortConfig,
    handleSort,
    deduplicateByOwner,
    setDeduplicateByOwner,
    filteredProperties,
    sortedProperties,
  } = usePropertyFiltering(allProperties);

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

  const handleAddProperty = (data: { address: string; city: string; state: string; zip: string; ownerName: string; ownerEmail: string; ownerPhone: string }) => {
    addPropertyMutation.mutate(data);
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
  if (propertiesLoading || fieldsLoading) {
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
              properties={filteredProperties}
              stages={stages}
              onMoveProperty={(pId, sId) => handleUpdateProperty(pId, { stageId: sId })}
              onSelectProperty={handleSelectProperty}
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
          listViewMode={listViewMode}
          onListViewModeChange={setListViewMode}
          deduplicateByOwner={deduplicateByOwner}
          onDeduplicateChange={setDeduplicateByOwner}
          resultCount={sortedProperties.length}
        />

        <div className="mt-4">
          {listViewMode === 'table' ? (
            <>
              <PropertyTable
                properties={sortedProperties}
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
              {hasMore && (
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
                properties={sortedProperties}
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
    </div>
  );
};

export default MainApp;
