import React, { useState, useEffect, useMemo } from 'react';
import { Property, ViewMode, ListViewMode, SavedList, SortConfig, FilterRule, PipelineStage, FieldDefinition } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_STAGES, SYSTEM_FIELDS, MOCK_PROPERTIES, DEFAULT_COLUMNS } from '@/data/mockData';
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
import PropertyDetail from './PropertyDetail';
import { toast } from 'sonner';

const MainApp: React.FC = () => {
  const { user } = useAuth();

  // State
  const [view, setView] = useState<ViewMode>('dashboard');
  const [listViewMode, setListViewMode] = useState<ListViewMode>('table');
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedOwnerName, setSelectedOwnerName] = useState<string | null>(null);
  const [stages] = useState<PipelineStage[]>(DEFAULT_STAGES);
  const [fields, setFields] = useState<FieldDefinition[]>(SYSTEM_FIELDS);

  // Filter & Sort State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRules, setFilterRules] = useState<FilterRule[]>([]);
  const [matchType, setMatchType] = useState<'and' | 'or'>('and');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'leadScore', direction: 'desc' });
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [savedLists, setSavedLists] = useState<SavedList[]>([]);
  const [deduplicateByOwner, setDeduplicateByOwner] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal State
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);


  // Load data on mount
  useEffect(() => {
    const stored = localStorage.getItem(`properties_${user?.companyId}`);
    if (stored) {
      setAllProperties(JSON.parse(stored));
    } else {
      setAllProperties(MOCK_PROPERTIES);
    }

    const storedLists = localStorage.getItem(`saved_lists_${user?.companyId}`);
    if (storedLists) {
      setSavedLists(JSON.parse(storedLists));
    }

    const storedFields = localStorage.getItem(`custom_fields_${user?.companyId}`);
    if (storedFields) {
      setFields([...SYSTEM_FIELDS, ...JSON.parse(storedFields)]);
    }
  }, [user?.companyId]);

  // Persist data
  useEffect(() => {
    if (user?.companyId && allProperties.length > 0) {
      localStorage.setItem(`properties_${user.companyId}`, JSON.stringify(allProperties));
    }
  }, [allProperties, user?.companyId]);

  // Apply filter rules to a property
  const applyFilterRules = (property: Property, rules: FilterRule[], matchType: 'and' | 'or'): boolean => {
    if (rules.length === 0) return true;

    const evaluateRule = (rule: FilterRule): boolean => {
      let value: any;

      // Get the value based on field
      switch (rule.field) {
        case 'leadScore':
          value = property.leadScore;
          break;
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

      // Evaluate based on operator
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

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p =>
        p.address.toLowerCase().includes(term) ||
        p.city.toLowerCase().includes(term) ||
        p.owner.name.toLowerCase().includes(term) ||
        p.tags.some(t => t.toLowerCase().includes(term))
      );
    }

    // Apply filter rules
    result = result.filter(p => applyFilterRules(p, filterRules, matchType));

    // Deduplicate by owner
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
    setAllProperties(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    toast.success('Property updated');
  };

  const handleAddProperty = (data: { address: string; city: string; state: string; zip: string; ownerName: string; ownerEmail: string; ownerPhone: string }) => {
    const newProperty: Property = {
      id: Math.random().toString(36).substr(2, 9),
      companyId: user?.companyId || 'unknown',
      address: data.address,
      city: data.city,
      state: data.state,
      zip: data.zip,
      bedrooms: 0,
      bathrooms: 0,
      image: `https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop`,
      stageId: 'lead-list',
      tags: [],
      owner: {
        name: data.ownerName,
        email: data.ownerEmail,
        phone: data.ownerPhone,
        lastVerifiedDate: new Date().toISOString(),
      },
      activities: [],
      marketData: {
        adr: 0,
        occupancyRate: 0,
        projectedRevenue: 0,
        propertyValue: 0,
      },
      leadScore: 50,
      customFields: {},
    };
    setAllProperties(prev => [newProperty, ...prev]);
    toast.success(`Added ${data.address} to your leads`);
  };

  const handleImportData = (data: any[], options: { standardize: boolean; globalTags?: string[]; listName?: string }) => {
    const newProperties: Property[] = data.map(row => ({
      id: Math.random().toString(36).substr(2, 9),
      companyId: user?.companyId || 'unknown',
      address: row.address || '',
      city: row.city || '',
      state: row.state || '',
      zip: row.zip || '',
      bedrooms: parseInt(row.bedrooms) || 0,
      bathrooms: parseFloat(row.bathrooms) || 0,
      image: `https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop`,
      stageId: 'lead-list',
      tags: options.globalTags || [],
      owner: {
        name: row.ownerName || 'Unknown',
        email: row.ownerEmail || '',
        phone: row.ownerPhone || '',
        lastVerifiedDate: new Date().toISOString(),
      },
      activities: [],
      marketData: {
        adr: 0,
        occupancyRate: 0,
        projectedRevenue: 0,
        propertyValue: 0,
      },
      leadScore: 50,
      customFields: {},
    }));

    setAllProperties(prev => [...newProperties, ...prev]);
    toast.success(`Imported ${newProperties.length} properties`);
  };

  const handleSaveList = (name: string) => {
    const newList: SavedList = {
      id: Date.now().toString(),
      name,
      rules: filterRules,
      matchType,
    };
    const updated = [...savedLists, newList];
    setSavedLists(updated);
    localStorage.setItem(`saved_lists_${user?.companyId}`, JSON.stringify(updated));
    toast.success(`Saved list "${name}"`);
  };

  const handleLoadList = (list: SavedList) => {
    setFilterRules(list.rules);
    setMatchType(list.matchType);
    toast.info(`Loaded list "${list.name}"`);
  };

  const handleDeleteList = (id: string) => {
    const updated = savedLists.filter(l => l.id !== id);
    setSavedLists(updated);
    localStorage.setItem(`saved_lists_${user?.companyId}`, JSON.stringify(updated));
  };

  const handleAddField = (field: FieldDefinition) => {
    setFields(prev => [...prev, field]);
    const customFields = [...fields.filter(f => !f.isSystem), field];
    localStorage.setItem(`custom_fields_${user?.companyId}`, JSON.stringify(customFields));
    toast.success(`Added field "${field.label}"`);
  };

  const handleDeleteField = (fieldId: string) => {
    setFields(prev => prev.filter(f => f.id !== fieldId));
    const customFields = fields.filter(f => !f.isSystem && f.id !== fieldId);
    localStorage.setItem(`custom_fields_${user?.companyId}`, JSON.stringify(customFields));
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

  // Main content based on view
  const renderContent = () => {
    // Property detail view
    if (selectedProperty) {
      return (
        <PropertyDetail
          property={selectedProperty}
          stages={stages}
          fields={fields}
          onBack={() => setSelectedPropertyId(null)}
          onUpdateProperty={handleUpdateProperty}
        />
      );
    }

    // Owner detail view
    if (selectedOwnerName) {
      return (
        <OwnerDetail
          ownerName={selectedOwnerName}
          properties={allProperties}
          stages={stages}
          onBack={() => setSelectedOwnerName(null)}
          onSelectProperty={handleSelectProperty}
        />
      );
    }

    // Dashboard view
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

    // Properties view
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
      />
    </div>
  );
};

export default MainApp;