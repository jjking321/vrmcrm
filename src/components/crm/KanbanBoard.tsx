import React, { useState } from 'react';
import { Property, PipelineStage, Deal, Realtor } from '@/types';
import { MapPin, DollarSign, User, Ban, Plus, Phone, Mail, Building2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { getPrimaryOwnerName } from '@/lib/ownerUtils';
import { useExcludedPropertyIds } from '@/hooks/useExclusionMatches';
import { Button } from '@/components/ui/button';

interface KanbanBoardProps {
  properties: Property[];
  stages: PipelineStage[];
  onMoveProperty: (propertyId: string, newStageId: string) => void;
  onSelectProperty: (id: string) => void;
  onNewDeal?: () => void;
  deals?: Deal[];
  onMoveDeal?: (dealId: string, newStageId: string) => void;
  realtors?: Realtor[];
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  properties,
  stages,
  onMoveProperty,
  onSelectProperty,
  onNewDeal,
  deals = [],
  onMoveDeal,
}) => {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [draggedType, setDraggedType] = useState<'property' | 'deal' | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const excludedIds = useExcludedPropertyIds(properties);

  const handleDragStart = (e: React.DragEvent, id: string, type: 'property' | 'deal') => {
    setDraggedId(id);
    setDraggedType(type);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStageId(stageId);
  };

  const handleDragLeave = () => {
    setDragOverStageId(null);
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    if (draggedId) {
      if (draggedType === 'deal' && onMoveDeal) {
        onMoveDeal(draggedId, stageId);
      } else if (draggedType === 'property') {
        onMoveProperty(draggedId, stageId);
      }
    }
    setDraggedId(null);
    setDraggedType(null);
    setDragOverStageId(null);
  };

  const getStageColor = (color: string) => {
    const colors: Record<string, string> = {
      slate: 'border-slate-300 bg-slate-50',
      blue: 'border-blue-300 bg-blue-50',
      amber: 'border-amber-300 bg-amber-50',
      violet: 'border-violet-300 bg-violet-50',
      cyan: 'border-cyan-300 bg-cyan-50',
      emerald: 'border-emerald-300 bg-emerald-50',
      teal: 'border-teal-300 bg-teal-50',
    };
    return colors[color] || 'border-gray-300 bg-gray-50';
  };

  const getHeaderColor = (color: string) => {
    const colors: Record<string, string> = {
      slate: 'text-slate-700 bg-slate-100',
      blue: 'text-blue-700 bg-blue-100',
      amber: 'text-amber-700 bg-amber-100',
      violet: 'text-violet-700 bg-violet-100',
      cyan: 'text-cyan-700 bg-cyan-100',
      emerald: 'text-emerald-700 bg-emerald-100',
      teal: 'text-teal-700 bg-teal-100',
    };
    return colors[color] || 'text-gray-700 bg-gray-100';
  };

  return (
    <div className="flex flex-col h-full">
      {onNewDeal && (
        <div className="flex justify-end mb-4">
          <Button onClick={onNewDeal} className="gap-2">
            <Plus className="w-4 h-4" />
            New Deal
          </Button>
        </div>
      )}
      <div className="flex gap-4 flex-1 overflow-x-auto pb-4">
      {stages.map((stage) => {
        const stageProperties = properties.filter(p => p.stageId === stage.id);
        const stageDeals = deals.filter(d => d.stageId === stage.id);
        const totalRevenue = stageProperties.reduce((sum, p) => sum + (p.marketData.projectedRevenue || 0), 0);
        const totalDealValue = stageDeals.reduce((sum, d) => sum + (d.dealValue || 0), 0);
        const itemCount = stageProperties.length + stageDeals.length;

        return (
          <div
            key={stage.id}
            className={cn(
              "flex-shrink-0 w-72 rounded-xl border-2 transition-all",
              dragOverStageId === stage.id ? 'border-brand shadow-brand' : getStageColor(stage.color)
            )}
            onDragOver={(e) => handleDragOver(e, stage.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, stage.id)}
          >
            {/* Stage Header */}
            <div className={cn("p-3 rounded-t-lg border-b", getHeaderColor(stage.color))}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{stage.name}</h3>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/60">
                  {itemCount}
                </span>
              </div>
              <div className="text-xs mt-1 opacity-80">
                ${(totalRevenue + totalDealValue).toLocaleString()} potential
              </div>
            </div>

            {/* Cards */}
            <div className="p-2 space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto">
              {/* Deal Cards */}
              {stageDeals.map((deal) => (
                <div
                  key={`deal-${deal.id}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, deal.id, 'deal')}
                  className={cn(
                    "bg-card rounded-lg p-3 shadow-soft border cursor-grab hover:shadow-medium transition-all border-primary/20",
                    draggedId === deal.id && draggedType === 'deal' && "opacity-50"
                  )}
                >
                  <div className="bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded flex items-center gap-1 w-fit mb-2">
                    <User className="w-3 h-3" />
                    Contact Deal
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-start gap-1.5">
                      <User className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm font-medium text-foreground leading-tight">{deal.contactName || 'Unnamed'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        {deal.contactPhone && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 p-1.5 rounded">
                            <Phone className="w-3 h-3" />
                            <span className="truncate">{deal.contactPhone}</span>
                          </div>
                        )}
                        {deal.contactEmail && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 p-1.5 rounded">
                            <Mail className="w-3 h-3" />
                            <span className="truncate">{deal.contactEmail}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {deal.dealValue != null && deal.dealValue > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 p-1.5 rounded w-fit">
                        <DollarSign className="w-3 h-3" />
                        <span>{deal.dealValue.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Property Cards */}
              {stageProperties.map((property) => {
                const isExcluded = excludedIds.has(property.id);
                return (
                  <div
                    key={property.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, property.id, 'property')}
                    onClick={() => onSelectProperty(property.id)}
                    className={cn(
                      "bg-card rounded-lg p-3 shadow-soft border cursor-pointer hover:shadow-medium transition-all",
                      draggedId === property.id && draggedType === 'property' && "opacity-50",
                      isExcluded ? "border-destructive/50 bg-destructive/5" : "border-border"
                    )}
                  >
                    {/* Excluded Badge */}
                    {isExcluded && (
                      <div className="bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5 rounded flex items-center gap-1 w-fit mb-2">
                        <Ban className="w-3 h-3" />
                        Excluded
                      </div>
                    )}

                    {/* Property Info */}
                    <div className="space-y-1.5">
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-brand mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-foreground leading-tight">{property.address}</p>
                          <p className="text-xs text-muted-foreground">{property.city}, {property.state}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 p-1.5 rounded">
                            <User className="w-3 h-3" />
                            <span className="truncate">{getPrimaryOwnerName(property.owner)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 p-1.5 rounded">
                            <DollarSign className="w-3 h-3" />
                            <span>{(property.marketData.projectedRevenue / 1000).toFixed(0)}k</span>
                          </div>
                        </div>
                        {(property.owner?.phone || property.owner?.phones?.[0]?.number) && (
                          <a
                            href={`tel:${property.owner?.phones?.[0]?.number || property.owner?.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {itemCount === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Drop deals here
                </div>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
};
