import React, { useState } from 'react';
import { Property } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useMailingLists, useCreateMailingList, useAddToMailingList } from '@/hooks/useMailingLists';
import { Mail, Plus, Loader2 } from 'lucide-react';

interface AddToMailingListModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProperties: Property[];
  onSuccess?: () => void;
}

export const AddToMailingListModal: React.FC<AddToMailingListModalProps> = ({
  isOpen,
  onClose,
  selectedProperties,
  onSuccess,
}) => {
  const { data: mailingLists = [], isLoading: listsLoading } = useMailingLists();
  const createListMutation = useCreateMailingList();
  const addToListMutation = useAddToMailingList();
  
  const [mode, setMode] = useState<'existing' | 'new'>('new');
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [newListName, setNewListName] = useState('');
  const [dedupeByAddress, setDedupeByAddress] = useState(true);
  
  // Count addresses with mailing info
  const withMailingAddress = selectedProperties.filter(p => 
    p.owner.mailingAddress || p.address
  ).length;
  
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
      dedupeByAddress,
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
            <Mail className="w-5 h-5" />
            Add to Mailing List
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* List selection */}
          <div className="space-y-3">
            <Label>Select or Create List</Label>
            
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'existing' | 'new')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="new" id="mailing-new" />
                <Label htmlFor="mailing-new" className="font-normal cursor-pointer">Create new list</Label>
              </div>
              {mailingLists.length > 0 && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="existing" id="mailing-existing" />
                  <Label htmlFor="mailing-existing" className="font-normal cursor-pointer">Add to existing list</Label>
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
                {mailingLists.map(list => (
                  <option key={list.id} value={list.id}>
                    {list.name} ({(list as any).totalCount || 0} addresses)
                  </option>
                ))}
              </select>
            )}
          </div>
          
          {/* Dedupe option */}
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="dedupe-address" 
              checked={dedupeByAddress}
              onCheckedChange={(checked) => setDedupeByAddress(checked === true)}
            />
            <Label htmlFor="dedupe-address" className="font-normal cursor-pointer text-sm">
              Skip duplicates (same mailing address already in list)
            </Label>
          </div>
          
          {/* Summary */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">{selectedProperties.length}</span> properties selected
            </p>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">{withMailingAddress}</span> addresses will be added
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
