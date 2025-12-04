import React, { useState } from 'react';
import { Property, PipelineStage } from '@/types';
import { MapPin, DollarSign, User } from 'lucide-react';
import { PropertyImage } from './PropertyImagePlaceholder';
import { cn } from '@/lib/utils';
import { getPrimaryOwnerName } from '@/lib/ownerUtils';

interface KanbanBoardProps {
  properties: Property[];
  stages: PipelineStage[];
  onMoveProperty: (propertyId: string, newStageId: string) => void;
  onSelectProperty: (id: string) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  properties,
  stages,
  onMoveProperty,
  onSelectProperty,
}) => {
  const [draggedPropertyId, setDraggedPropertyId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, propertyId: string) => {
    setDraggedPropertyId(propertyId);
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
    if (draggedPropertyId) {
      onMoveProperty(draggedPropertyId, stageId);
    }
    setDraggedPropertyId(null);
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
    };
    return colors[color] || 'text-gray-700 bg-gray-100';
  };

  return (
    <div className="flex gap-4 h-full overflow-x-auto pb-4">
      {stages.map((stage) => {
        const stageProperties = properties.filter(p => p.stageId === stage.id);
        const totalRevenue = stageProperties.reduce((sum, p) => sum + (p.marketData.projectedRevenue || 0), 0);

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
                  {stageProperties.length}
                </span>
              </div>
              <div className="text-xs mt-1 opacity-80">
                ${totalRevenue.toLocaleString()} potential
              </div>
            </div>

            {/* Cards */}
            <div className="p-2 space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto">
              {stageProperties.map((property) => (
                <div
                  key={property.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, property.id)}
                  onClick={() => onSelectProperty(property.id)}
                  className={cn(
                    "bg-card rounded-lg p-3 shadow-soft border border-border cursor-pointer hover:shadow-medium transition-all",
                    draggedPropertyId === property.id && "opacity-50"
                  )}
                >
                  {/* Property Image */}
                  <div className="relative w-full h-24 rounded-md overflow-hidden mb-2">
                    <PropertyImage 
                      src={property.image} 
                      alt={property.address}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1 right-1">
                      <span className={cn(
                        "text-xs font-bold px-1.5 py-0.5 rounded",
                        property.leadScore >= 80 ? "bg-emerald-500 text-white" :
                        property.leadScore >= 50 ? "bg-amber-500 text-white" :
                        "bg-slate-500 text-white"
                      )}>
                        {property.leadScore}
                      </span>
                    </div>
                  </div>

                  {/* Property Info */}
                  <div className="space-y-1.5">
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-brand mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-foreground leading-tight">{property.address}</p>
                        <p className="text-xs text-muted-foreground">{property.city}, {property.state}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 p-1.5 rounded">
                        <User className="w-3 h-3" />
                        <span className="truncate">{getPrimaryOwnerName(property.owner).split(' ')[0]}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 p-1.5 rounded">
                        <DollarSign className="w-3 h-3" />
                        <span>{(property.marketData.projectedRevenue / 1000).toFixed(0)}k</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {stageProperties.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Drop properties here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
