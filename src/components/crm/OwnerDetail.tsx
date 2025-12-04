import React from 'react';
import { Property, PipelineStage, Activity } from '@/types';
import { 
  ArrowLeft, Phone, Mail, MapPin, Building, DollarSign, 
  Target, Calendar, FileText, MessageSquare, AlertTriangle,
  PhoneOff, Clock, Home, Users
} from 'lucide-react';
import { Badge } from './Badge';
import { PropertyImage } from './PropertyImagePlaceholder';
import { cn } from '@/lib/utils';
import {
  getPrimaryOwnerName, getAllOwnerNames, getOwnerCount, getPrimaryPhone,
  hasDoNotCall, isLitigator, formatMailingAddress, formatOwnershipLength,
  getPhoneTypeBadgeClass, getOwnerTypeBadgeClass
} from '@/lib/ownerUtils';

interface OwnerDetailProps {
  ownerName: string;
  properties: Property[];
  stages: PipelineStage[];
  onBack: () => void;
  onSelectProperty: (id: string) => void;
  onSelectOwner?: (ownerName: string) => void;
}

export const OwnerDetail: React.FC<OwnerDetailProps> = ({
  ownerName,
  properties,
  stages,
  onBack,
  onSelectProperty,
  onSelectOwner,
}) => {
  // Find properties where any owner matches the name
  const ownerProperties = properties.filter(p => {
    const primaryName = getPrimaryOwnerName(p.owner);
    if (primaryName === ownerName) return true;
    
    // Also check additional owners
    if (p.owner.owners) {
      return p.owner.owners.some(o => `${o.firstName} ${o.lastName}`.trim() === ownerName);
    }
    
    return p.owner.name === ownerName;
  });
  
  const owner = ownerProperties[0]?.owner;

  if (!owner || ownerProperties.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Owner not found</p>
        <button onClick={onBack} className="mt-4 text-brand hover:underline">
          Go back
        </button>
      </div>
    );
  }

  // Aggregate stats
  const totalRevenue = ownerProperties.reduce((sum, p) => sum + (p.marketData.projectedRevenue || 0), 0);
  const avgLeadScore = Math.round(
    ownerProperties.reduce((sum, p) => sum + p.leadScore, 0) / ownerProperties.length
  );

  // Check compliance flags across all properties
  const anyLitigator = ownerProperties.some(p => isLitigator(p.owner));
  const anyDNC = ownerProperties.some(p => hasDoNotCall(p.owner));

  // Combine all activities
  const allActivities: (Activity & { propertyAddress: string; propertyId: string })[] = [];
  ownerProperties.forEach(p => {
    p.activities.forEach(a => {
      allActivities.push({ ...a, propertyAddress: p.address, propertyId: p.id });
    });
  });
  const sortedActivities = allActivities.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const getStage = (id: string) => stages.find(s => s.id === id);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone className="w-3.5 h-3.5" />;
      case 'email': return <Mail className="w-3.5 h-3.5" />;
      case 'meeting': return <Calendar className="w-3.5 h-3.5" />;
      case 'note': return <FileText className="w-3.5 h-3.5" />;
      default: return <MessageSquare className="w-3.5 h-3.5" />;
    }
  };

  // Get aggregated owner info
  const ownerCount = getOwnerCount(owner);
  const mailingAddr = formatMailingAddress(owner);
  const ownershipLength = formatOwnershipLength(owner.ownershipLengthMonths);

  return (
    <div className="animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-4 flex-1">
          <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center text-brand font-bold text-xl">
            {ownerName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              {ownerName}
              {ownerCount > 1 && (
                <span className="text-sm font-normal text-muted-foreground flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  +{ownerCount - 1} owner{ownerCount > 2 ? 's' : ''}
                </span>
              )}
            </h1>
            <p className="text-muted-foreground">
              {ownerProperties.length} {ownerProperties.length === 1 ? 'property' : 'properties'}
            </p>
          </div>
        </div>
        {/* Compliance badges */}
        <div className="flex gap-2">
          {anyLitigator && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 border border-red-200 rounded-full text-sm font-medium">
              <AlertTriangle className="w-4 h-4" />
              Litigator
            </div>
          )}
          {anyDNC && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 border border-amber-200 rounded-full text-sm font-medium">
              <PhoneOff className="w-4 h-4" />
              DNC
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Contact Info & Stats */}
        <div className="space-y-6">
          {/* Compliance Warnings */}
          {(anyLitigator || anyDNC) && (
            <div className="bg-card rounded-xl border border-border p-5 shadow-soft space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Compliance Warnings
              </h2>
              {anyLitigator && (
                <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-medium">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>LITIGATOR - Exercise caution when contacting</span>
                </div>
              )}
              {anyDNC && (
                <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs font-medium">
                  <PhoneOff className="w-4 h-4 flex-shrink-0" />
                  <span>Some phone numbers are on Do Not Call list</span>
                </div>
              )}
            </div>
          )}

          {/* Contact Card */}
          <div className="bg-card rounded-xl border border-border p-5 shadow-soft">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Contact Information
            </h2>
            <div className="space-y-3">
              {owner.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <a href={`mailto:${owner.email}`} className="text-sm text-brand hover:underline">
                    {owner.email}
                  </a>
                </div>
              )}
              
              {/* Multiple phones */}
              {owner.phones && owner.phones.length > 0 ? (
                owner.phones.map((phone, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    {phone.doNotCall ? (
                      <>
                        <PhoneOff className="w-4 h-4 text-amber-500" />
                        <span className="text-sm text-muted-foreground">{phone.number}</span>
                        <span className="px-1.5 py-0.5 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded font-medium">DNC</span>
                      </>
                    ) : (
                      <>
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <a href={`tel:${phone.number}`} className="text-sm text-brand hover:underline">
                          {phone.number}
                        </a>
                        {phone.type !== 'unknown' && (
                          <span className={cn("px-1.5 py-0.5 text-xs rounded border", getPhoneTypeBadgeClass(phone.type))}>
                            {phone.type}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                ))
              ) : owner.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <a href={`tel:${owner.phone}`} className="text-sm text-brand hover:underline">
                    {owner.phone}
                  </a>
                </div>
              )}
              
              {/* Mailing Address */}
              {mailingAddr && (
                <div className="flex items-start gap-3">
                  <Home className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <span className="text-sm text-foreground">{mailingAddr}</span>
                </div>
              )}
              
              {owner.lastVerifiedDate && (
                <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                  Last verified: {new Date(owner.lastVerifiedDate).toLocaleDateString()}
                </p>
              )}
            </div>
            </div>

          {/* All Owners Card */}
          {owner.owners && owner.owners.length > 1 && (
            <div className="bg-card rounded-xl border border-border p-5 shadow-soft">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                All Owners ({owner.owners.length})
              </h2>
              <div className="space-y-3">
                {owner.owners.map((ownerContact, idx) => {
                  const fullName = `${ownerContact.firstName} ${ownerContact.lastName}`.trim();
                  const associatedPhone = owner.phones?.[idx];
                  const isCurrentOwner = fullName === ownerName;
                  
                  return (
                    <div 
                      key={idx} 
                      className={cn(
                        "flex items-start gap-3 p-2.5 rounded-lg",
                        isCurrentOwner ? "bg-brand/5 border border-brand/20" : "bg-muted/30"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0",
                        isCurrentOwner ? "bg-brand/10 text-brand" : "bg-muted text-muted-foreground"
                      )}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        {isCurrentOwner ? (
                          <p className="font-medium text-sm text-brand">
                            {fullName || 'Unknown'}
                            <span className="text-xs ml-1.5">(viewing)</span>
                          </p>
                        ) : (
                          <button
                            onClick={() => onSelectOwner?.(fullName)}
                            className="font-medium text-sm text-foreground hover:text-brand hover:underline transition-colors text-left"
                          >
                            {fullName || 'Unknown'}
                          </button>
                        )}
                        {associatedPhone && (
                          <div className="flex items-center gap-1.5 mt-1">
                            {associatedPhone.doNotCall ? (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <PhoneOff className="w-3 h-3 text-amber-500" />
                                {associatedPhone.number}
                                <span className="px-1 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-medium">DNC</span>
                              </span>
                            ) : (
                              <a href={`tel:${associatedPhone.number}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-brand">
                                <Phone className="w-3 h-3" />
                                {associatedPhone.number}
                                {associatedPhone.type !== 'unknown' && (
                                  <span className={cn("px-1 py-0.5 rounded border text-xs", getPhoneTypeBadgeClass(associatedPhone.type))}>
                                    {associatedPhone.type}
                                  </span>
                                )}
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {(owner.ownerType || owner.ownershipLengthMonths || owner.ownerOccupied !== undefined) && (
            <div className="bg-card rounded-xl border border-border p-5 shadow-soft">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Ownership Details
              </h2>
              <div className="space-y-3">
                {owner.ownerType && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Type</span>
                    <span className={cn("px-2 py-0.5 text-xs font-medium rounded-full border", getOwnerTypeBadgeClass(owner.ownerType))}>
                      {owner.ownerType}
                    </span>
                  </div>
                )}
                {owner.ownershipLengthMonths && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Length</span>
                    <span className="text-sm font-medium text-foreground flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {ownershipLength}
                    </span>
                  </div>
                )}
                {owner.ownerOccupied !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Owner Occupied</span>
                    <span className={cn(
                      "px-2 py-0.5 text-xs font-medium rounded-full border",
                      owner.ownerOccupied ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-600 border-slate-200"
                    )}>
                      {owner.ownerOccupied ? 'Yes' : 'No'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stats Card */}
          <div className="bg-card rounded-xl border border-border p-5 shadow-soft">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Portfolio Stats
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building className="w-4 h-4" />
                  <span className="text-sm">Properties</span>
                </div>
                <span className="font-semibold text-foreground">{ownerProperties.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-sm">Total Revenue</span>
                </div>
                <span className="font-semibold text-emerald-600">${totalRevenue.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Target className="w-4 h-4" />
                  <span className="text-sm">Avg Lead Score</span>
                </div>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-bold border",
                  avgLeadScore >= 80 ? "text-emerald-700 bg-emerald-50 border-emerald-200" :
                  avgLeadScore >= 50 ? "text-amber-700 bg-amber-50 border-amber-200" :
                  "text-muted-foreground bg-muted border-border"
                )}>
                  {avgLeadScore}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {owner.notes && (
            <div className="bg-card rounded-xl border border-border p-5 shadow-soft">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Notes
              </h2>
              <p className="text-sm text-foreground whitespace-pre-wrap">{owner.notes}</p>
            </div>
          )}
        </div>

        {/* Middle Column - Properties */}
        <div className="lg:col-span-2 space-y-6">
          {/* Properties List */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Properties</h2>
            </div>
            <div className="divide-y divide-border">
              {ownerProperties.map(property => {
                const stage = getStage(property.stageId);
                const propLitigator = isLitigator(property.owner);
                const propDNC = hasDoNotCall(property.owner);
                
                return (
                  <div
                    key={property.id}
                    onClick={() => onSelectProperty(property.id)}
                    className="p-4 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                        <PropertyImage src={property.image} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-brand flex-shrink-0" />
                          <p className="font-medium text-foreground truncate">{property.address}</p>
                          {propLitigator && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                          {propDNC && <PhoneOff className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {property.city}, {property.state} {property.zip}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {stage && <Badge label={stage.name} color={stage.color} />}
                        <span className="text-sm text-emerald-600 font-medium">
                          ${(property.marketData.projectedRevenue || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Activity History</h2>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              {sortedActivities.length > 0 ? (
                <div className="space-y-4">
                  {sortedActivities.map(activity => (
                    <div key={activity.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground flex-shrink-0">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-foreground capitalize">
                            {activity.type}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(activity.date).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {activity.propertyAddress}
                        </p>
                        <p className="text-sm text-foreground mt-1">{activity.content}</p>
                        {activity.outcome && (
                          <p className="text-xs text-brand mt-1">Outcome: {activity.outcome}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No activities recorded yet
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
