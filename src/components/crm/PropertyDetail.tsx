import React, { useState } from 'react';
import { Property, PipelineStage, FieldDefinition, Activity, Owner, PhoneContact, OwnerContact } from '@/types';
import ActivityLog from './ActivityLog';
import MarketingGenerator from './MarketingGenerator';
import { Badge, TagBadge } from './Badge';
import { PropertyImage } from './PropertyImagePlaceholder';
import { fetchZillowData, fetchAirbnbEstimate, applyZillowData, applyAirROIData } from '@/lib/enrichment';
import { 
  getPrimaryOwnerName, getAllOwnerNames, getOwnerCount, getPrimaryPhone, 
  getCallablePhones, hasDoNotCall, isLitigator, formatMailingAddress,
  formatOwnershipLength, getPhoneTypeBadgeClass, getOwnerTypeBadgeClass
} from '@/lib/ownerUtils';
import { 
  MapPin, BedDouble, Bath, DollarSign, User, Mail, Phone, 
  ArrowLeft, Save, X, Tag, Plus, ExternalLink, Star, 
  TrendingUp, Home, Pencil, Ruler, Users, Calendar, RefreshCw, Loader2,
  AlertTriangle, PhoneOff, Clock, Building, Link
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PropertyDetailProps {
  property: Property;
  stages: PipelineStage[];
  fields: FieldDefinition[];
  onBack: () => void;
  onUpdateProperty: (id: string, updates: Partial<Property>) => void;
}

const PropertyDetail: React.FC<PropertyDetailProps> = ({
  property,
  stages,
  fields,
  onBack,
  onUpdateProperty,
}) => {
  const [isEditingOwner, setIsEditingOwner] = useState(false);
  const [editedOwner, setEditedOwner] = useState(property.owner);
  const [newTag, setNewTag] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isLoadingZillow, setIsLoadingZillow] = useState(false);
  const [isLoadingAirROI, setIsLoadingAirROI] = useState(false);

  const handleFetchZillow = async () => {
    setIsLoadingZillow(true);
    try {
      const result = await fetchZillowData(property);
      if (result.success && result.data) {
        const updates = applyZillowData(property, result.data);
        onUpdateProperty(property.id, updates);
        toast.success('Property data enriched from Zillow');
      } else {
        toast.error(result.error || 'Failed to fetch Zillow data');
      }
    } catch (err) {
      toast.error('Failed to fetch Zillow data');
    } finally {
      setIsLoadingZillow(false);
    }
  };

  const handleFetchAirROI = async () => {
    setIsLoadingAirROI(true);
    try {
      const result = await fetchAirbnbEstimate(property);
      if (result.success && result.data) {
        const updates = applyAirROIData(property, result.data);
        onUpdateProperty(property.id, updates);
        toast.success('Revenue data enriched from AirROI');
      } else {
        toast.error(result.error || 'Failed to fetch revenue data');
      }
    } catch (err) {
      toast.error('Failed to fetch revenue data');
    } finally {
      setIsLoadingAirROI(false);
    }
  };

  const handleSaveOwner = () => {
    onUpdateProperty(property.id, { owner: editedOwner });
    setIsEditingOwner(false);
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTag.trim() && !property.tags.includes(newTag.trim().toLowerCase())) {
      onUpdateProperty(property.id, { tags: [...property.tags, newTag.trim().toLowerCase()] });
      setNewTag('');
      setIsAddingTag(false);
    }
  };

  const handleRemoveTag = (tag: string) => {
    onUpdateProperty(property.id, { tags: property.tags.filter(t => t !== tag) });
  };

  const handleAddActivity = (activity: Omit<Activity, 'id'>) => {
    const newActivity: Activity = {
      ...activity,
      id: `act_${Date.now()}`,
    };
    onUpdateProperty(property.id, { activities: [...property.activities, newActivity] });
  };

  const handleStageChange = (stageId: string) => {
    onUpdateProperty(property.id, { stageId });
  };

  const currentStage = stages.find(s => s.id === property.stageId);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const safeDist = property.marketData.monthlyRevenueDistribution || Array(12).fill(8.33);
  const maxRevenueShare = Math.max(...safeDist, 1);

  // Owner helper values
  const ownerCount = getOwnerCount(property.owner);
  const primaryName = getPrimaryOwnerName(property.owner);
  const allNames = getAllOwnerNames(property.owner);
  const primaryPhone = getPrimaryPhone(property.owner);
  const callablePhones = getCallablePhones(property.owner);
  const hasDNC = hasDoNotCall(property.owner);
  const ownerIsLitigator = isLitigator(property.owner);
  const mailingAddr = formatMailingAddress(property.owner);
  const ownershipLength = formatOwnershipLength(property.owner.ownershipLengthMonths);

  return (
    <div className="animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MapPin className="w-6 h-6 text-brand" />
            {property.address}
          </h1>
          <p className="text-muted-foreground">{property.city}, {property.state} {property.zip}</p>
        </div>
        {ownerIsLitigator && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 border border-red-200 rounded-full text-sm font-medium">
            <AlertTriangle className="w-4 h-4" />
            Litigator
          </div>
        )}
        {currentStage && <Badge label={currentStage.name} color={currentStage.color} className="text-sm" />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Property Info & Activities */}
        <div className="lg:col-span-2 space-y-6">
          {/* Property Image & Quick Stats */}
          <div className="bg-card rounded-xl shadow-soft border border-border overflow-hidden">
          <div className="relative h-64">
              <PropertyImage src={property.image} alt={property.address} className="w-full h-full object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                <div className="flex items-center gap-4 text-white">
                  <div className="flex items-center gap-1">
                    <BedDouble className="w-4 h-4" />
                    <span className="font-medium">{property.bedrooms} Beds</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Bath className="w-4 h-4" />
                    <span className="font-medium">{property.bathrooms} Baths</span>
                  </div>
                  {property.guests && (
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span className="font-medium">{property.guests} Guests</span>
                    </div>
                  )}
                  {property.squareFeet && (
                    <div className="flex items-center gap-1">
                      <Ruler className="w-4 h-4" />
                      <span className="font-medium">{property.squareFeet.toLocaleString()} sqft</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stage Selector & Tags */}
            <div className="p-4 border-t border-border">
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-medium text-muted-foreground">Pipeline Stage</label>
                <select
                  value={property.stageId}
                  onChange={(e) => handleStageChange(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-input rounded-lg bg-card focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none"
                >
                  {stages.map(stage => (
                    <option key={stage.id} value={stage.id}>{stage.name}</option>
                  ))}
                </select>
              </div>

              {/* Tags */}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {property.tags.map(tag => (
                    <TagBadge key={tag} tag={tag} onRemove={() => handleRemoveTag(tag)} />
                  ))}
                  {isAddingTag ? (
                    <form onSubmit={handleAddTag} className="flex items-center gap-1">
                      <input
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        className="px-2 py-1 w-28 text-xs border border-input rounded-md bg-card focus:border-brand outline-none"
                        placeholder="New tag..."
                        autoFocus
                      />
                      <button type="submit" className="text-emerald-600 hover:text-emerald-700">
                        <Save className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => setIsAddingTag(false)} className="text-destructive">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => setIsAddingTag(true)}
                      className="px-2.5 py-1 border border-dashed border-border rounded-full text-xs text-muted-foreground hover:text-brand hover:border-brand flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Add Tag
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Activity Log */}
          <ActivityLog activities={property.activities} onAddActivity={handleAddActivity} />
        </div>

        {/* Right Column - Owner & Market Data */}
        <div className="space-y-6">
          {/* Owner Card - Enhanced */}
          <div className="bg-card rounded-xl shadow-soft border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <User className="w-4 h-4 text-brand" />
                Owner Details
                {ownerCount > 1 && (
                  <span className="text-xs px-1.5 py-0.5 bg-muted rounded-full text-muted-foreground">
                    {ownerCount} owners
                  </span>
                )}
              </h3>
              {!isEditingOwner && (
                <button
                  onClick={() => setIsEditingOwner(true)}
                  className="p-1.5 text-muted-foreground hover:text-brand rounded transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Compliance Warnings */}
            {(ownerIsLitigator || hasDNC) && (
              <div className="mb-4 space-y-2">
                {ownerIsLitigator && (
                  <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-medium">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>LITIGATOR - Exercise caution when contacting</span>
                  </div>
                )}
                {hasDNC && (
                  <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs font-medium">
                    <PhoneOff className="w-4 h-4 flex-shrink-0" />
                    <span>Some phone numbers are on Do Not Call list</span>
                  </div>
                )}
              </div>
            )}

            {isEditingOwner ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={editedOwner.name}
                  onChange={(e) => setEditedOwner({ ...editedOwner, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-card focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none"
                  placeholder="Owner name"
                />
                <input
                  type="email"
                  value={editedOwner.email}
                  onChange={(e) => setEditedOwner({ ...editedOwner, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-card focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none"
                  placeholder="Email"
                />
                <input
                  type="tel"
                  value={editedOwner.phone}
                  onChange={(e) => setEditedOwner({ ...editedOwner, phone: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-card focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none"
                  placeholder="Phone"
                />
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleSaveOwner}
                    className="flex-1 px-3 py-2 bg-brand text-brand-foreground rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setIsEditingOwner(false); setEditedOwner(property.owner); }}
                    className="px-3 py-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Owner Names */}
                <div>
                  <p className="font-medium text-foreground">{primaryName}</p>
                  {property.owner.owners && property.owner.owners.length > 1 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Also: {property.owner.owners.slice(1).map(o => `${o.firstName} ${o.lastName}`).join(', ')}
                    </p>
                  )}
                </div>

                {/* Owner Type & Metadata */}
                <div className="flex flex-wrap gap-2">
                  {property.owner.ownerType && (
                    <span className={cn("px-2 py-0.5 text-xs font-medium rounded-full border", getOwnerTypeBadgeClass(property.owner.ownerType))}>
                      {property.owner.ownerType}
                    </span>
                  )}
                  {property.owner.ownerOccupied && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                      Owner Occupied
                    </span>
                  )}
                  {property.owner.ownershipLengthMonths && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full border bg-slate-50 text-slate-600 border-slate-200 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {ownershipLength}
                    </span>
                  )}
                </div>

                {/* Email */}
                {property.owner.email && (
                  <a href={`mailto:${property.owner.email}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-brand transition-colors">
                    <Mail className="w-4 h-4" />
                    {property.owner.email}
                  </a>
                )}

                {/* Phones */}
                <div className="space-y-2">
                  {property.owner.phones && property.owner.phones.length > 0 ? (
                    property.owner.phones.map((phone, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        {phone.doNotCall ? (
                          <div className="flex items-center gap-2 text-sm text-red-600">
                            <PhoneOff className="w-4 h-4" />
                            <span className="line-through">{phone.number}</span>
                            <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded font-medium">DNC</span>
                          </div>
                        ) : (
                          <a href={`tel:${phone.number}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-brand transition-colors">
                            <Phone className="w-4 h-4" />
                            {phone.number}
                            {phone.type !== 'unknown' && (
                              <span className={cn("px-1.5 py-0.5 text-xs rounded border", getPhoneTypeBadgeClass(phone.type))}>
                                {phone.type}
                              </span>
                            )}
                          </a>
                        )}
                      </div>
                    ))
                  ) : property.owner.phone ? (
                    <a href={`tel:${property.owner.phone}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-brand transition-colors">
                      <Phone className="w-4 h-4" />
                      {property.owner.phone}
                    </a>
                  ) : null}
                </div>

                {/* Mailing Address */}
                {mailingAddr && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Home className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{mailingAddr}</span>
                  </div>
                )}

                {/* Property URL */}
                {property.propertyUrl && (
                  <a 
                    href={property.propertyUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-brand hover:text-brand-600 transition-colors"
                  >
                    <Link className="w-4 h-4" />
                    View Property Record
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Market Intelligence */}
          <div className="bg-card rounded-xl shadow-soft border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-brand" />
                Market Intelligence
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handleFetchZillow}
                  disabled={isLoadingZillow}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-input rounded-lg hover:bg-muted/50 disabled:opacity-50 transition-colors"
                  title="Fetch from Zillow"
                >
                  {isLoadingZillow ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Zillow
                </button>
                <button
                  onClick={handleFetchAirROI}
                  disabled={isLoadingAirROI}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-input rounded-lg hover:bg-muted/50 disabled:opacity-50 transition-colors"
                  title="Fetch from AirROI"
                >
                  {isLoadingAirROI ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  AirROI
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                  <p className="text-xs text-emerald-600 font-medium mb-1">Est. Annual Revenue</p>
                  <p className="text-lg font-bold text-emerald-700">${property.marketData.projectedRevenue.toLocaleString()}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <p className="text-xs text-blue-600 font-medium mb-1">Property Value</p>
                  <p className="text-lg font-bold text-blue-700">${property.marketData.propertyValue.toLocaleString()}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                  <p className="text-xs text-amber-600 font-medium mb-1">ADR</p>
                  <p className="text-lg font-bold text-amber-700">${property.marketData.adr}</p>
                </div>
                <div className="bg-violet-50 rounded-lg p-3 border border-violet-100">
                  <p className="text-xs text-violet-600 font-medium mb-1">Occupancy</p>
                  <p className="text-lg font-bold text-violet-700">{property.marketData.occupancyRate}%</p>
                </div>
              </div>

              {/* Rating */}
              {property.marketData.airbnbRating && (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Airbnb Rating</span>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span className="font-semibold text-foreground">{property.marketData.airbnbRating}</span>
                    <span className="text-xs text-muted-foreground">({property.marketData.reviewCount} reviews)</span>
                  </div>
                </div>
              )}

              {/* Seasonality Chart */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Seasonality
                </h4>
                <div className="flex items-end h-24 gap-1">
                  {safeDist.map((value, idx) => {
                    const heightPercentage = Math.max((value / maxRevenueShare) * 100, 5);
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full bg-brand/70 rounded-t hover:bg-brand transition-colors"
                          style={{ height: `${heightPercentage}%` }}
                          title={`${months[idx]}: ${value.toFixed(1)}%`}
                        />
                        <span className="text-[9px] text-muted-foreground">{months[idx].charAt(0)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* External Links */}
              {(property.airbnbUrl || property.zillowUrl) && (
                <div className="flex gap-2 pt-2">
                  {property.airbnbUrl && (
                    <a
                      href={property.airbnbUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium border border-input rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Airbnb
                    </a>
                  )}
                  {property.zillowUrl && (
                    <a
                      href={property.zillowUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium border border-input rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Zillow
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Lead Score */}
          <div className="bg-card rounded-xl shadow-soft border border-border p-5">
            <h3 className="font-semibold text-foreground mb-3">Lead Score</h3>
            <div className="flex items-center gap-4">
              <div className={cn(
                "text-3xl font-bold",
                property.leadScore >= 80 ? "text-emerald-600" :
                property.leadScore >= 50 ? "text-amber-600" : "text-muted-foreground"
              )}>
                {property.leadScore}
              </div>
              <div className="flex-1">
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      property.leadScore >= 80 ? "bg-emerald-500" :
                      property.leadScore >= 50 ? "bg-amber-500" : "bg-slate-400"
                    )}
                    style={{ width: `${property.leadScore}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {property.leadScore >= 80 ? "Hot lead - prioritize outreach" :
                   property.leadScore >= 50 ? "Warm lead - follow up soon" :
                   "Cold lead - needs nurturing"}
                </p>
              </div>
            </div>
          </div>

          {/* Marketing Generator */}
          <MarketingGenerator property={property} />
        </div>
      </div>
    </div>
  );
};

export default PropertyDetail;
