import React, { useState } from 'react';
import { Property } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useCallLists, useCreateCallList, useAddToCallList } from '@/hooks/useCallLists';
import { Phone, Plus, Loader2 } from 'lucide-react';

interface AddToCallListModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProperties: Property[];
  onSuccess?: () => void;
}

export const AddToCallListModal: React.FC<AddToCallListModalProps> = ({
  isOpen,
  onClose,
  selectedProperties,
  onSuccess,
}) => {
  const { data: callLists = [], isLoading: listsLoading } = useCallLists();
  const createListMutation = useCreateCallList();
  const addToListMutation = useAddToCallList();
  
  const [mode, setMode] = useState<'existing' | 'new'>('new');
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [newListName, setNewListName] = useState('');
  const [phoneFilter, setPhoneFilter] = useState<'all' | 'mobile' | 'first'>('all');
  
  // Calculate phone count based on filter
  const phoneCount = selectedProperties.reduce((sum, prop) => {
    const phones = prop.owner.phones || [];
    const legacyPhone = prop.owner.phone;
    
    if (phoneFilter === 'all') {
      return sum + (phones.length > 0 ? phones.length : (legacyPhone ? 1 : 0));
    } else if (phoneFilter === 'mobile') {
      return sum + phones.filter(p => p.type === 'mobile').length;
    } else {
      return sum + (phones.length > 0 || legacyPhone ? 1 : 0);
    }
  }, 0);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let listId = selectedListId;
    
    // Create new list if needed
    if (mode === 'new') {
      if (!newListName.trim()) return;
      const newList = await createListMutation.mutateAsync(newListName.trim());
      listId = newList.id;
    }
    
    if (!listId) return;
    
    // Add properties to list
    await addToListMutation.mutateAsync({
      listId,
      properties: selectedProperties,
      phoneFilter,
    });
    
    onSuccess?.();
    onClose();
  };
  
  const isSubmitting = createListMutation.isPending || addToListMutation.isPending;
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Add to Call List
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* List selection */}
          <div className="space-y-3">
            <Label>Select or Create List</Label>
            
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'existing' | 'new')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="new" id="new" />
                <Label htmlFor="new" className="font-normal cursor-pointer">Create new list</Label>
              </div>
              {callLists.length > 0 && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="existing" id="existing" />
                  <Label htmlFor="existing" className="font-normal cursor-pointer">Add to existing list</Label>
                </div>
              )}
            </RadioGroup>
            
            {mode === 'new' ? (
              <Input
                placeholder="Enter list name..."
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                autoFocus
              />
            ) : (
              <select
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
              >
                <option value="">Select a list...</option>
                {callLists.map(list => (
                  <option key={list.id} value={list.id}>
                    {list.name} ({(list as any).pendingCount} pending)
                  </option>
                ))}
              </select>
            )}
          </div>
          
          {/* Phone filter */}
          <div className="space-y-3">
            <Label>Which phones to include?</Label>
            <RadioGroup value={phoneFilter} onValueChange={(v) => setPhoneFilter(v as 'all' | 'mobile' | 'first')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all-phones" />
                <Label htmlFor="all-phones" className="font-normal cursor-pointer">All phones</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="mobile" id="mobile-only" />
                <Label htmlFor="mobile-only" className="font-normal cursor-pointer">Mobile only</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="first" id="first-only" />
                <Label htmlFor="first-only" className="font-normal cursor-pointer">First phone only</Label>
              </div>
            </RadioGroup>
          </div>
          
          {/* Summary */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">{selectedProperties.length}</span> properties selected
            </p>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">{phoneCount}</span> phone contacts will be added
            </p>
          </div>
          
          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || (mode === 'new' && !newListName.trim()) || (mode === 'existing' && !selectedListId)}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add to List
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
