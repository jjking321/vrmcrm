import React, { useState } from 'react';
import { useMailingLists, useDeleteMailingList, useMailingListItems, useUpdateMailingListExport } from '@/hooks/useMailingLists';
import { Button } from '@/components/ui/button';
import { Mail, Trash2, Download, Eye, Loader2, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MailingListTable } from './MailingListTable';
import { MailingListFilterBar } from './MailingListFilterBar';
import { getBestMailingName } from '@/lib/ownerUtils';
import { deriveMailingFields } from '@/lib/mailingAddress';
import { useMailingListFiltering } from '@/hooks/useMailingListFiltering';
import { format } from 'date-fns';

export const MailingListsView: React.FC = () => {
  const { data: mailingLists = [], isLoading } = useMailingLists();
  const deleteListMutation = useDeleteMailingList();
  const updateExportMutation = useUpdateMailingListExport();
  
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const { data: listItems = [], isLoading: itemsLoading } = useMailingListItems(selectedListId);
  
  const selectedList = mailingLists.find(l => l.id === selectedListId);
  
  // Initialize filtering hook
  const {
    searchTerm,
    setSearchTerm,
    filterRules,
    matchType,
    setMatchType,
    filteredItems,
    totalCount,
    filteredCount,
    addFilterRule,
    updateFilterRule,
    removeFilterRule,
    clearFilters,
    hasActiveFilters,
  } = useMailingListFiltering(listItems);
  
  const handleDelete = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) {
      deleteListMutation.mutate(id);
      if (selectedListId === id) {
        setSelectedListId(null);
      }
    }
  };
  
  const handleExportCSV = (listId: string, listName: string) => {
    // Use filtered items for export
    const itemsToExport = hasActiveFilters ? filteredItems : filteredItems;
    
    if (itemsToExport.length === 0) {
      return;
    }
    
    // Build CSV content
    const headers = ['Name', 'Address', 'City', 'State', 'ZIP', 'Property_Address', 'ContactID'];
    const rows = itemsToExport.map(derived => {
      // Escape fields that might contain commas
      const escapeField = (field: string) => {
        if (field.includes(',') || field.includes('"')) {
          return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
      };
      
      return [
        escapeField(derived.contactName),
        escapeField(derived.mailingAddress),
        escapeField(derived.mailingCity),
        escapeField(derived.mailingState),
        escapeField(derived.mailingZip),
        escapeField(derived.propertyAddress),
        derived.ownerId || '',
      ].join(',');
    });
    
    const csv = [headers.join(','), ...rows].join('\n');
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${listName.replace(/[^a-z0-9]/gi, '_')}_mailing_list.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    // Update export tracking
    updateExportMutation.mutate(listId);
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  // Show list detail view
  if (selectedListId && selectedList) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setSelectedListId(null)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{selectedList.name}</h1>
              <p className="text-sm text-muted-foreground">
                {(selectedList as any).totalCount || 0} addresses
                {selectedList.exportedAt && (
                  <> · Last exported {format(new Date(selectedList.exportedAt), 'MMM d, yyyy')}</>
                )}
              </p>
            </div>
          </div>
          <Button 
            onClick={() => handleExportCSV(selectedListId, selectedList.name)}
            disabled={filteredItems.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV{hasActiveFilters && ` (${filteredCount})`}
          </Button>
        </div>
        
        {/* Search and filter bar */}
        <div className="mb-4">
          <MailingListFilterBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            filterRules={filterRules}
            onAddRule={addFilterRule}
            onUpdateRule={updateFilterRule}
            onRemoveRule={removeFilterRule}
            matchType={matchType}
            onMatchTypeChange={setMatchType}
            onClearFilters={clearFilters}
            totalCount={totalCount}
            filteredCount={filteredCount}
            hasActiveFilters={hasActiveFilters}
          />
        </div>
        
        {itemsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredItems.length === 0 && hasActiveFilters ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center">
            <p className="text-muted-foreground mb-4">No contacts match your search or filters</p>
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        ) : (
          <MailingListTable items={filteredItems.map(d => d.item)} />
        )}
      </div>
    );
  }
  
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Mailing Lists</h1>
        <p className="text-sm text-muted-foreground">
          Create mailing lists from the Properties table using bulk selection
        </p>
      </div>
      
      {mailingLists.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <Mail className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No mailing lists yet</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Select properties in the Properties table, then click "Mailing List" in the bulk actions bar to create your first mailing list.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mailingLists.map((list: any) => (
            <div
              key={list.id}
              className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => setSelectedListId(list.id)}
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-medium text-foreground">{list.name}</h3>
                <button
                  onClick={(e) => handleDelete(list.id, list.name, e)}
                  className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              {/* Stats */}
              <div className="flex gap-4 text-sm mb-4">
                <div>
                  <span className="text-muted-foreground">Addresses: </span>
                  <span className="font-medium text-foreground">{list.totalCount}</span>
                </div>
                {list.exportCount > 0 && (
                  <div>
                    <span className="text-muted-foreground">Exports: </span>
                    <span className="font-medium text-foreground">{list.exportCount}</span>
                  </div>
                )}
              </div>
              
              {/* Export info */}
              {list.exportedAt && (
                <p className="text-xs text-muted-foreground mb-4">
                  Last exported {format(new Date(list.exportedAt), 'MMM d, yyyy')}
                </p>
              )}
              
              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedListId(list.id);
                  }}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedListId(list.id);
                    // Will trigger export after items load
                    setTimeout(() => handleExportCSV(list.id, list.name), 500);
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
