import React, { useState } from 'react';
import { MailingListItem, Owner } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getBestMailingName } from '@/lib/ownerUtils';
import { deriveMailingFields } from '@/lib/mailingAddress';
import { useRemoveMailingListItem } from '@/hooks/useMailingLists';
import { useUpdateProperty } from '@/hooks/useProperties';
import { Trash2 } from 'lucide-react';
import { MailingContactDetailModal } from './MailingContactDetailModal';
import { toast } from 'sonner';

interface MailingListTableProps {
  items: (MailingListItem & { property?: any })[];
}

export const MailingListTable: React.FC<MailingListTableProps> = ({ items }) => {
  const removeItemMutation = useRemoveMailingListItem();
  const updatePropertyMutation = useUpdateProperty();
  const [selectedItem, setSelectedItem] = useState<(MailingListItem & { property?: any }) | null>(null);
  
  const handleRemove = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    if (confirm('Remove this address from the mailing list?')) {
      removeItemMutation.mutate(itemId);
    }
  };

  const handleRowClick = (item: MailingListItem & { property?: any }) => {
    if (item.property) {
      setSelectedItem(item);
    }
  };

  const handleSave = (propertyId: string, ownerUpdates: Partial<Owner>) => {
    updatePropertyMutation.mutate(
      {
        id: propertyId,
        updates: {
          owner: {
            ...selectedItem?.property?.owner,
            ...ownerUpdates,
          },
        },
      },
      {
        onSuccess: () => {
          toast.success('Contact updated successfully');
          setSelectedItem(null);
        },
        onError: (error) => {
          toast.error(`Failed to update: ${error.message}`);
        },
      }
    );
  };
  
  if (items.length === 0) {
    return (
      <div className="bg-muted/50 rounded-lg p-8 text-center">
        <p className="text-muted-foreground">No addresses in this mailing list yet.</p>
      </div>
    );
  }
  
  return (
    <>
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-medium">Contact Name</TableHead>
              <TableHead className="font-medium">Mailing Address</TableHead>
              <TableHead className="font-medium">City</TableHead>
              <TableHead className="font-medium">State</TableHead>
              <TableHead className="font-medium">ZIP</TableHead>
              <TableHead className="font-medium text-muted-foreground">Property Address</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const property = item.property;
              if (!property) return null;
              
              const owner = property.owner;
              const contactName = getBestMailingName(owner);

              const { mailingAddress, mailingCity, mailingState, mailingZip, isCanadian } =
                deriveMailingFields(owner, property);
              
              return (
                <TableRow 
                  key={item.id} 
                  className="hover:bg-muted/30 cursor-pointer"
                  onClick={() => handleRowClick(item)}
                >
                  <TableCell className="font-medium">{contactName}</TableCell>
                  <TableCell>{mailingAddress}</TableCell>
                  <TableCell>{mailingCity}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{mailingState}</span>
                      {isCanadian && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                          CA
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{mailingZip}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {property.address}, {property.city}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={(e) => handleRemove(e, item.id)}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                      title="Remove from list"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {selectedItem && (
        <MailingContactDetailModal
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          item={selectedItem}
          onSave={handleSave}
          isSaving={updatePropertyMutation.isPending}
        />
      )}
    </>
  );
};
