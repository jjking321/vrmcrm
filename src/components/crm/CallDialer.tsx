import React, { useState, useMemo } from 'react';
import { useCallListItems, useUpdateCallListItem, useLogCallActivity, useCallLists } from '@/hooks/useCallLists';
import { CallListItem, CallOutcome, PhoneContact } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  ArrowLeft, ArrowRight, Phone, PhoneOff, Voicemail, PhoneMissed, 
  XCircle, Calendar, SkipForward, Loader2, ExternalLink, AlertTriangle,
  CheckCircle, Bed, Bath
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getPrimaryOwnerName } from '@/lib/ownerUtils';
import zillowLogo from '@/assets/zillow.png';
import airbnbLogo from '@/assets/airbnb.png';

interface CallDialerProps {
  listId: string;
  onBack: () => void;
}

export const CallDialer: React.FC<CallDialerProps> = ({ listId, onBack }) => {
  const { data: items = [], isLoading } = useCallListItems(listId);
  const { data: lists = [] } = useCallLists();
  const updateItemMutation = useUpdateCallListItem();
  const logActivityMutation = useLogCallActivity();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [notes, setNotes] = useState('');
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [showCallbackPicker, setShowCallbackPicker] = useState(false);
  const [callbackDate, setCallbackDate] = useState('');
  
  const currentList = lists.find((l: any) => l.id === listId);
  
  // Get pending items
  const pendingItems = useMemo(() => 
    items.filter(item => item.status === 'pending'),
    [items]
  );
  
  const completedCount = items.filter(item => item.status === 'completed').length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  
  const currentItem = pendingItems[currentIndex];
  const property = currentItem?.property;
  const owner = property?.owner;
  
  // Get current phone info
  const getCurrentPhone = (): { number: string; type: string; doNotCall: boolean } | null => {
    if (!owner) return null;
    
    const phoneIndex = currentItem?.phoneIndex;
    const phones = owner.phones || [];
    
    if (phoneIndex !== null && phones[phoneIndex]) {
      return phones[phoneIndex];
    }
    
    // Fallback to legacy phone
    if (owner.phone) {
      return { number: owner.phone, type: 'unknown', doNotCall: false };
    }
    
    return null;
  };
  
  const currentPhone = getCurrentPhone();
  const ownerName = owner ? getPrimaryOwnerName(owner) : 'Unknown';
  
  // Get other phones for this property
  const otherPhones = useMemo(() => {
    if (!owner) return [];
    const phones = owner.phones || [];
    const currentPhoneIndex = currentItem?.phoneIndex;
    return phones.filter((_, idx) => idx !== currentPhoneIndex);
  }, [owner, currentItem]);
  
  const handleOutcome = async (outcome: CallOutcome) => {
    if (!currentItem || !property || !currentPhone) return;
    
    try {
      // Update the call list item
      await updateItemMutation.mutateAsync({
        id: currentItem.id,
        updates: {
          status: 'completed',
          call_outcome: outcome,
          notes: notes || null,
          last_called_at: new Date().toISOString(),
          call_count: currentItem.callCount + 1,
          callback_date: outcome === 'callback' && callbackDate ? callbackDate : null,
        },
      });
      
      // Log the activity
      await logActivityMutation.mutateAsync({
        propertyId: property.id,
        ownerName,
        phoneNumber: currentPhone.number,
        phoneType: currentPhone.type,
        outcome,
        notes: notes || undefined,
      });
      
      toast.success('Call logged');
      
      // Reset form
      setNotes('');
      setShowCallbackPicker(false);
      setCallbackDate('');
      
      // Auto advance
      if (autoAdvance && currentIndex < pendingItems.length - 1) {
        // Note: currentIndex stays the same because the current item is now completed
        // and will be filtered out of pendingItems on next render
      }
    } catch (error) {
      toast.error('Failed to log call');
    }
  };
  
  const handleSkip = async () => {
    if (!currentItem) return;
    
    try {
      await updateItemMutation.mutateAsync({
        id: currentItem.id,
        updates: {
          status: 'skipped',
          notes: notes || null,
        },
      });
      
      setNotes('');
      
      if (!autoAdvance && currentIndex < pendingItems.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    } catch (error) {
      toast.error('Failed to skip');
    }
  };
  
  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setNotes('');
    }
  };
  
  const handleNext = () => {
    if (currentIndex < pendingItems.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setNotes('');
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (pendingItems.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Lists
        </Button>
        
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">All Done!</h2>
          <p className="text-muted-foreground">
            You've completed all calls in this list.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Lists
        </Button>
        <h1 className="text-lg font-semibold text-foreground">{currentList?.name || 'Call List'}</h1>
        <div className="text-sm text-muted-foreground">
          {currentIndex + 1} / {pendingItems.length} pending
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>{completedCount} of {totalCount} completed</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      
      {/* Main card */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {/* Property header */}
        <div className="bg-muted/50 px-6 py-4 border-b border-border">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {property?.address || 'Unknown Address'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {property?.city}, {property?.state} {property?.zip}
              </p>
              {(property?.bedrooms || property?.bathrooms) && (
                <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                  {property?.bedrooms && (
                    <span className="flex items-center gap-1">
                      <Bed className="w-3.5 h-3.5" />
                      {property.bedrooms} bed
                    </span>
                  )}
                  {property?.bedrooms && property?.bathrooms && <span>•</span>}
                  {property?.bathrooms && (
                    <span className="flex items-center gap-1">
                      <Bath className="w-3.5 h-3.5" />
                      {property.bathrooms} bath
                    </span>
                  )}
                </p>
              )}
            </div>
            
            {/* External links */}
            <div className="flex gap-2">
              {property?.zillowUrl && (
                <a
                  href={property.zillowUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                  title="View on Zillow"
                >
                  <img src={zillowLogo} alt="Zillow" className="w-6 h-6" />
                </a>
              )}
              {property?.airbnbUrl && (
                <a
                  href={property.airbnbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                  title="View on Airbnb"
                >
                  <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center border border-gray-200">
                    <img src={airbnbLogo} alt="Airbnb" className="w-4 h-4" />
                  </div>
                </a>
              )}
              {property?.propertyUrl && (
                <a
                  href={property.propertyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                  title="Property record"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
              {property?.bookingLink && (
                <a
                  href={property.bookingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-brand hover:bg-muted rounded-lg transition-colors"
                  title="Booking link"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </div>
        
        {/* Contact info */}
        <div className="px-6 py-4">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-1">Owner</p>
            <p className="font-medium text-foreground">{ownerName}</p>
          </div>
          
          {/* Current phone */}
          {currentPhone && (
            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-1">Phone</p>
              <div className="flex items-center gap-2">
                <span className="text-xl font-semibold text-foreground">{currentPhone.number}</span>
                <span className={cn(
                  "px-2 py-0.5 text-xs rounded-full",
                  currentPhone.type === 'mobile' ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                )}>
                  {currentPhone.type}
                </span>
              </div>
            </div>
          )}
          
          {/* DNC Warning */}
          {currentPhone?.doNotCall && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg mb-4">
              <PhoneOff className="w-4 h-4 text-amber-600" />
              <span className="text-sm text-amber-700 font-medium">Do Not Call flag set - Proceed with caution</span>
            </div>
          )}
          
          {/* Litigator Warning */}
          {owner?.litigator && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg mb-4">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-sm text-red-700 font-medium">Litigator Warning - Exercise caution</span>
            </div>
          )}
          
          {/* Other phones */}
          {otherPhones.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-1">Other phones</p>
              <div className="flex flex-wrap gap-2">
                {otherPhones.map((phone, idx) => (
                  <span key={idx} className="text-xs px-2 py-1 bg-muted rounded text-muted-foreground">
                    {phone.number} ({phone.type})
                    {phone.doNotCall && <PhoneOff className="w-3 h-3 inline ml-1 text-amber-500" />}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Dial button */}
          {currentPhone && (
            <a
              href={`tel:${currentPhone.number}`}
              className="flex items-center justify-center gap-2 w-full py-4 bg-primary text-primary-foreground rounded-lg font-semibold text-lg hover:bg-primary/90 transition-colors"
            >
              <Phone className="w-5 h-5" />
              DIAL NOW
            </a>
          )}
        </div>
        
        {/* Notes */}
        <div className="px-6 py-4 border-t border-border">
          <Label htmlFor="notes" className="text-sm text-muted-foreground mb-2 block">
            Call Notes
          </Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Enter notes about this call..."
            className="min-h-[80px]"
          />
        </div>
        
        {/* Outcome buttons */}
        <div className="px-6 py-4 border-t border-border">
          <p className="text-sm text-muted-foreground mb-3">Call Outcome</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Button
              variant="outline"
              className="flex-col h-auto py-3 hover:bg-green-50 hover:border-green-500 hover:text-green-700"
              onClick={() => handleOutcome('answered')}
              disabled={updateItemMutation.isPending}
            >
              <CheckCircle className="w-5 h-5 mb-1" />
              <span className="text-xs">Answered</span>
            </Button>
            <Button
              variant="outline"
              className="flex-col h-auto py-3 hover:bg-blue-50 hover:border-blue-500 hover:text-blue-700"
              onClick={() => handleOutcome('voicemail')}
              disabled={updateItemMutation.isPending}
            >
              <Voicemail className="w-5 h-5 mb-1" />
              <span className="text-xs">Voicemail</span>
            </Button>
            <Button
              variant="outline"
              className="flex-col h-auto py-3 hover:bg-amber-50 hover:border-amber-500 hover:text-amber-700"
              onClick={() => handleOutcome('no_answer')}
              disabled={updateItemMutation.isPending}
            >
              <PhoneMissed className="w-5 h-5 mb-1" />
              <span className="text-xs">No Answer</span>
            </Button>
            <Button
              variant="outline"
              className="flex-col h-auto py-3 hover:bg-red-50 hover:border-red-500 hover:text-red-700"
              onClick={() => handleOutcome('wrong_number')}
              disabled={updateItemMutation.isPending}
            >
              <XCircle className="w-5 h-5 mb-1" />
              <span className="text-xs">Wrong #</span>
            </Button>
            <Button
              variant="outline"
              className="flex-col h-auto py-3 hover:bg-purple-50 hover:border-purple-500 hover:text-purple-700"
              onClick={() => setShowCallbackPicker(true)}
              disabled={updateItemMutation.isPending}
            >
              <Calendar className="w-5 h-5 mb-1" />
              <span className="text-xs">Callback</span>
            </Button>
          </div>
          
          {/* Callback date picker */}
          {showCallbackPicker && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="datetime-local"
                value={callbackDate}
                onChange={(e) => setCallbackDate(e.target.value)}
                className="flex-1 px-3 py-2 border border-input rounded-md text-sm"
              />
              <Button size="sm" onClick={() => handleOutcome('callback')} disabled={!callbackDate}>
                Schedule
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCallbackPicker(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
        
        {/* Navigation */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-muted/30">
          <Button
            variant="ghost"
            onClick={handlePrev}
            disabled={currentIndex === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Prev
          </Button>
          
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={updateItemMutation.isPending}
          >
            <SkipForward className="w-4 h-4 mr-1" />
            Skip
          </Button>
          
          <div className="flex items-center gap-2">
            <Switch
              id="auto-advance"
              checked={autoAdvance}
              onCheckedChange={setAutoAdvance}
            />
            <Label htmlFor="auto-advance" className="text-sm cursor-pointer">
              Auto-advance
            </Label>
          </div>
          
          <Button
            variant="ghost"
            onClick={handleNext}
            disabled={currentIndex === pendingItems.length - 1}
          >
            Next
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
};
