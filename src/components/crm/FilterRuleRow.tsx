import React, { useState, useRef, useEffect } from 'react';
import { FilterRule, FilterOperator, FieldDefinition, PipelineStage } from '@/types';
import { X, ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TagBadge } from './Badge';
interface FilterRuleRowProps {
  rule: FilterRule;
  fields: FieldDefinition[];
  stages: PipelineStage[];
  availableTags?: string[];
  onChange: (rule: FilterRule) => void;
  onRemove: () => void;
}

const OPERATORS: { value: FilterOperator; label: string; types: string[] }[] = [
  { value: 'equals', label: 'is', types: ['text', 'number', 'select', 'checkbox'] },
  { value: 'not_equals', label: 'is not', types: ['text', 'number', 'select', 'checkbox'] },
  { value: 'contains', label: 'contains', types: ['text', 'email', 'url'] },
  { value: 'starts_with', label: 'starts with', types: ['text', 'email', 'url'] },
  { value: 'gt', label: 'greater than', types: ['number', 'date'] },
  { value: 'lt', label: 'less than', types: ['number', 'date'] },
  { value: 'any_of', label: 'is any of', types: ['tags', 'select'] },
  { value: 'not_any_of', label: 'is not any of', types: ['tags', 'select'] },
  { value: 'is_set', label: 'is set', types: ['text', 'number', 'select', 'checkbox', 'date', 'email', 'url', 'tags'] },
  { value: 'is_not_set', label: 'is not set', types: ['text', 'number', 'select', 'checkbox', 'date', 'email', 'url', 'tags'] },
];

