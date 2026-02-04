import React, { useState, useEffect } from 'react';
import { Search, Filter, X, ChevronDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FilterRule, FilterOperator } from '@/types';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// Field definitions for mailing list filtering
const MAILING_FILTER_FIELDS = [
  { id: 'state', label: 'State', type: 'text' },
  { id: 'city', label: 'City', type: 'text' },
  { id: 'zip', label: 'ZIP', type: 'text' },
  { id: 'contactName', label: 'Contact Name', type: 'text' },
  { id: 'isCanadian', label: 'Is Canadian', type: 'checkbox' },
] as const;

// Operators available for each field type
const OPERATORS: { value: FilterOperator; label: string; types: string[] }[] = [
  { value: 'equals', label: 'is', types: ['text'] },
  { value: 'not_equals', label: 'is not', types: ['text'] },
  { value: 'contains', label: 'contains', types: ['text'] },
  { value: 'starts_with', label: 'starts with', types: ['text'] },
  { value: 'is_set', label: 'is set', types: ['text'] },
  { value: 'is_not_set', label: 'is not set', types: ['text'] },
  { value: 'any_of', label: 'is any of', types: ['text'] },
  { value: 'is_true', label: 'is true', types: ['checkbox'] },
  { value: 'is_false', label: 'is false', types: ['checkbox'] },
];

interface MailingListFilterBarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  filterRules: FilterRule[];
  onAddRule: () => void;
  onUpdateRule: (rule: FilterRule) => void;
  onRemoveRule: (ruleId: string) => void;
  matchType: 'and' | 'or';
  onMatchTypeChange: (type: 'and' | 'or') => void;
  onClearFilters: () => void;
  totalCount: number;
  filteredCount: number;
  hasActiveFilters: boolean;
}

export const MailingListFilterBar: React.FC<MailingListFilterBarProps> = ({
  searchTerm,
  onSearchChange,
  filterRules,
  onAddRule,
  onUpdateRule,
  onRemoveRule,
  matchType,
  onMatchTypeChange,
  onClearFilters,
  totalCount,
  filteredCount,
  hasActiveFilters,
}) => {
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  const [isFiltersOpen, setIsFiltersOpen] = useState(filterRules.length > 0);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(debouncedSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [debouncedSearch, onSearchChange]);

  // Auto-open filters section when rules exist
  useEffect(() => {
    if (filterRules.length > 0) {
      setIsFiltersOpen(true);
    }
  }, [filterRules.length]);

  return (
    <div className="space-y-3">
      {/* Search and filter controls */}
      <div className="flex items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search contacts..."
            value={debouncedSearch}
            onChange={(e) => setDebouncedSearch(e.target.value)}
            className="pl-9 pr-8"
          />
          {debouncedSearch && (
            <button
              onClick={() => {
                setDebouncedSearch('');
                onSearchChange('');
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (filterRules.length === 0) {
              onAddRule();
            }
            setIsFiltersOpen(!isFiltersOpen);
          }}
          className={cn(
            "gap-2",
            filterRules.length > 0 && "border-primary text-primary"
          )}
        >
          <Filter className="w-4 h-4" />
          Filter
          {filterRules.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
              {filterRules.length}
            </span>
          )}
        </Button>

        {/* Result count */}
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {hasActiveFilters ? (
            <>
              <span className="font-medium text-foreground">{filteredCount}</span> of {totalCount}
            </>
          ) : (
            <>{totalCount} contacts</>
          )}
        </span>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Filter rules section */}
      <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
        <CollapsibleContent className="space-y-2">
          {filterRules.length > 0 && (
            <div className="p-3 bg-muted/30 rounded-lg border border-border space-y-2">
              {/* Match type toggle */}
              {filterRules.length > 1 && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm text-muted-foreground">Match</span>
                  <button
                    onClick={() => onMatchTypeChange('and')}
                    className={cn(
                      "px-2 py-1 text-xs rounded transition-colors",
                      matchType === 'and'
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80"
                    )}
                  >
                    ALL
                  </button>
                  <button
                    onClick={() => onMatchTypeChange('or')}
                    className={cn(
                      "px-2 py-1 text-xs rounded transition-colors",
                      matchType === 'or'
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80"
                    )}
                  >
                    ANY
                  </button>
                  <span className="text-sm text-muted-foreground">of these rules</span>
                </div>
              )}

              {/* Filter rules */}
              {filterRules.map((rule) => (
                <MailingFilterRuleRow
                  key={rule.id}
                  rule={rule}
                  onChange={onUpdateRule}
                  onRemove={() => onRemoveRule(rule.id)}
                />
              ))}

              {/* Add rule button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onAddRule}
                className="text-muted-foreground hover:text-foreground"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add filter
              </Button>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

// Individual filter rule row component
interface MailingFilterRuleRowProps {
  rule: FilterRule;
  onChange: (rule: FilterRule) => void;
  onRemove: () => void;
}

const MailingFilterRuleRow: React.FC<MailingFilterRuleRowProps> = ({
  rule,
  onChange,
  onRemove,
}) => {
  const selectedField = MAILING_FILTER_FIELDS.find(f => f.id === rule.field);
  const fieldType = selectedField?.type || 'text';
  const availableOperators = OPERATORS.filter(op => op.types.includes(fieldType));
  const showValueInput = !['is_set', 'is_not_set', 'is_true', 'is_false'].includes(rule.operator);

  return (
    <div className="flex items-center gap-2 p-2 bg-background rounded-lg border border-border">
      {/* Field selector */}
      <select
        value={rule.field}
        onChange={(e) => {
          const newField = e.target.value;
          const newFieldDef = MAILING_FILTER_FIELDS.find(f => f.id === newField);
          const newFieldType = newFieldDef?.type || 'text';
          const validOperators = OPERATORS.filter(op => op.types.includes(newFieldType));
          const defaultOperator = validOperators[0]?.value || 'equals';
          onChange({ ...rule, field: newField, value: '', operator: defaultOperator });
        }}
        className="px-3 py-1.5 border border-input rounded-md text-sm bg-card focus:ring-1 focus:ring-ring focus:border-ring outline-none min-w-[130px]"
      >
        {MAILING_FILTER_FIELDS.map(f => (
          <option key={f.id} value={f.id}>{f.label}</option>
        ))}
      </select>

      {/* Operator selector */}
      <select
        value={rule.operator}
        onChange={(e) => onChange({ ...rule, operator: e.target.value as FilterOperator, value: '' })}
        className="px-3 py-1.5 border border-input rounded-md text-sm bg-card focus:ring-1 focus:ring-ring focus:border-ring outline-none min-w-[110px]"
      >
        {availableOperators.map(op => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>

      {/* Value input */}
      {showValueInput && (
        <input
          type="text"
          value={rule.value as string}
          onChange={(e) => onChange({ ...rule, value: e.target.value })}
          placeholder="Value"
          className="flex-1 px-3 py-1.5 border border-input rounded-md text-sm bg-card focus:ring-1 focus:ring-ring focus:border-ring outline-none"
        />
      )}

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="p-1.5 text-muted-foreground hover:text-destructive rounded transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
