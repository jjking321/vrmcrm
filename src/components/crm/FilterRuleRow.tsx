import React from 'react';
import { FilterRule, FilterOperator, FieldDefinition, PipelineStage } from '@/types';
import { X } from 'lucide-react';

interface FilterRuleRowProps {
  rule: FilterRule;
  fields: FieldDefinition[];
  stages: PipelineStage[];
  onChange: (rule: FilterRule) => void;
  onRemove: () => void;
}

const OPERATORS: { value: FilterOperator; label: string; types: string[] }[] = [
  { value: 'equals', label: 'equals', types: ['text', 'number', 'select', 'checkbox'] },
  { value: 'contains', label: 'contains', types: ['text', 'email', 'url'] },
  { value: 'starts_with', label: 'starts with', types: ['text', 'email', 'url'] },
  { value: 'gt', label: 'greater than', types: ['number', 'date'] },
  { value: 'lt', label: 'less than', types: ['number', 'date'] },
  { value: 'is_set', label: 'is set', types: ['text', 'number', 'select', 'checkbox', 'date', 'email', 'url'] },
  { value: 'is_not_set', label: 'is not set', types: ['text', 'number', 'select', 'checkbox', 'date', 'email', 'url'] },
];

export const FilterRuleRow: React.FC<FilterRuleRowProps> = ({
  rule,
  fields,
  stages,
  onChange,
  onRemove,
}) => {
  const selectedField = fields.find(f => f.id === rule.field);
  const fieldType = selectedField?.type || 'text';
  
  const availableOperators = OPERATORS.filter(op => op.types.includes(fieldType));
  const showValueInput = rule.operator !== 'is_set' && rule.operator !== 'is_not_set';

  const renderValueInput = () => {
    if (!showValueInput) return null;

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
    if (fieldType === 'number' || ['leadScore', 'bedrooms', 'bathrooms', 'estimatedRevenue'].includes(rule.field)) {
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
        onChange={(e) => onChange({ ...rule, field: e.target.value, value: '' })}
        className="px-3 py-1.5 border border-input rounded-md text-sm bg-card focus:ring-1 focus:ring-brand focus:border-brand outline-none min-w-[140px]"
      >
        <option value="">Select field...</option>
        {fields.map(f => (
          <option key={f.id} value={f.id}>{f.label}</option>
        ))}
        <option value="city">City</option>
        <option value="state">State</option>
        <option value="ownerName">Owner Name</option>
        <option value="tags">Tags</option>
      </select>

      {/* Operator Selector */}
      <select
        value={rule.operator}
        onChange={(e) => onChange({ ...rule, operator: e.target.value as FilterOperator })}
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