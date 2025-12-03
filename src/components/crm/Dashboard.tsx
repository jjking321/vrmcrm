import React from 'react';
import { Property, PipelineStage, Activity } from '@/types';
import { 
  DollarSign, TrendingUp, Users, Building, Target, 
  BarChart3, Phone, Mail, FileText, Calendar, Star
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardProps {
  properties: Property[];
  stages: PipelineStage[];
  onSelectProperty: (id: string) => void;
  onViewChange: (view: 'properties' | 'owners' | 'kanban' | 'settings' | 'dashboard') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  properties,
  stages,
  onSelectProperty,
  onViewChange,
}) => {
  // Aggregate stats
  const totalRevenue = properties.reduce((sum, p) => sum + (p.marketData.projectedRevenue || 0), 0);
  const avgLeadScore = properties.length > 0 
    ? Math.round(properties.reduce((sum, p) => sum + p.leadScore, 0) / properties.length)
    : 0;
  const uniqueOwners = new Set(properties.map(p => p.owner.name)).size;

  // Pipeline breakdown
  const pipelineData = stages.map(stage => ({
    ...stage,
    count: properties.filter(p => p.stageId === stage.id).length,
    revenue: properties.filter(p => p.stageId === stage.id)
      .reduce((sum, p) => sum + (p.marketData.projectedRevenue || 0), 0),
  }));

  // Top leads
  const topLeads = [...properties]
    .sort((a, b) => b.leadScore - a.leadScore)
    .slice(0, 5);

  // High value properties
  const highValueProperties = [...properties]
    .sort((a, b) => (b.marketData.projectedRevenue || 0) - (a.marketData.projectedRevenue || 0))
    .slice(0, 5);

  // Recent activities (across all properties)
  const allActivities: (Activity & { propertyId: string; propertyAddress: string })[] = [];
  properties.forEach(p => {
    p.activities.forEach(a => {
      allActivities.push({ ...a, propertyId: p.id, propertyAddress: p.address });
    });
  });
  const recentActivities = allActivities
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone className="w-3.5 h-3.5" />;
      case 'email': return <Mail className="w-3.5 h-3.5" />;
      case 'meeting': return <Calendar className="w-3.5 h-3.5" />;
      case 'note': return <FileText className="w-3.5 h-3.5" />;
      default: return <FileText className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your property pipeline</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
              <Building className="w-5 h-5 text-brand" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Properties</p>
              <p className="text-2xl font-bold text-foreground">{properties.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Revenue Potential</p>
              <p className="text-2xl font-bold text-foreground">${totalRevenue.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <Target className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Lead Score</p>
              <p className="text-2xl font-bold text-foreground">{avgLeadScore}</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Unique Owners</p>
              <p className="text-2xl font-bold text-foreground">{uniqueOwners}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline Funnel */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-brand" />
            Pipeline Overview
          </h2>
          <button
            onClick={() => onViewChange('kanban')}
            className="text-sm text-brand hover:text-brand-600 font-medium"
          >
            View Pipeline →
          </button>
        </div>
        <div className="space-y-3">
          {pipelineData.map((stage, idx) => {
            const maxCount = Math.max(...pipelineData.map(s => s.count), 1);
            const percentage = (stage.count / maxCount) * 100;
            
            return (
              <div key={stage.id} className="flex items-center gap-4">
                <div className="w-32 flex-shrink-0">
                  <span className="text-sm font-medium text-foreground">{stage.name}</span>
                </div>
                <div className="flex-1 h-8 bg-muted rounded-lg overflow-hidden relative">
                  <div 
                    className="h-full rounded-lg transition-all duration-500"
                    style={{ 
                      width: `${percentage}%`, 
                      backgroundColor: stage.color,
                      opacity: 0.8
                    }}
                  />
                  <span className="absolute inset-0 flex items-center px-3 text-sm font-medium text-foreground">
                    {stage.count} properties
                  </span>
                </div>
                <div className="w-28 text-right text-sm text-emerald-600 font-medium">
                  ${stage.revenue.toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Leads */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              Top Leads
            </h2>
            <button
              onClick={() => onViewChange('properties')}
              className="text-sm text-brand hover:text-brand-600 font-medium"
            >
              View All →
            </button>
          </div>
          <div className="space-y-3">
            {topLeads.map((property) => (
              <div
                key={property.id}
                onClick={() => onSelectProperty(property.id)}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                  <img src={property.image} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{property.address}</p>
                  <p className="text-xs text-muted-foreground">{property.owner.name}</p>
                </div>
                <div className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-bold border",
                  property.leadScore >= 80 ? "text-emerald-700 bg-emerald-50 border-emerald-200" :
                  property.leadScore >= 50 ? "text-amber-700 bg-amber-50 border-amber-200" :
                  "text-muted-foreground bg-muted border-border"
                )}>
                  {property.leadScore}
                </div>
              </div>
            ))}
            {topLeads.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No properties yet</p>
            )}
          </div>
        </div>

        {/* High Value Properties */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              High Value Properties
            </h2>
          </div>
          <div className="space-y-3">
            {highValueProperties.map((property) => (
              <div
                key={property.id}
                onClick={() => onSelectProperty(property.id)}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                  <img src={property.image} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{property.address}</p>
                  <p className="text-xs text-muted-foreground">{property.city}, {property.state}</p>
                </div>
                <div className="flex items-center gap-1 text-emerald-600 font-semibold text-sm">
                  <DollarSign className="w-3.5 h-3.5" />
                  {(property.marketData.projectedRevenue || 0).toLocaleString()}
                </div>
              </div>
            ))}
            {highValueProperties.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No properties yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-soft">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-brand" />
          Recent Activity
        </h2>
        <div className="space-y-3">
          {recentActivities.map((activity) => (
            <div
              key={activity.id}
              onClick={() => onSelectProperty(activity.propertyId)}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                {getActivityIcon(activity.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">
                  <span className="font-medium capitalize">{activity.type}</span>
                  {' · '}
                  <span className="text-muted-foreground">{activity.propertyAddress}</span>
                </p>
                <p className="text-xs text-muted-foreground truncate">{activity.content}</p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(activity.date).toLocaleDateString()}
              </span>
            </div>
          ))}
          {recentActivities.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No activities yet</p>
          )}
        </div>
      </div>
    </div>
  );
};