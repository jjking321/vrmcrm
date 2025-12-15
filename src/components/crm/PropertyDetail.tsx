import React, { useState, useEffect } from 'react';
import { Property, PipelineStage, FieldDefinition, Activity, CallOutcome } from '@/types';
import { useAddActivity, useUpdateActivity, useDeleteActivity } from '@/hooks/useProperties';
import { usePropertyOwnerActivities } from '@/hooks/useOwnerActivities';
import { useLogCallActivity } from '@/hooks/useCallLists';
import ActivityLog from './ActivityLog';
import { Badge, TagBadge } from './Badge';
import { PropertyImage } from './PropertyImagePlaceholder';
import { fetchZillowData, fetchAirbnbEstimate, applyZillowDataWithStreetView, applyAirROIData } from '@/lib/enrichment';
import { 
  getPrimaryOwnerName, getAllOwnerNames, getAllOwnerNamesArray, getOwnerCount, getPrimaryPhone, 
  getCallablePhones, hasDoNotCall, isLitigator, formatMailingAddress,
  formatOwnershipLength, getPhoneTypeBadgeClass, getOwnerTypeBadgeClass
} from '@/lib/ownerUtils';
import { 
  MapPin, BedDouble, Bath, User, Mail, Phone, 
  ArrowLeft, Save, X, Plus, ExternalLink, Star, 
  TrendingUp, Home, Pencil, Ruler, Users, Calendar, RefreshCw, Loader2,
  AlertTriangle, PhoneOff, Clock, Link, DollarSign, Trash2,
  CheckCircle, Voicemail, PhoneMissed, XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PropertyDetailProps {
  property: Property;
  stages: PipelineStage[];
  fields: FieldDefinition[];
  onBack: () => void;
  onUpdateProperty: (id: string, updates: Partial<Property>) => void;
  onDeleteProperty?: (id: string) => void;
  onSelectOwner?: (ownerName: string) => void;
}

const PropertyDetail: React.FC<PropertyDetailProps> = ({
  property,
  stages,
  fields,
  onBack,
  onUpdateProperty,
  onDeleteProperty,
  onSelectOwner,
}) => {
  const [isEditingOwner, setIsEditingOwner] = useState(false);
  const [isEditingProperty, setIsEditingProperty] = useState(false);
  const [isEditingMarket, setIsEditingMarket] = useState(false);
  const [editedOwner, setEditedOwner] = useState(property.owner);
  const [editedProperty, setEditedProperty] = useState({
    address: property.address,
    city: property.city,
    state: property.state,
    zip: property.zip,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    guests: property.guests || 0,
    squareFeet: property.squareFeet || 0,
    yearBuilt: property.yearBuilt || 0,
    propertyType: property.propertyType || '',
    airbnbUrl: property.airbnbUrl || '',
    zillowUrl: property.zillowUrl || '',
    propertyUrl: property.propertyUrl || '',
    bookingLink: property.bookingLink || '',
  });
  const [editedMarket, setEditedMarket] = useState({
    projectedRevenue: property.marketData.projectedRevenue,
    propertyValue: property.marketData.propertyValue,
    adr: property.marketData.adr,
    occupancyRate: property.marketData.occupancyRate,
  });
  const [newTag, setNewTag] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isLoadingZillow, setIsLoadingZillow] = useState(false);
  
  // Quick Call Log state
  const [callNotes, setCallNotes] = useState('');
  const [selectedPhoneIndex, setSelectedPhoneIndex] = useState(0);
  const [showCallbackPicker, setShowCallbackPicker] = useState(false);
  const [callbackDate, setCallbackDate] = useState('');
  const [isLoadingAirROI, setIsLoadingAirROI] = useState(false);

  // Reset edited values when property changes
  useEffect(() => {
    setEditedProperty({
      address: property.address,
      city: property.city,
      state: property.state,
      zip: property.zip,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      guests: property.guests || 0,
      squareFeet: property.squareFeet || 0,
      yearBuilt: property.yearBuilt || 0,
      propertyType: property.propertyType || '',
      airbnbUrl: property.airbnbUrl || '',
      zillowUrl: property.zillowUrl || '',
      propertyUrl: property.propertyUrl || '',
      bookingLink: property.bookingLink || '',
    });
    setEditedMarket({
      projectedRevenue: property.marketData.projectedRevenue,
      propertyValue: property.marketData.propertyValue,
      adr: property.marketData.adr,
      occupancyRate: property.marketData.occupancyRate,
    });
    setEditedOwner(property.owner);
  }, [property]);

  const handleFetchZillow = async () => {
    setIsLoadingZillow(true);
    try {
      const result = await fetchZillowData(property);
      if (result.success && result.data) {
        const updates = await applyZillowDataWithStreetView(property, result.data);
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
        toast.success('Revenue data enriched from Airbnb');
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
    toast.success('Owner details updated');
  };

  const handleSaveProperty = () => {
    // Smart detection: if bookingLink contains airbnb, move to airbnbUrl
    let finalAirbnbUrl = editedProperty.airbnbUrl;
    let finalBookingLink = editedProperty.bookingLink;
    
    if (finalBookingLink && finalBookingLink.toLowerCase().includes('airbnb')) {
      finalAirbnbUrl = finalBookingLink;
      finalBookingLink = '';
      toast.info('Airbnb URL detected and moved to Airbnb field');
    }
    
    onUpdateProperty(property.id, {
      address: editedProperty.address,
      city: editedProperty.city,
      state: editedProperty.state,
      zip: editedProperty.zip,
      bedrooms: editedProperty.bedrooms,
      bathrooms: editedProperty.bathrooms,
      guests: editedProperty.guests || undefined,
      squareFeet: editedProperty.squareFeet || undefined,
      yearBuilt: editedProperty.yearBuilt || undefined,
      propertyType: editedProperty.propertyType || undefined,
      airbnbUrl: finalAirbnbUrl || undefined,
      zillowUrl: editedProperty.zillowUrl || undefined,
      propertyUrl: editedProperty.propertyUrl || undefined,
      bookingLink: finalBookingLink || undefined,
    });
    setIsEditingProperty(false);
    toast.success('Property details updated');
  };

  const handleSaveMarket = () => {
    onUpdateProperty(property.id, {
      marketData: {
        ...property.marketData,
        projectedRevenue: editedMarket.projectedRevenue,
        propertyValue: editedMarket.propertyValue,
        adr: editedMarket.adr,
        occupancyRate: editedMarket.occupancyRate,
      },
    });
    setIsEditingMarket(false);
    toast.success('Market data updated');
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

  const addActivityMutation = useAddActivity();
  const updateActivity = useUpdateActivity();
  const deleteActivity = useDeleteActivity();
  const logCallActivity = useLogCallActivity();

  const handleCallOutcome = async (outcome: CallOutcome) => {
    const phones = callablePhones;
    const selectedPhone = phones[selectedPhoneIndex];
    const phoneNumber = selectedPhone?.number || primaryPhone?.number || '';
    const phoneType = selectedPhone?.type || primaryPhone?.type || 'unknown';
    
    if (!phoneNumber) {
      toast.error('No phone number available');
      return;
    }
    
    await logCallActivity.mutateAsync({
      propertyId: property.id,
      ownerName: primaryName || 'Unknown',
      phoneNumber,
      phoneType,
      outcome,
      notes: callNotes || undefined,
    });
    
    setCallNotes('');
    setShowCallbackPicker(false);
    setCallbackDate('');
    toast.success('Call logged');
  };

  const handleAddActivity = (activity: Omit<Activity, 'id'>) => {
    // Activities are now owner-centric - pass the primary owner name
    addActivityMutation.mutate({
      propertyId: property.id,
      activity,
      ownerName: primaryName || undefined,
    });
  };

  const handleStageChange = (stageId: string) => {
    onUpdateProperty(property.id, { stageId });
  };

  const currentStage = stages.find(s => s.id === property.stageId);

  // Owner helper values
  const ownerCount = getOwnerCount(property.owner);
  const primaryName = getPrimaryOwnerName(property.owner);
  const allNames = getAllOwnerNames(property.owner);
  const allNamesArray = getAllOwnerNamesArray(property.owner);
  
  // Fetch all activities for this property's owners (across all their properties)
  const { data: ownerActivities, isLoading: isLoadingActivities } = usePropertyOwnerActivities(allNamesArray);
  const primaryPhone = getPrimaryPhone(property.owner);
  const callablePhones = getCallablePhones(property.owner);
  const hasDNC = hasDoNotCall(property.owner);
  const ownerIsLitigator = isLitigator(property.owner);
  const mailingAddr = formatMailingAddress(property.owner);
  const ownershipLength = formatOwnershipLength(property.owner.ownershipLengthMonths);

  const inputClass = "w-full px-3 py-2 text-sm border border-input rounded-lg bg-card focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none";

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
          {isEditingProperty ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editedProperty.address}
                onChange={(e) => setEditedProperty({ ...editedProperty, address: e.target.value })}
                className={cn(inputClass, "text-xl font-bold")}
                placeholder="Street Address"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editedProperty.city}
                  onChange={(e) => setEditedProperty({ ...editedProperty, city: e.target.value })}
                  className={cn(inputClass, "flex-1")}
                  placeholder="City"
                />
                <input
                  type="text"
                  value={editedProperty.state}
                  onChange={(e) => setEditedProperty({ ...editedProperty, state: e.target.value })}
                  className={cn(inputClass, "w-20")}
                  placeholder="State"
                />
                <input
                  type="text"
                  value={editedProperty.zip}
                  onChange={(e) => setEditedProperty({ ...editedProperty, zip: e.target.value })}
                  className={cn(inputClass, "w-24")}
                  placeholder="ZIP"
                />
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <MapPin className="w-6 h-6 text-brand" />
                {property.address}
              </h1>
              {(property.city || property.state || property.zip) && (
                <p className="text-muted-foreground">
                  {[property.city, property.state].filter(Boolean).join(', ')} {property.zip}
                </p>
              )}
            </>
          )}
        </div>
        {!isEditingProperty && (
          <button
            onClick={() => setIsEditingProperty(true)}
            className="p-2 text-muted-foreground hover:text-brand rounded-lg hover:bg-muted transition-colors"
            title="Edit property details"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
        {isEditingProperty && (
          <div className="flex gap-2">
            <button
              onClick={handleSaveProperty}
              className="px-3 py-1.5 bg-brand text-brand-foreground rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => {
                setIsEditingProperty(false);
                setEditedProperty({
                  address: property.address,
                  city: property.city,
                  state: property.state,
                  zip: property.zip,
                  bedrooms: property.bedrooms,
                  bathrooms: property.bathrooms,
                  guests: property.guests || 0,
                  squareFeet: property.squareFeet || 0,
                  yearBuilt: property.yearBuilt || 0,
                  propertyType: property.propertyType || '',
                  airbnbUrl: property.airbnbUrl || '',
                  zillowUrl: property.zillowUrl || '',
                  propertyUrl: property.propertyUrl || '',
                  bookingLink: property.bookingLink || '',
                });
              }}
              className="px-3 py-1.5 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
        {ownerIsLitigator && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 border border-red-200 rounded-full text-sm font-medium">
            <AlertTriangle className="w-4 h-4" />
            Litigator
          </div>
        )}
        {currentStage && <Badge label={currentStage.name} color={currentStage.color} className="text-sm" />}
        {onDeleteProperty && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors"
                title="Delete property"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Property</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{property.address}"? This action cannot be undone and will also delete all associated activity logs.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDeleteProperty(property.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Property Info & Activities */}
        <div className="lg:col-span-2 space-y-6">
          {/* Property Image & Quick Stats */}
          <div className="bg-card rounded-xl shadow-soft border border-border overflow-hidden">
          <div className="relative h-64">
              <PropertyImage src={property.image} alt={property.address} className="w-full h-full object-cover" />
              {isEditingProperty ? (
                <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-4">
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    <div>
                      <label className="text-xs text-white/70 block mb-1">Beds</label>
                      <input
                        type="number"
                        value={editedProperty.bedrooms}
                        onChange={(e) => setEditedProperty({ ...editedProperty, bedrooms: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 text-sm bg-white/10 border border-white/20 rounded text-white placeholder:text-white/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/70 block mb-1">Baths</label>
                      <input
                        type="number"
                        step="0.5"
                        value={editedProperty.bathrooms}
                        onChange={(e) => setEditedProperty({ ...editedProperty, bathrooms: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 text-sm bg-white/10 border border-white/20 rounded text-white placeholder:text-white/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/70 block mb-1">Guests</label>
                      <input
                        type="number"
                        value={editedProperty.guests}
                        onChange={(e) => setEditedProperty({ ...editedProperty, guests: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 text-sm bg-white/10 border border-white/20 rounded text-white placeholder:text-white/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/70 block mb-1">Sq Ft</label>
                      <input
                        type="number"
                        value={editedProperty.squareFeet}
                        onChange={(e) => setEditedProperty({ ...editedProperty, squareFeet: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 text-sm bg-white/10 border border-white/20 rounded text-white placeholder:text-white/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/70 block mb-1">Year</label>
                      <input
                        type="number"
                        value={editedProperty.yearBuilt}
                        onChange={(e) => setEditedProperty({ ...editedProperty, yearBuilt: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 text-sm bg-white/10 border border-white/20 rounded text-white placeholder:text-white/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/70 block mb-1">Type</label>
                      <input
                        type="text"
                        value={editedProperty.propertyType}
                        onChange={(e) => setEditedProperty({ ...editedProperty, propertyType: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm bg-white/10 border border-white/20 rounded text-white placeholder:text-white/50"
                        placeholder="CONDO"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                  <div className="flex flex-wrap items-center gap-3 text-white text-sm">
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
                    {property.yearBuilt && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span className="font-medium">Built {property.yearBuilt}</span>
                      </div>
                    )}
                    {property.propertyType && (
                      <div className="flex items-center gap-1">
                        <Home className="w-4 h-4" />
                        <span className="font-medium">{property.propertyType}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* URLs (when editing) */}
            {isEditingProperty && (
              <div className="p-4 border-t border-border space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">External Links</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Airbnb URL</label>
                    <input
                      type="url"
                      value={editedProperty.airbnbUrl}
                      onChange={(e) => setEditedProperty({ ...editedProperty, airbnbUrl: e.target.value })}
                      className={inputClass}
                      placeholder="https://airbnb.com/..."
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Zillow URL</label>
                    <input
                      type="url"
                      value={editedProperty.zillowUrl}
                      onChange={(e) => setEditedProperty({ ...editedProperty, zillowUrl: e.target.value })}
                      className={inputClass}
                      placeholder="https://zillow.com/..."
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Property Record URL</label>
                    <input
                      type="url"
                      value={editedProperty.propertyUrl}
                      onChange={(e) => setEditedProperty({ ...editedProperty, propertyUrl: e.target.value })}
                      className={inputClass}
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Booking Link (VRBO, etc.)</label>
                    <input
                      type="url"
                      value={editedProperty.bookingLink}
                      onChange={(e) => setEditedProperty({ ...editedProperty, bookingLink: e.target.value })}
                      className={inputClass}
                      placeholder="https://vrbo.com/... (Airbnb URLs auto-moved)"
                    />
                  </div>
                </div>
              </div>
            )}

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
                  {property.tags.filter(tag => !tag.startsWith('list-')).map(tag => (
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

          {/* Market Intelligence - Moved here */}
          <div className="bg-card rounded-xl shadow-soft border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-brand" />
                Market Intelligence
              </h3>
              <div className="flex gap-2">
                {isEditingMarket ? (
                  <>
                    <button
                      onClick={handleSaveMarket}
                      className="px-2.5 py-1.5 bg-brand text-brand-foreground rounded-lg text-xs font-medium hover:bg-brand-600 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingMarket(false);
                        setEditedMarket({
                          projectedRevenue: property.marketData.projectedRevenue,
                          propertyValue: property.marketData.propertyValue,
                          adr: property.marketData.adr,
                          occupancyRate: property.marketData.occupancyRate,
                        });
                      }}
                      className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setIsEditingMarket(true)}
                      className="p-1.5 text-muted-foreground hover:text-brand rounded transition-colors"
                      title="Edit market data"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
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
                      title="Fetch from Airbnb"
                    >
                      {isLoadingAirROI ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      Airbnb
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {/* Key Metrics */}
              {isEditingMarket ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                    <label className="text-xs text-emerald-600 font-medium mb-1 block">Est. Annual Revenue</label>
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      <input
                        type="number"
                        value={editedMarket.projectedRevenue}
                        onChange={(e) => setEditedMarket({ ...editedMarket, projectedRevenue: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-1 text-lg font-bold text-emerald-700 bg-white border border-emerald-200 rounded"
                      />
                    </div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                    <label className="text-xs text-blue-600 font-medium mb-1 block">Property Value</label>
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4 text-blue-600" />
                      <input
                        type="number"
                        value={editedMarket.propertyValue}
                        onChange={(e) => setEditedMarket({ ...editedMarket, propertyValue: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-1 text-lg font-bold text-blue-700 bg-white border border-blue-200 rounded"
                      />
                    </div>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                    <label className="text-xs text-amber-600 font-medium mb-1 block">ADR</label>
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4 text-amber-600" />
                      <input
                        type="number"
                        value={editedMarket.adr}
                        onChange={(e) => setEditedMarket({ ...editedMarket, adr: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-1 text-lg font-bold text-amber-700 bg-white border border-amber-200 rounded"
                      />
                    </div>
                  </div>
                  <div className="bg-violet-50 rounded-lg p-3 border border-violet-100">
                    <label className="text-xs text-violet-600 font-medium mb-1 block">Occupancy %</label>
                    <input
                      type="number"
                      value={editedMarket.occupancyRate}
                      onChange={(e) => setEditedMarket({ ...editedMarket, occupancyRate: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1 text-lg font-bold text-violet-700 bg-white border border-violet-200 rounded"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
              )}

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

          {/* Activity Log - Shows all activities for property's owners across all their properties */}
          <ActivityLog 
            activities={ownerActivities || []} 
            onAddActivity={handleAddActivity}
            onEditActivity={(id, updates) => updateActivity.mutate({ id, updates })}
            onDeleteActivity={(id) => deleteActivity.mutate(id)}
            showPropertyContext={true}
            currentPropertyId={property.id}
          />

          {/* Quick Call Log Section */}
          {callablePhones.length > 0 && (
            <div className="bg-card rounded-xl shadow-soft border border-border p-5">
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                <Phone className="w-4 h-4 text-brand" />
                Quick Call Log
              </h3>
              
              {/* Compliance Warnings */}
              {(ownerIsLitigator || hasDNC) && (
                <div className="mb-4 space-y-2">
                  {ownerIsLitigator && (
                    <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-medium">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>LITIGATOR - Exercise caution when contacting</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Phone Selector (if multiple phones) */}
              {callablePhones.length > 1 && (
                <div className="mb-4">
                  <label className="text-xs text-muted-foreground mb-1 block">Select Phone</label>
                  <select 
                    value={selectedPhoneIndex}
                    onChange={(e) => setSelectedPhoneIndex(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-card"
                  >
                    {callablePhones.map((phone, idx) => (
                      <option key={idx} value={idx}>
                        {phone.number} ({phone.type}) {phone.doNotCall && '⚠️ DNC'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* Current Phone Display (single phone) */}
              {callablePhones.length === 1 && (
                <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  <span>{callablePhones[0].number}</span>
                  {callablePhones[0].type !== 'unknown' && (
                    <span className="text-xs px-1.5 py-0.5 bg-muted rounded">{callablePhones[0].type}</span>
                  )}
                </div>
              )}
              
              {/* Call Notes */}
              <div className="mb-4">
                <textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="Call notes (optional)..."
                  className="w-full p-3 border border-input rounded-lg text-sm resize-none bg-card"
                  rows={2}
                />
              </div>
              
              {/* Outcome Buttons */}
              <div className="grid grid-cols-5 gap-2">
                <Button 
                  variant="outline" 
                  className="flex-col h-auto py-3 hover:bg-green-50 hover:border-green-500 hover:text-green-700" 
                  onClick={() => handleCallOutcome('answered')}
                  disabled={logCallActivity.isPending}
                >
                  <CheckCircle className="w-5 h-5 mb-1" />
                  <span className="text-xs">Answered</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-col h-auto py-3 hover:bg-blue-50 hover:border-blue-500 hover:text-blue-700" 
                  onClick={() => handleCallOutcome('voicemail')}
                  disabled={logCallActivity.isPending}
                >
                  <Voicemail className="w-5 h-5 mb-1" />
                  <span className="text-xs">Voicemail</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-col h-auto py-3 hover:bg-amber-50 hover:border-amber-500 hover:text-amber-700" 
                  onClick={() => handleCallOutcome('no_answer')}
                  disabled={logCallActivity.isPending}
                >
                  <PhoneMissed className="w-5 h-5 mb-1" />
                  <span className="text-xs">No Answer</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-col h-auto py-3 hover:bg-red-50 hover:border-red-500 hover:text-red-700" 
                  onClick={() => handleCallOutcome('wrong_number')}
                  disabled={logCallActivity.isPending}
                >
                  <XCircle className="w-5 h-5 mb-1" />
                  <span className="text-xs">Wrong #</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-col h-auto py-3 hover:bg-purple-50 hover:border-purple-500 hover:text-purple-700" 
                  onClick={() => setShowCallbackPicker(true)}
                  disabled={logCallActivity.isPending}
                >
                  <Calendar className="w-5 h-5 mb-1" />
                  <span className="text-xs">Callback</span>
                </Button>
              </div>
              
              {/* Callback Date Picker */}
              {showCallbackPicker && (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="datetime-local"
                    value={callbackDate}
                    onChange={(e) => setCallbackDate(e.target.value)}
                    className="flex-1 px-3 py-2 border border-input rounded-md text-sm bg-card"
                  />
                  <Button size="sm" onClick={() => handleCallOutcome('callback')} disabled={!callbackDate || logCallActivity.isPending}>
                    Schedule
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowCallbackPicker(false)}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}
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
                {/* Owners with their phones grouped */}
                {property.owner.owners && property.owner.owners.length > 0 ? (
                  <div className="space-y-3">
                    {property.owner.owners.map((owner, idx) => {
                      const ownerFullName = `${owner.firstName} ${owner.lastName}`.trim();
                      const associatedPhone = property.owner.phones?.[idx];
                      
                      return (
                        <div key={idx} className="flex items-start justify-between p-2 rounded-lg bg-muted/30">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center text-brand text-xs font-medium">
                              {idx + 1}
                            </div>
                            <div>
                              <button
                                onClick={() => onSelectOwner?.(ownerFullName || primaryName)}
                                className="font-medium text-foreground text-sm hover:text-brand hover:underline transition-colors text-left"
                              >
                                {ownerFullName || 'Unknown'}
                              </button>
                              {associatedPhone && (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {associatedPhone.doNotCall ? (
                                    <a href={`tel:${associatedPhone.number}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-brand">
                                      <PhoneOff className="w-3 h-3 text-amber-500" />
                                      {associatedPhone.number}
                                      <span className="px-1 py-0.5 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded font-medium">DNC</span>
                                    </a>
                                  ) : (
                                    <a href={`tel:${associatedPhone.number}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-brand">
                                      <Phone className="w-3 h-3" />
                                      {associatedPhone.number}
                                      {associatedPhone.type !== 'unknown' && (
                                        <span className={cn("px-1 py-0.5 text-xs rounded border", getPhoneTypeBadgeClass(associatedPhone.type))}>
                                          {associatedPhone.type}
                                        </span>
                                      )}
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Additional phones without associated owners */}
                    {property.owner.phones && property.owner.phones.length > property.owner.owners.length && (
                      <div className="pt-2 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-2">Additional phones:</p>
                        {property.owner.phones.slice(property.owner.owners.length).map((phone, idx) => (
                          <div key={idx} className="flex items-center gap-2 ml-10">
                            {phone.doNotCall ? (
                              <a href={`tel:${phone.number}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-brand">
                                <PhoneOff className="w-3 h-3 text-amber-500" />
                                {phone.number}
                                <span className="px-1 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-medium">DNC</span>
                              </a>
                            ) : (
                              <a href={`tel:${phone.number}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-brand">
                                <Phone className="w-3 h-3" />
                                {phone.number}
                                {phone.type !== 'unknown' && (
                                  <span className={cn("px-1 py-0.5 rounded border", getPhoneTypeBadgeClass(phone.type))}>
                                    {phone.type}
                                  </span>
                                )}
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <button
                      onClick={() => onSelectOwner?.(primaryName)}
                      className="font-medium text-foreground hover:text-brand hover:underline transition-colors"
                    >
                      {primaryName}
                    </button>
                    {property.owner.phone && (
                      <a href={`tel:${property.owner.phone}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-brand mt-1">
                        <Phone className="w-4 h-4" />
                        {property.owner.phone}
                      </a>
                    )}
                  </div>
                )}

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

        </div>
      </div>
    </div>
  );
};

export default PropertyDetail;
