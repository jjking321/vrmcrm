import React, { useState } from 'react';
import { X, Home, User } from 'lucide-react';

interface AddPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: {
    address: string;
    city: string;
    state: string;
    zip: string;
    ownerName: string;
    ownerEmail: string;
    ownerPhone: string;
  }) => void;
}

export const AddPropertyModal: React.FC<AddPropertyModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    address: '',
    city: '',
    state: '',
    zip: '',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd(formData);
    setFormData({
      address: '',
      city: '',
      state: '',
      zip: '',
      ownerName: '',
      ownerEmail: '',
      ownerPhone: '',
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div>
            <h2 className="text-lg font-bold text-foreground">Add Property</h2>
            <p className="text-xs text-muted-foreground">Manually add a new property lead</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Property Section */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Home className="w-4 h-4 text-brand" />
              Property Details
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Street Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full p-2.5 border border-input rounded-lg text-sm bg-background focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none transition-colors"
                  placeholder="e.g. 123 Beachside Dr"
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full p-2.5 border border-input rounded-lg text-sm bg-background focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none transition-colors"
                    placeholder="City"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase().slice(0, 2) })}
                    className="w-full p-2.5 border border-input rounded-lg text-sm bg-background focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none transition-colors"
                    placeholder="FL"
                    maxLength={2}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">ZIP</label>
                  <input
                    type="text"
                    value={formData.zip}
                    onChange={(e) => setFormData({ ...formData, zip: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                    className="w-full p-2.5 border border-input rounded-lg text-sm bg-background focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none transition-colors"
                    placeholder="32541"
                    maxLength={5}
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Owner Section */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-brand" />
              Owner Information
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Owner Name</label>
                <input
                  type="text"
                  value={formData.ownerName}
                  onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                  className="w-full p-2.5 border border-input rounded-lg text-sm bg-background focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none transition-colors"
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email</label>
                  <input
                    type="email"
                    value={formData.ownerEmail}
                    onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                    className="w-full p-2.5 border border-input rounded-lg text-sm bg-background focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none transition-colors"
                    placeholder="john@email.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Phone</label>
                  <input
                    type="tel"
                    value={formData.ownerPhone}
                    onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
                    className="w-full p-2.5 border border-input rounded-lg text-sm bg-background focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none transition-colors"
                    placeholder="555-123-4567"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-muted-foreground hover:text-foreground border border-input rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-brand text-brand-foreground rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors"
            >
              Add Property
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
