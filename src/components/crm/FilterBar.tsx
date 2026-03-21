import React, { useState, useEffect, useRef } from 'react';
import { FilterRule, SavedList, PipelineStage, FieldDefinition } from '@/types';
import { Search, ListFilter, Save, X, Plus, Trash2, Columns, Users, Filter, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FilterRuleRow } from './FilterRuleRow';
import { useUniqueTags } from '@/hooks/useUniqueTags';

interface FilterBarProps {
  rules: FilterRule[];
  onRulesChange: (rules: FilterRule[]) => void;
  matchType: 'and' | 'or';
  onMatchTypeChange: (type: 'and' | 'or') => void;
  savedLists: SavedList[];
  onSaveList: (name: string) => void;
  onLoadList: (list: SavedList) => void;
  onDeleteList: (id: string) => void;
  stages: PipelineStage[];
  fields: FieldDefinition[];
  visibleColumns: string[];
  onVisibleColumnsChange: (cols: string[]) => void;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  debouncedSearchTerm: string;
  onDebouncedSearchTermChange: (term: string) => void;
  isSearching?: boolean;
  isFiltering?: boolean;
  listViewMode: 'table' | 'kanban';
  onListViewModeChange: (mode: 'table' | 'kanban') => void;
  deduplicateByOwner: boolean;
  onDeduplicateChange: (value: boolean) => void;
  resultCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  rules,
  onRulesChange,
  matchType,
  onMatchTypeChange,
  savedLists,
  onSaveList,
  onLoadList,
  onDeleteList,
  stages,
  fields,
  visibleColumns,
  onVisibleColumnsChange,
  searchTerm,
  onSearchTermChange,
  debouncedSearchTerm,
  onDebouncedSearchTermChange,
  isSearching,
  isFiltering,
  listViewMode,
  onListViewModeChange,
  deduplicateByOwner,
  onDeduplicateChange,
  resultCount,
}) => {
  const { data: availableTags = [] } = useUniqueTags();
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showSavedLists, setShowSavedLists] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [showFilters, setShowFilters] = useState(rules.length > 0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync showFilters state when rules change (e.g., when loading a smart list)
  useEffect(() => {
    if (rules.length > 0) {
      setShowFilters(true);
    }
  }, [rules]);

  // Handle search input with debouncing
  const handleSearchChange = (value: string) => {
    onSearchTermChange(value);
    
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Set new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      onDebouncedSearchTermChange(value);
    }, 300);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleSaveList = (e: React.FormEvent) => {
    e.preventDefault();
    if (newListName.trim()) {
      onSaveList(newListName.trim());
      setNewListName('');
      setIsSaving(false);
    }
  };

  const toggleColumn = (colId: string) => {
    if (visibleColumns.includes(colId)) {
      onVisibleColumnsChange(visibleColumns.filter(c => c !== colId));
    } else {
      onVisibleColumnsChange([...visibleColumns, colId]);
    }
  };

  const addFilterRule = () => {
    const newRule: FilterRule = {
      id: Date.now().toString(),
      field: 'stageId',
      operator: 'equals',
      value: '',
    };
    onRulesChange([...rules, newRule]);
    setShowFilters(true);
  };

  const updateRule = (index: number, updatedRule: FilterRule) => {
    const newRules = [...rules];
    newRules[index] = updatedRule;
    onRulesChange(newRules);
  };

  const removeRule = (index: number) => {
    const newRules = rules.filter((_, i) => i !== index);
    onRulesChange(newRules);
    if (newRules.length === 0) {
      setShowFilters(false);
    }
  };

  const clearAllFilters = () => {
    onRulesChange([]);
    setShowFilters(false);
  };

  return (
    <div className="space-y-3">
      {/* Main Controls Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search all properties..."
            className="w-full pl-10 pr-10 py-2.5 border border-input rounded-lg text-sm bg-card focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none transition-all"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
          )}
        </div>

        {/* Result Count */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
          {isFiltering && <Loader2 className="w-4 h-4 animate-spin" />}
          {isFiltering ? (
            <span>Filtering...</span>
          ) : (
            <span>{resultCount} {resultCount === 1 ? 'property' : 'properties'}</span>
          )}
        </div>

        {/* Add Filter Button */}
        <button
          onClick={addFilterRule}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all",
            rules.length > 0 
              ? 'bg-brand-50 border-brand-200 text-brand-700' 
              : 'bg-card border-input text-muted-foreground hover:bg-muted/50'
          )}
        >
          <Filter className="w-4 h-4" />
          Filter
          {rules.length > 0 && (
            <span className="px-1.5 py-0.5 bg-brand text-brand-foreground rounded-full text-xs">
              {rules.length}
            </span>
          )}
        </button>

        {/* Deduplicate Toggle */}
        <button
          onClick={() => onDeduplicateChange(!deduplicateByOwner)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all",
            deduplicateByOwner 
              ? 'bg-brand-50 border-brand-200 text-brand-700' 
              : 'bg-card border-input text-muted-foreground hover:bg-muted/50'
          )}
        >
          <Users className="w-4 h-4" />
          One per Owner
        </button>

        {/* Column Selector */}
        <div className="relative">
          <button
            onClick={() => setShowColumnPicker(!showColumnPicker)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-input bg-card text-muted-foreground hover:bg-muted/50 transition-all"
          >
            <Columns className="w-4 h-4" />
            Columns
          </button>

          {showColumnPicker && (
            <div className="absolute right-0 mt-2 w-56 bg-card rounded-lg shadow-medium border border-border z-50 p-2 animate-fade-in">
              {fields.map(field => {
                const fieldKey = (field as any).fieldKey || field.id;
                return (
                  <label
                    key={field.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 rounded-md cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(fieldKey)}
                      onChange={() => toggleColumn(fieldKey)}
                      className="w-4 h-4 rounded border-border text-brand focus:ring-brand"
                    />
                    {field.label}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Saved Lists */}
        <div className="relative">
          <button
            onClick={() => setShowSavedLists(!showSavedLists)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-input bg-card text-muted-foreground hover:bg-muted/50 transition-all"
          >
            <ListFilter className="w-4 h-4" />
            Smart Lists
          </button>

          {showSavedLists && (
            <div className="absolute right-0 mt-2 w-72 bg-card rounded-lg shadow-medium border border-border z-50 animate-fade-in">
              <div className="p-3 border-b border-border">
                <h4 className="text-sm font-semibold text-foreground">Saved Lists</h4>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {savedLists.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground text-center">No saved lists yet</p>
                ) : (
                  savedLists.map(list => (
                    <div
                      key={list.id}
                      className="flex items-center justify-between px-3 py-2 hover:bg-muted/50"
                    >
                      <button
                        onClick={() => { onLoadList(list); setShowSavedLists(false); }}
                        className="text-sm text-foreground hover:text-brand flex-1 text-left"
                      >
                        {list.name}
                      </button>
                      <button
                        onClick={() => onDeleteList(list.id)}
                        className="p-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Save Current Filters */}
              <div className="p-3 border-t border-border">
                {isSaving ? (
                  <form onSubmit={handleSaveList} className="flex gap-2">
                    <input
                      type="text"
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      placeholder="List name..."
                      className="flex-1 px-2 py-1.5 text-sm border border-input rounded-md bg-background focus:ring-1 focus:ring-brand focus:border-brand outline-none"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={!newListName.trim()}
                      className="px-3 py-1.5 bg-brand text-brand-foreground rounded-md text-sm font-medium hover:bg-brand-600 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSaving(false)}
                      className="p-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => setIsSaving(true)}
                    className="flex items-center gap-2 text-sm text-brand hover:text-brand-600 font-medium"
                  >
                    <Save className="w-4 h-4" />
                    Save current filters
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter Rules Section */}
      {showFilters && rules.length > 0 && (
        <div className="bg-muted/30 rounded-lg border border-border p-4 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">Filters</span>
              <div className="flex items-center bg-card rounded-md border border-input">
                <button
                  onClick={() => onMatchTypeChange('and')}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-l-md transition-colors",
                    matchType === 'and' ? 'bg-brand text-brand-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  AND
                </button>
                <button
                  onClick={() => onMatchTypeChange('or')}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-r-md transition-colors",
                    matchType === 'or' ? 'bg-brand text-brand-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  OR
                </button>
              </div>
            </div>
            <button
              onClick={clearAllFilters}
              className="text-xs text-muted-foreground hover:text-destructive font-medium"
            >
              Clear all
            </button>
          </div>

          <div className="space-y-2">
            {rules.map((rule, index) => (
              <FilterRuleRow
                key={rule.id}
                rule={rule}
                fields={fields}
                stages={stages}
                availableTags={availableTags}
                onChange={(updated) => updateRule(index, updated)}
                onRemove={() => removeRule(index)}
              />
            ))}
          </div>

          <button
            onClick={addFilterRule}
            className="mt-3 flex items-center gap-1.5 text-sm text-brand hover:text-brand-600 font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Add condition
          </button>
        </div>
      )}
    </div>
  );
};