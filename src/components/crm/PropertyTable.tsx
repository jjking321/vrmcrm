import React from 'react';
import { Property, PipelineStage, FieldDefinition, SortConfig } from '@/types';
import { Badge, TagBadge } from './Badge';
import { PropertyImage } from './PropertyImagePlaceholder';
import { ArrowUpDown, ArrowUp, ArrowDown, MapPin, DollarSign, PhoneOff, AlertTriangle, Users, Ban, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPrimaryOwnerName, getOwnerCount, hasDoNotCall, isLitigator, formatMailingAddress } from '@/lib/ownerUtils';
import { useExcludedPropertyIds } from '@/hooks/useExclusionMatches';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PropertyTableProps {
  properties: Property[];
  allMatchingProperties?: Property[];
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
  allMatchingProperties,
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
  const excludedIds = useExcludedPropertyIds(properties);
  const getAlign = (colId: string): 'left' | 'right' => {
    if (['estimatedRevenue', 'bedrooms', 'bathrooms'].includes(colId)) return 'right';
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


  const getStage = (id: string) => stages.find(s => s.id === id);

  const renderCell = (property: Property, colId: string) => {
    const align = getAlign(colId);
    const cellClass = cn("px-4 py-3 text-sm", align === 'right' ? 'text-right' : 'text-left');

    if (colId === 'address') {
      const ownerIsLitigator = isLitigator(property.owner);
      const ownerHasDNC = hasDoNotCall(property.owner);
      const isExcluded = excludedIds.has(property.id);
      const isVerified = property.latitude !== null && property.longitude !== null;
      
      return (
        <td className={cellClass}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-muted relative">
              <PropertyImage src={property.image} className="w-full h-full object-cover" />
              {isExcluded && (
                <div className="absolute inset-0 bg-destructive/20 flex items-center justify-center">
                  <Ban className="w-5 h-5 text-destructive" />
                </div>
              )}
            </div>
            <div>
              <div className="font-medium text-foreground flex items-center gap-1.5">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {isVerified ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
                      )}
                    </TooltipTrigger>
                    <TooltipContent>
                      {isVerified ? 'Address verified' : 'Address not verified'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {property.address}
                {isExcluded && (
                  <span title="On exclusion list" className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-medium">
                    <Ban className="w-3 h-3" />
                    Excluded
                  </span>
                )}
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
      const visibleTags = property.tags.filter(tag => !tag.startsWith('list-'));
      return (
        <td className={cellClass}>
          <div className="flex flex-wrap gap-1">
            {visibleTags.slice(0, 3).map(tag => (
              <TagBadge key={tag} tag={tag} />
            ))}
            {visibleTags.length > 3 && (
              <span className="text-xs text-muted-foreground">+{visibleTags.length - 3}</span>
            )}
          </div>
        </td>
      );
    }

    if (colId === 'ownerName') {
      const primaryName = getPrimaryOwnerName(property.owner);
      const ownerCount = getOwnerCount(property.owner);
      const ownerHasDNC = hasDoNotCall(property.owner);
      const owners = property.owner.owners || [];
      const phones = property.owner.phones || [];
      
      // Get secondary owner name
      const secondaryOwner = owners.length > 1 ? owners[1] : null;
      const secondaryName = secondaryOwner ? `${secondaryOwner.firstName} ${secondaryOwner.lastName}`.trim() : null;
      
      // Get first two phones
      const phone1 = phones[0];
      const phone2 = phones[1];
      
      return (
        <td className={cellClass}>
          <div className="space-y-1.5">
            {/* Primary Owner + Phone 1 */}
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectOwner?.(primaryName);
                }}
                className="text-foreground hover:text-brand hover:underline transition-colors font-medium text-sm"
              >
                {primaryName}
              </button>
              {phone1 && (
              <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded",
                  phone1.doNotCall ? "bg-amber-50 text-muted-foreground border border-amber-200" : "bg-muted text-muted-foreground"
                )}>
                  {phone1.number}
                  {phone1.doNotCall && <PhoneOff className="w-2.5 h-2.5 inline ml-1" />}
                </span>
              )}
            </div>
            
            {/* Secondary Owner + Phone 2 (if exists) */}
            {(secondaryName || phone2) && (
              <div className="flex items-center gap-2">
                {secondaryName && (
                  <span className="text-xs text-muted-foreground">
                    {secondaryName}
                  </span>
                )}
                {phone2 && (
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded",
                    phone2.doNotCall ? "bg-amber-50 text-muted-foreground border border-amber-200" : "bg-muted text-muted-foreground"
                  )}>
                    {phone2.number}
                    {phone2.doNotCall && <PhoneOff className="w-2.5 h-2.5 inline ml-1" />}
                  </span>
                )}
              </div>
            )}
            
            {/* Additional owners indicator */}
            {ownerCount > 2 && (
              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                <Users className="w-3 h-3" />
                +{ownerCount - 2} more
              </span>
            )}
          </div>
        </td>
      );
    }

    if (colId === 'mailingAddress') {
      const mailingAddr = formatMailingAddress(property.owner);
      return (
        <td className={cellClass}>
          <span className="text-muted-foreground text-sm">
            {mailingAddr || '-'}
          </span>
        </td>
      );
    }

    // Default cell rendering
    const value = (property as any)[colId];
    return <td className={cellClass}>{value ?? '-'}</td>;
  };

  const allPageSelected = properties.length > 0 && properties.every(p => selectedIds.has(p.id));
  const totalMatchingCount = allMatchingProperties?.length || properties.length;
  const hasMoreThanPage = totalMatchingCount > properties.length;
  const showSelectAllBanner = allPageSelected && hasMoreThanPage && selectedIds.size === properties.length;

  return (
    <div className="bg-card rounded-xl shadow-soft border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="px-4 py-3 bg-muted/30 border-b border-border sticky top-0">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={() => {
                    if (allPageSelected) {
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
          {showSelectAllBanner && (
            <tbody>
              <tr>
                <td colSpan={visibleColumns.length + 1} className="px-4 py-2 bg-primary/10 border-b border-border">
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <span className="text-muted-foreground">
                      All {properties.length} properties on this page are selected.
                    </span>
                    <button
                      onClick={() => onSelectAll(allMatchingProperties!.map(p => p.id))}
                      className="text-primary font-medium hover:underline"
                    >
                      Select all {totalMatchingCount.toLocaleString()} matching properties
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          )}
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
