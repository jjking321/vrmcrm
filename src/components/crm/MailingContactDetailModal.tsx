import React, { useState, useEffect } from 'react';
import { MailingListItem, Owner, PhoneContact, EmailContact, OwnerContact } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SourceBadge } from './SourceBadge';
import { getBestMailingName } from '@/lib/ownerUtils';
import { Pencil, Phone, Mail, User, MapPin, Building2 } from 'lucide-react';

interface MailingContactDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: MailingListItem & { property?: any };
  onSave: (propertyId: string, ownerUpdates: Partial<Owner>) => void;
  isSaving?: boolean;
}

export const MailingContactDetailModal: React.FC<MailingContactDetailModalProps> = ({
  isOpen,
  onClose,
  item,
  onSave,
  isSaving = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    mailingAddress: '',
    mailingCity: '',
    mailingState: '',
    mailingZip: '',
  });

  const property = item.property;
  const owner = property?.owner;

  // Reset form when modal opens or item changes
  useEffect(() => {
    if (owner) {
      setFormData({
        mailingAddress: owner.mailingAddress || property?.address || '',
        mailingCity: owner.mailingCity || property?.city || '',
        mailingState: owner.mailingState || property?.state || '',
        mailingZip: owner.mailingZip || property?.zip || '',
      });
    }
    setIsEditing(false);
  }, [item, owner, property]);

  if (!property || !owner) {
    return null;
  }

  const contactName = getBestMailingName(owner);
  const owners: OwnerContact[] = owner.owners || [];
  const phones: PhoneContact[] = owner.phones || [];
  const emails: EmailContact[] = owner.emails || [];
  const propertyManager = property.propertyManager;

  const handleSave = () => {
    onSave(property.id, {
      mailingAddress: formData.mailingAddress,
      mailingCity: formData.mailingCity,
      mailingState: formData.mailingState,
      mailingZip: formData.mailingZip,
    });
  };

  const handleCancel = () => {
    if (isEditing) {
      // Reset form to original values
      setFormData({
        mailingAddress: owner.mailingAddress || property?.address || '',
        mailingCity: owner.mailingCity || property?.city || '',
        mailingState: owner.mailingState || property?.state || '',
        mailingZip: owner.mailingZip || property?.zip || '',
      });
      setIsEditing(false);
    } else {
      onClose();
    }
  };

  // Get source for the primary owner name
  const primaryOwnerSource = owners.length > 0 ? owners[0].source : undefined;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">Contact Details</DialogTitle>
            {!isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="gap-2"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Contact Name */}
          <div className="space-y-1">
            <Label className="text-xs uppercase text-muted-foreground tracking-wide">
              Contact Name
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-lg font-medium">{contactName}</span>
              <SourceBadge source={primaryOwnerSource} />
            </div>
          </div>

          {/* Mailing Address */}
          <div className="space-y-2">
            <Label className="text-xs uppercase text-muted-foreground tracking-wide flex items-center gap-2">
              <MapPin className="w-3 h-3" />
              Mailing Address
            </Label>
            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="mailingAddress" className="text-sm text-muted-foreground">Street</Label>
                  <Input
                    id="mailingAddress"
                    value={formData.mailingAddress}
                    onChange={(e) => setFormData({ ...formData, mailingAddress: e.target.value })}
                    placeholder="Street address"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="mailingCity" className="text-sm text-muted-foreground">City</Label>
                    <Input
                      id="mailingCity"
                      value={formData.mailingCity}
                      onChange={(e) => setFormData({ ...formData, mailingCity: e.target.value })}
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <Label htmlFor="mailingState" className="text-sm text-muted-foreground">State</Label>
                    <Input
                      id="mailingState"
                      value={formData.mailingState}
                      onChange={(e) => setFormData({ ...formData, mailingState: e.target.value.toUpperCase().slice(0, 2) })}
                      placeholder="ST"
                      maxLength={2}
                    />
                  </div>
                  <div>
                    <Label htmlFor="mailingZip" className="text-sm text-muted-foreground">ZIP</Label>
                    <Input
                      id="mailingZip"
                      value={formData.mailingZip}
                      onChange={(e) => setFormData({ ...formData, mailingZip: e.target.value })}
                      placeholder="ZIP"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-base">
                <div>{formData.mailingAddress}</div>
                <div>
                  {formData.mailingCity}{formData.mailingCity && formData.mailingState && ', '}
                  {formData.mailingState} {formData.mailingZip}
                </div>
              </div>
            )}
          </div>

          {/* All Owners */}
          {owners.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground tracking-wide flex items-center gap-2">
                <User className="w-3 h-3" />
                All Owners ({owners.length})
              </Label>
              <div className="space-y-3">
                {owners.map((ownerContact, idx) => (
                  <div key={idx} className="bg-muted/40 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {idx + 1}. {ownerContact.firstName} {ownerContact.lastName}
                      </span>
                      <SourceBadge source={ownerContact.source} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Phone Numbers */}
          {phones.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground tracking-wide flex items-center gap-2">
                <Phone className="w-3 h-3" />
                Phone Numbers ({phones.length})
              </Label>
              <div className="space-y-2">
                {phones.map((phone, idx) => (
                  <div key={idx} className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm">{phone.number}</span>
                    {phone.type !== 'unknown' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {phone.type}
                      </span>
                    )}
                    <SourceBadge source={phone.source} />
                    {phone.doNotCall && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                        DNC
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Emails */}
          {emails.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground tracking-wide flex items-center gap-2">
                <Mail className="w-3 h-3" />
                Email Addresses ({emails.length})
              </Label>
              <div className="space-y-2">
                {emails.map((email, idx) => (
                  <div key={idx} className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm">{email.address}</span>
                    {email.type !== 'unknown' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {email.type}
                      </span>
                    )}
                    <SourceBadge source={email.source} />
                    {email.optedOut && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                        Opted out
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Property Manager */}
          {propertyManager && (
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground tracking-wide flex items-center gap-2">
                <Building2 className="w-3 h-3" />
                Property Manager
              </Label>
              <div className="text-base">{propertyManager}</div>
            </div>
          )}

          {/* Property Reference */}
          <div className="space-y-1 pt-2 border-t border-border">
            <Label className="text-xs uppercase text-muted-foreground tracking-wide">
              Property Reference
            </Label>
            <div className="text-sm text-muted-foreground">
              {property.address}, {property.city}, {property.state} {property.zip}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
            {isEditing ? 'Cancel' : 'Close'}
          </Button>
          {isEditing && (
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
