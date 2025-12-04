import React from 'react';
import { Property, PipelineStage, FieldDefinition, SortConfig } from '@/types';
import { Badge, TagBadge } from './Badge';
import { PropertyImage } from './PropertyImagePlaceholder';
import { ArrowUpDown, ArrowUp, ArrowDown, MapPin, DollarSign, PhoneOff, AlertTriangle, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPrimaryOwnerName, getOwnerCount, getPrimaryPhone, hasDoNotCall, isLitigator } from '@/lib/ownerUtils';

interface PropertyTableProps {
  properties: Property[];
  onSelectProperty: (id: string) => void;
  sortConfig: SortConfig;
  onSort: (field: string) => void;
  visibleColumns: string[];
  stages: PipelineStage[];
  fields: FieldDefinition[];
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onSelectOwner?: (ownerName: string) => void;
}

export const PropertyTable: React.FC<PropertyTableProps> = ({
  properties,
  onSelectProperty,
  sortConfig,
  onSort,
  visibleColumns,
  stages,
  fields,
  selectedIds,
  onToggleSelection,
  onSelectAll,
  onSelectOwner,
}) => {
  const getAlign = (colId: string): 'left' | 'right' => {
    if (['leadScore', 'estimatedRevenue', 'bedrooms', 'bathrooms'].includes(colId)) return 'right';
    return 'left';
  };

  const getSortIcon = (colId: string) => {
    if (sortConfig.field !== colId) return <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-60 transition-opacity" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-brand" />
      : <ArrowDown className="w-3 h-3 text-brand" />;
  };

  const getColumnLabel = (colId: string) => {
    const field = fields.find(f => f.id === colId);
    if (field) return field.label;
    if (colId === 'estimatedRevenue') return 'Est. Revenue';
    if (colId === 'ownerName') return 'Owner';
    return colId.charAt(0).toUpperCase() + colId.slice(1);
  };

  const renderHeader = (colId: string) => {
    const label = getColumnLabel(colId);
    const align = getAlign(colId);

    return (
      <th
        key={colId}
        onClick={() => onSort(colId)}
        className={cn(
          "px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors group border-b border-border bg-muted/30 sticky top-0",
          align === 'right' ? 'text-right' : 'text-left'
        )}
      >
        <div className={cn("flex items-center gap-1.5", align === 'right' && 'justify-end')}>
          {label}
          {getSortIcon(colId)}
        </div>
      </th>
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (score >= 50) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-muted-foreground bg-muted border-border';
  };

  const getStage = (id: string) => stages.find(s => s.id === id);

  const renderCell = (property: Property, colId: string) => {
    const align = getAlign(colId);
    const cellClass = cn("px-4 py-3 text-sm", align === 'right' ? 'text-right' : 'text-left');

    if (colId === 'address') {
      const ownerIsLitigator = isLitigator(property.owner);
      const ownerHasDNC = hasDoNotCall(property.owner);
      
      return (
        <td className={cellClass}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
              <PropertyImage src={property.image} className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="font-medium text-foreground flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-brand" />
                {property.address}
                {ownerIsLitigator && <span title="Litigator"><AlertTriangle className="w-3.5 h-3.5 text-red-500" /></span>}
                {ownerHasDNC && <span title="Do Not Call"><PhoneOff className="w-3.5 h-3.5 text-amber-500" /></span>}
              </div>
              <div className="text-xs text-muted-foreground">{property.bedrooms}BR / {property.bathrooms}BA</div>
            </div>
          </div>
        </td>
      );
    }

    if (colId === 'stageId') {
      const stage = getStage(property.stageId);
      return (
        <td className={cellClass}>
          {stage && <Badge label={stage.name} color={stage.color} />}
        </td>
      );
    }

    if (colId === 'leadScore') {
      return (
        <td className={cellClass}>
          <span className={cn("inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-full border", getScoreColor(property.leadScore))}>
            {property.leadScore}
          </span>
        </td>
      );
    }

    if (colId === 'estimatedRevenue') {
      return (
        <td className={cellClass}>
          <div className="flex items-center justify-end gap-1 text-emerald-700 font-medium">
            <DollarSign className="w-3.5 h-3.5" />
            {(property.marketData.projectedRevenue || 0).toLocaleString()}
          </div>
        </td>
      );
    }

    if (colId === 'tags') {
      return (
        <td className={cellClass}>
          <div className="flex flex-wrap gap-1">
            {property.tags.slice(0, 3).map(tag => (
              <TagBadge key={tag} tag={tag} />
            ))}
            {property.tags.length > 3 && (
              <span className="text-xs text-muted-foreground">+{property.tags.length - 3}</span>
            )}
          </div>
        </td>
      );
    }

    if (colId === 'ownerName') {
      const primaryName = getPrimaryOwnerName(property.owner);
      const ownerCount = getOwnerCount(property.owner);
      const primaryPhone = getPrimaryPhone(property.owner);
      const ownerHasDNC = hasDoNotCall(property.owner);
      
      return (
        <td className={cellClass}>
          <div className="space-y-0.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectOwner?.(primaryName);
              }}
              className="text-foreground hover:text-brand hover:underline transition-colors flex items-center gap-1"
            >
              {primaryName}
              {ownerCount > 1 && (
                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                  <Users className="w-3 h-3" />
                  +{ownerCount - 1}
                </span>
              )}
            </button>
            {primaryPhone && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                {ownerHasDNC && <PhoneOff className="w-3 h-3 text-amber-500" />}
                {primaryPhone.number}
              </div>
            )}
          </div>
        </td>
      );
    }

    // Default cell rendering
    const value = (property as any)[colId];
    return <td className={cellClass}>{value ?? '-'}</td>;
  };

  const allSelected = properties.length > 0 && properties.every(p => selectedIds.has(p.id));

  return (
    <div className="bg-card rounded-xl shadow-soft border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="px-4 py-3 bg-muted/30 border-b border-border sticky top-0">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => {
                    if (allSelected) {
                      onSelectAll([]);
                    } else {
                      onSelectAll(properties.map(p => p.id));
                    }
                  }}
                  className="w-4 h-4 rounded border-border text-brand focus:ring-brand"
                />
              </th>
              {visibleColumns.map(col => renderHeader(col))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {properties.map((property) => (
              <tr
                key={property.id}
                className="hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => onSelectProperty(property.id)}
              >
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(property.id)}
                    onChange={() => onToggleSelection(property.id)}
                    className="w-4 h-4 rounded border-border text-brand focus:ring-brand"
                  />
                </td>
                {visibleColumns.map(col => renderCell(property, col))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {properties.length === 0 && (
        <div className="p-12 text-center text-muted-foreground">
          <p>No properties found matching your filters.</p>
        </div>
      )}
    </div>
  );
};