export const FilterRuleRow: React.FC<FilterRuleRowProps> = ({
  rule,
  fields,
  stages,
  availableTags = [],
  onChange,
  onRemove,
}) => {
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedField = fields.find(f => f.id === rule.field);
  // Treat 'tags' field as a special type
  const fieldType = rule.field === 'tags' ? 'tags' : (selectedField?.type || 'text');
  
  const availableOperators = OPERATORS.filter(op => op.types.includes(fieldType));
  const showValueInput = rule.operator !== 'is_set' && rule.operator !== 'is_not_set';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowTagDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Parse selected tags from rule value
  const getSelectedTags = (): string[] => {
    if (!rule.value) return [];
    if (typeof rule.value === 'string') {
      return rule.value.split(',').filter(t => t.trim());
    }
    return [];
  };

  const toggleTag = (tag: string) => {
    const selected = getSelectedTags();
    const newSelected = selected.includes(tag)
      ? selected.filter(t => t !== tag)
      : [...selected, tag];
    onChange({ ...rule, value: newSelected.join(',') });
  };

  const renderValueInput = () => {
    if (!showValueInput) return null;

    // Tags multi-select with chips
    if (rule.field === 'tags' && (rule.operator === 'any_of' || rule.operator === 'not_any_of' || rule.operator === 'equals' || rule.operator === 'not_equals' || rule.operator === 'contains')) {
      const selectedTags = getSelectedTags();
      const unselectedTags = availableTags.filter(t => !selectedTags.includes(t));
      
      return (
        <div className="relative flex-1" ref={dropdownRef}>
          <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 border border-input rounded-md bg-card min-h-[34px]">
            {/* Selected tags as chips */}
            {selectedTags.map(tag => (
              <TagBadge key={tag} tag={tag} onRemove={() => toggleTag(tag)} />
            ))}
            
            {/* Add tag button */}
            <button
              type="button"
              onClick={() => setShowTagDropdown(!showTagDropdown)}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-brand hover:text-brand transition-colors",
                selectedTags.length === 0 && "text-muted-foreground"
              )}
            >
              <Plus className="w-3 h-3" />
              {selectedTags.length === 0 ? 'Select tags' : 'Add'}
            </button>
          </div>
          
          {showTagDropdown && unselectedTags.length > 0 && (
            <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
              {unselectedTags.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
          
          {showTagDropdown && unselectedTags.length === 0 && (
            <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded-md shadow-lg p-3">
              <p className="text-sm text-muted-foreground text-center">No more tags to add</p>
            </div>
          )}
        </div>
      );
    }

    // Stage selector
    if (rule.field === 'stageId') {
      return (
        <select
          value={rule.value as string}
          onChange={(e) => onChange({ ...rule, value: e.target.value })}
          className="flex-1 px-3 py-1.5 border border-input rounded-md text-sm bg-card focus:ring-1 focus:ring-brand focus:border-brand outline-none"
        >
          <option value="">Select stage...</option>
          {stages.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      );
    }

    // Select field with options
    if (selectedField?.options && selectedField.options.length > 0) {
      return (
        <select
          value={rule.value as string}
          onChange={(e) => onChange({ ...rule, value: e.target.value })}
          className="flex-1 px-3 py-1.5 border border-input rounded-md text-sm bg-card focus:ring-1 focus:ring-brand focus:border-brand outline-none"
        >
          <option value="">Select...</option>
          {selectedField.options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    // Number input
    if (fieldType === 'number' || ['bedrooms', 'bathrooms', 'estimatedRevenue'].includes(rule.field)) {
      return (
        <input
          type="number"
          value={rule.value as number}
          onChange={(e) => onChange({ ...rule, value: parseFloat(e.target.value) || 0 })}
          placeholder="Value"
          className="flex-1 px-3 py-1.5 border border-input rounded-md text-sm bg-card focus:ring-1 focus:ring-brand focus:border-brand outline-none"
        />
      );
    }

    // Date input
    if (fieldType === 'date') {
      return (
        <input
          type="date"
          value={rule.value as string}
          onChange={(e) => onChange({ ...rule, value: e.target.value })}
          className="flex-1 px-3 py-1.5 border border-input rounded-md text-sm bg-card focus:ring-1 focus:ring-brand focus:border-brand outline-none"
        />
      );
    }

    // Checkbox/boolean
    if (fieldType === 'checkbox') {
      return (
        <select
          value={rule.value as string}
          onChange={(e) => onChange({ ...rule, value: e.target.value })}
          className="flex-1 px-3 py-1.5 border border-input rounded-md text-sm bg-card focus:ring-1 focus:ring-brand focus:border-brand outline-none"
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    }

    // Default text input
    return (
      <input
        type="text"
        value={rule.value as string}
        onChange={(e) => onChange({ ...rule, value: e.target.value })}
        placeholder="Value"
        className="flex-1 px-3 py-1.5 border border-input rounded-md text-sm bg-card focus:ring-1 focus:ring-brand focus:border-brand outline-none"
      />
    );
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
      {/* Field Selector */}
      <select
        value={rule.field}
        onChange={(e) => {
          const newField = e.target.value;
          const newFieldType = newField === 'tags' ? 'tags' : (fields.find(f => f.id === newField)?.type || 'text');
          const validOperators = OPERATORS.filter(op => op.types.includes(newFieldType));
          const defaultOperator = validOperators[0]?.value || 'equals';
          onChange({ ...rule, field: newField, value: '', operator: defaultOperator });
        }}
        className="px-3 py-1.5 border border-input rounded-md text-sm bg-card focus:ring-1 focus:ring-brand focus:border-brand outline-none min-w-[140px]"
      >
        <option value="">Select field...</option>
        {fields.filter(f => {
          const fieldKey = (f as any).fieldKey || f.id;
          return !['tags', 'city', 'state', 'ownerName'].includes(fieldKey);
        }).map(f => (
          <option key={f.id} value={(f as any).fieldKey || f.id}>{f.label}</option>
        ))}
        <option value="city">City</option>
        <option value="state">State</option>
        <option value="ownerName">Owner Name</option>
        <option value="tags">Tags</option>
      </select>

      {/* Operator Selector */}
      <select
        value={rule.operator}
        onChange={(e) => onChange({ ...rule, operator: e.target.value as FilterOperator, value: '' })}
        className="px-3 py-1.5 border border-input rounded-md text-sm bg-card focus:ring-1 focus:ring-brand focus:border-brand outline-none min-w-[120px]"
      >
        {availableOperators.map(op => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>

      {/* Value Input */}
      {renderValueInput()}

      {/* Remove Button */}
      <button
        onClick={onRemove}
        className="p-1.5 text-muted-foreground hover:text-destructive rounded transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
