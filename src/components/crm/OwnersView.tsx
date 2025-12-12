import React, { useState, useMemo } from 'react';
import { OwnerTable } from './OwnerTable';
import { AggregatedOwner } from '@/hooks/useAllOwners';

interface OwnersViewProps {
  ownersData: { owners: AggregatedOwner[]; propertiesWithoutOwner: number } | undefined;
  ownersLoading: boolean;
  onSelectOwner: (ownerName: string) => void;
}

export const OwnersView: React.FC<OwnersViewProps> = ({
  ownersData,
  ownersLoading,
  onSelectOwner
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOwners = useMemo(() => {
    const owners = ownersData?.owners || [];
    if (!searchTerm.trim()) {
      return owners;
    }
    const term = searchTerm.toLowerCase();
    return owners.filter(owner => 
      owner.name.toLowerCase().includes(term) ||
      owner.email?.toLowerCase().includes(term) ||
      owner.phone?.includes(term)
    );
  }, [ownersData?.owners, searchTerm]);

  return (
    <div>
      <OwnerTable
        owners={filteredOwners}
        totalOwnerCount={ownersData?.owners?.length || 0}
        propertiesWithoutOwner={ownersData?.propertiesWithoutOwner || 0}
        isLoading={ownersLoading}
        onSelectOwner={onSelectOwner}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
      />
    </div>
  );
};
