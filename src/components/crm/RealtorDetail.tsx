import React from 'react';
import { Realtor, Deal, Activity, ActivityType } from '@/types';
import { useRealtorActivities, useAddRealtorActivity, useEditRealtorActivity, useDeleteRealtorActivity } from '@/hooks/useRealtorActivities';
import { useDeals } from '@/hooks/useDeals';
import { usePipelineStages } from '@/hooks/usePipelineStages';
import {
  ArrowLeft, Phone, Mail, Building2, DollarSign, Loader2,
  Calendar, FileText, MessageSquare, LayoutGrid
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ActivityLog from './ActivityLog';

interface RealtorDetailProps {
  realtor: Realtor;
  onBack: () => void;
}

export const RealtorDetail: React.FC<RealtorDetailProps> = ({ realtor, onBack }) => {
  const { data: activities = [], isLoading: activitiesLoading } = useRealtorActivities(realtor.id);
  const addActivityMutation = useAddRealtorActivity();
  const editActivityMutation = useEditRealtorActivity();
  const deleteActivityMutation = useDeleteRealtorActivity();
  const { data: allDeals = [] } = useDeals();
  const { data: stages = [] } = usePipelineStages();

  const realtorDeals = allDeals.filter(d => d.realtorId === realtor.id);

  const getStage = (stageId: string) => stages.find(s => s.id === stageId);

  const handleAddActivity = (activity: Omit<Activity, 'id'>) => {
    addActivityMutation.mutate({
      realtorId: realtor.id,
      type: activity.type,
      content: activity.content,
    });
  };

  const handleEditActivity = (id: string, updates: { type?: string; content?: string; outcome?: string }) => {
    editActivityMutation.mutate({ id, updates });
  };

  const handleDeleteActivity = (id: string) => {
    deleteActivityMutation.mutate(id);
  };

  if (activitiesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-4 flex-1">
          <div className="w-14 h-14 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-600 font-bold text-xl">
            {realtor.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{realtor.name}</h1>
            <p className="text-muted-foreground">Realtor</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Contact Info */}
        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-5 shadow-soft">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Contact Info</h2>
            <div className="space-y-3">
              {realtor.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <a href={`tel:${realtor.phone}`} className="text-sm text-brand hover:underline">{realtor.phone}</a>
                </div>
              )}
              {realtor.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <a href={`mailto:${realtor.email}`} className="text-sm text-brand hover:underline">{realtor.email}</a>
                </div>
              )}
              {!realtor.phone && !realtor.email && (
                <p className="text-sm text-muted-foreground">No contact info</p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="bg-card rounded-xl border border-border p-5 shadow-soft">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Stats</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <LayoutGrid className="w-4 h-4" />
                  <span className="text-sm">Deals</span>
                </div>
                <span className="font-semibold text-foreground">{realtorDeals.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-sm">Total Value</span>
                </div>
                <span className="font-semibold text-emerald-600">
                  ${realtorDeals.reduce((sum, d) => sum + (d.dealValue || 0), 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {realtor.notes && (
            <div className="bg-card rounded-xl border border-border p-5 shadow-soft">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Notes</h2>
              <p className="text-sm text-foreground whitespace-pre-wrap">{realtor.notes}</p>
            </div>
          )}
        </div>

        {/* Right Column - Deals & Activities */}
        <div className="lg:col-span-2 space-y-6">
          {/* Deals */}
          {realtorDeals.length > 0 && (
            <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
              <div className="p-4 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">Pipeline Deals</h2>
              </div>
              <div className="divide-y divide-border">
                {realtorDeals.map(deal => {
                  const stage = getStage(deal.stageId);
                  return (
                    <div key={deal.id} className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">{deal.contactName}</p>
                          <div className="flex items-center gap-3 mt-1">
                            {deal.contactPhone && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="w-3 h-3" /> {deal.contactPhone}
                              </span>
                            )}
                            {deal.contactEmail && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Mail className="w-3 h-3" /> {deal.contactEmail}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {stage && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              {stage.name}
                            </span>
                          )}
                          {deal.dealValue != null && deal.dealValue > 0 && (
                            <span className="text-sm text-emerald-600 font-medium">
                              ${deal.dealValue.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Activity Timeline */}
          <ActivityLog
            activities={activities}
            onAddActivity={handleAddActivity}
            onEditActivity={handleEditActivity}
            onDeleteActivity={handleDeleteActivity}
          />
        </div>
      </div>
    </div>
  );
};
