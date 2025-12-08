import React, { useState, useEffect, useMemo } from 'react';
import { Property, ViewMode, ListViewMode, SavedList, SortConfig, FilterRule, PipelineStage, FieldDefinition } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_STAGES, SYSTEM_FIELDS, DEFAULT_COLUMNS } from '@/data/mockData';
import { useProperties, useUpdateProperty, useDeleteProperties, useAddProperty } from '@/hooks/useProperties';
import { useSavedLists, useAddSavedList, useDeleteSavedList } from '@/hooks/useSavedLists';
import { usePipelineStages, useInitializePipelineStages } from '@/hooks/usePipelineStages';
import { useImportProperties } from '@/hooks/useImportProperties';
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
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const MainApp: React.FC = () => {
  const { company } = useAuth();
  const companyId = company?.id;

  // Data hooks
  const { data: allProperties = [], isLoading: propertiesLoading } = useProperties();
  const { data: savedLists = [] } = useSavedLists();
  const { data: stages = DEFAULT_STAGES } = usePipelineStages();
  const { mutate: initStages } = useInitializePipelineStages();

  const updatePropertyMutation = useUpdateProperty();
  const deletePropertiesMutation = useDeleteProperties();
  const addPropertyMutation = useAddProperty();
  const addSavedListMutation = useAddSavedList();
  const deleteSavedListMutation = useDeleteSavedList();
  const importPropertiesMutation = useImportProperties();

  // State
  const [view, setView] = useState<ViewMode>('dashboard');
  const [listViewMode, setListViewMode] = useState<ListViewMode>('table');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedOwnerName, setSelectedOwnerName] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldDefinition[]>(SYSTEM_FIELDS);

  // Filter & Sort State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRules, setFilterRules] = useState<FilterRule[]>([]);
  const [matchType, setMatchType] = useState<'and' | 'or'>('and');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'address', direction: 'asc' });
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [deduplicateByOwner, setDeduplicateByOwner] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal State
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Initialize pipeline stages when company is ready
  useEffect(() => {
    if (companyId) {
      initStages();
    }
  }, [companyId, initStages]);

  // Load custom fields from localStorage (these can stay local for now)
  useEffect(() => {
    if (companyId) {
      const storedFields = localStorage.getItem(`custom_fields_${companyId}`);
      if (storedFields) {
        setFields([...SYSTEM_FIELDS, ...JSON.parse(storedFields)]);
      }
    }
  }, [companyId]);

  // Apply filter rules to a property
  const applyFilterRules = (property: Property, rules: FilterRule[], matchType: 'and' | 'or'): boolean => {
    if (rules.length === 0) return true;

    const evaluateRule = (rule: FilterRule): boolean => {
      let value: any;

      switch (rule.field) {
        case 'stageId':
          value = property.stageId;
          break;
        case 'bedrooms':
          value = property.bedrooms;
          break;
        case 'bathrooms':
          value = property.bathrooms;
          break;
        case 'estimatedRevenue':
          value = property.marketData.projectedRevenue || 0;
          break;
        case 'city':
          value = property.city;
          break;
        case 'state':
          value = property.state;
          break;
        case 'ownerName':
          value = property.owner.name;
          break;
        case 'tags':
          value = property.tags.join(' ');
          break;
        case 'address':
          value = property.address;
          break;
        default:
          value = property.customFields?.[rule.field] ?? '';
      }

      switch (rule.operator) {
        case 'equals':
          return String(value).toLowerCase() === String(rule.value).toLowerCase();
        case 'contains':
          return String(value).toLowerCase().includes(String(rule.value).toLowerCase());
        case 'starts_with':
          return String(value).toLowerCase().startsWith(String(rule.value).toLowerCase());
        case 'gt':
          return Number(value) > Number(rule.value);
        case 'lt':
          return Number(value) < Number(rule.value);
        case 'is_set':
          return value !== undefined && value !== null && value !== '';
        case 'is_not_set':
          return value === undefined || value === null || value === '';
        default:
          return true;
      }
    };

    if (matchType === 'and') {
      return rules.every(evaluateRule);
    } else {
      return rules.some(evaluateRule);
    }
  };

  // Filtering & Sorting Logic
  const filteredProperties = useMemo(() => {
    let result = allProperties;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p =>
        p.address.toLowerCase().includes(term) ||
        p.city.toLowerCase().includes(term) ||
        p.owner.name.toLowerCase().includes(term) ||
        p.tags.some(t => t.toLowerCase().includes(term))
      );
    }

    result = result.filter(p => applyFilterRules(p, filterRules, matchType));

    if (deduplicateByOwner) {
      const seen = new Set<string>();
      result = result.filter(p => {
        if (seen.has(p.owner.name)) return false;
        seen.add(p.owner.name);
        return true;
      });
    }

    return result;
  }, [allProperties, searchTerm, filterRules, matchType, deduplicateByOwner]);

  const sortedProperties = useMemo(() => {
    return [...filteredProperties].sort((a, b) => {
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
  }, [filteredProperties, sortConfig]);

  // Handlers
  const handleSort = (field: string) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

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
    setFields(prev => [...prev, field]);
    const customFields = [...fields.filter(f => !f.isSystem), field];
    localStorage.setItem(`custom_fields_${companyId}`, JSON.stringify(customFields));
    toast.success(`Added field "${field.label}"`);
  };

  const handleDeleteField = (fieldId: string) => {
    setFields(prev => prev.filter(f => f.id !== fieldId));
    const customFields = fields.filter(f => !f.isSystem && f.id !== fieldId);
    localStorage.setItem(`custom_fields_${companyId}`, JSON.stringify(customFields));
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
  if (propertiesLoading) {
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
          stages={stages}
          onSelectProperty={handleSelectProperty}
          onViewChange={setView}
        />
      );
    }

    if (view === 'settings') {
      return (
        <Settings
          fields={fields}
          onAddField={handleAddField}
          onDeleteField={handleDeleteField}
        />
      );
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
        onClose={() => setIsImportOpen(false)}
        onImport={handleImportData}
        fields={fields}
        existingProperties={allProperties}
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
