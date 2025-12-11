import React, { useState, useCallback } from 'react';
import { useExclusionList, useExclusionCount, useAddExclusions, useDeleteExclusion, useClearExclusionList } from '@/hooks/useExclusionList';
import { useDeleteProperties } from '@/hooks/useProperties';
import { useAllExclusionMatches, useFindMatchesForExclusion } from '@/hooks/useAllExclusionMatches';
import { ExclusionEntry } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Upload, Trash2, Search, AlertTriangle, Ban, Plus, X, FileSpreadsheet, Eye, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const EXCLUSION_FIELDS = [
  { id: 'ownerName', label: 'Owner Name' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'address', label: 'Address' },
  { id: 'city', label: 'City' },
  { id: 'state', label: 'State' },
];

// Sub-component for viewing matches (uses its own hook)
const ViewMatchesDialog: React.FC<{
  entry: ExclusionEntry | null;
  onClose: () => void;
}> = ({ entry, onClose }) => {
  const { data: matches = [], isLoading } = useFindMatchesForExclusion(entry);

  return (
    <Dialog open={!!entry} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Matching Properties</DialogTitle>
          <DialogDescription>
            {isLoading ? 'Loading...' : `${matches.length} existing properties match this exclusion entry`}
            {entry?.ownerName && ` for "${entry.ownerName}"`}
            {entry?.address && ` at "${entry.address}"`}
          </DialogDescription>
        </DialogHeader>
        
        <div className="max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : matches.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No matching properties found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Address</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>City</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((property) => (
                  <TableRow key={property.id}>
                    <TableCell className="font-medium">{property.address}</TableCell>
                    <TableCell>{property.ownerName || '-'}</TableCell>
                    <TableCell>{property.city}, {property.state}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const ExclusionListManager: React.FC = () => {
  const { data: exclusions = [], isLoading } = useExclusionList();
  const { data: totalCount = 0 } = useExclusionCount();
  const { data: allMatches, isLoading: isLoadingMatches } = useAllExclusionMatches();
  const addExclusionsMutation = useAddExclusions();
  const deleteExclusionMutation = useDeleteExclusion();
  const clearListMutation = useClearExclusionList();
  const deletePropertiesMutation = useDeleteProperties();

  const [searchTerm, setSearchTerm] = useState('');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isAddManualOpen, setIsAddManualOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isDeleteMatchesConfirmOpen, setIsDeleteMatchesConfirmOpen] = useState(false);
  const [viewMatchesEntry, setViewMatchesEntry] = useState<ExclusionEntry | null>(null);

  // Use the database-queried match count and IDs
  const matchCount = allMatches?.count ?? 0;
  const matchingPropertyIds = allMatches?.propertyIds ?? [];

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [uploadStep, setUploadStep] = useState<'upload' | 'map'>('upload');

  // Manual add state
  const [manualEntry, setManualEntry] = useState({
    ownerName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    notes: '',
  });

  // Filter exclusions by search
  const filteredExclusions = exclusions.filter(e => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      e.ownerName?.toLowerCase().includes(search) ||
      e.email?.toLowerCase().includes(search) ||
      e.phone?.includes(search) ||
      e.address?.toLowerCase().includes(search) ||
      e.city?.toLowerCase().includes(search)
    );
  });

  // Parse CSV file
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      const parsed = lines.map(line => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (const char of line) {
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      });

      if (parsed.length > 0) {
        setCsvHeaders(parsed[0]);
        setCsvData(parsed.slice(1));
        setUploadStep('map');
        
        // Auto-map columns
        const autoMapping: Record<string, string> = {};
        parsed[0].forEach((header, idx) => {
          const h = header.toLowerCase();
          if (h.includes('owner') && h.includes('name') || h === 'name' || h === 'owner') {
            autoMapping[idx.toString()] = 'ownerName';
          } else if (h.includes('email')) {
            autoMapping[idx.toString()] = 'email';
          } else if (h.includes('phone') || h.includes('cell') || h.includes('mobile') || h === 'telephone') {
            autoMapping[idx.toString()] = 'phone';
          } else if (h.includes('address') && !h.includes('mail')) {
            autoMapping[idx.toString()] = 'address';
          } else if (h === 'city') {
            autoMapping[idx.toString()] = 'city';
          } else if (h === 'state' || h === 'st') {
            autoMapping[idx.toString()] = 'state';
          }
        });
        setColumnMapping(autoMapping);
      }
    };
    reader.readAsText(file);
  }, []);

  // Process import
  const handleImport = useCallback(() => {
    const entries = csvData.map(row => {
      const entry: Record<string, string> = {};
      Object.entries(columnMapping).forEach(([colIdx, fieldId]) => {
        if (fieldId !== 'skip') {
          entry[fieldId] = row[parseInt(colIdx)] || '';
        }
      });
      return {
        ownerName: entry.ownerName,
        email: entry.email,
        phone: entry.phone,
        address: entry.address,
        city: entry.city,
        state: entry.state,
        source: 'import' as const,
      };
    }).filter(e => e.ownerName || e.email || e.phone || e.address);

    if (entries.length === 0) {
      toast.error('No valid entries to import. Map at least one field.');
      return;
    }

    addExclusionsMutation.mutate(entries, {
      onSuccess: () => {
        toast.success(`Added ${entries.length} exclusion entries`);
        setIsUploadOpen(false);
        resetUpload();
      },
    });
  }, [csvData, columnMapping, addExclusionsMutation]);

  // Reset upload state
  const resetUpload = () => {
    setUploadFile(null);
    setCsvData([]);
    setCsvHeaders([]);
    setColumnMapping({});
    setUploadStep('upload');
  };

  // Handle manual add
  const handleManualAdd = () => {
    if (!manualEntry.ownerName && !manualEntry.email && !manualEntry.phone && !manualEntry.address) {
      toast.error('Please fill at least one field');
      return;
    }

    const newEntry = {
      ...manualEntry,
      source: 'manual' as const,
    };

    addExclusionsMutation.mutate([newEntry], {
      onSuccess: () => {
        toast.success('Added exclusion entry');
        setIsAddManualOpen(false);
        setManualEntry({ ownerName: '', email: '', phone: '', address: '', city: '', state: '', notes: '' });
      },
    });
  };

  // View matches for an exclusion entry
  const handleViewMatches = (entry: ExclusionEntry) => {
    setViewMatchesEntry(entry);
  };

  // Handle bulk delete of matching properties
  const handleDeleteMatchingProperties = () => {
    deletePropertiesMutation.mutate(matchingPropertyIds, {
      onSuccess: () => {
        setIsDeleteMatchesConfirmOpen(false);
        toast.success(`Deleted ${matchingPropertyIds.length} matching properties from database`);
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Exclusion List</h1>
          <p className="text-muted-foreground mt-1">
            Properties matching these criteria will be automatically filtered from imports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsAddManualOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Entry
          </Button>
          <Button onClick={() => setIsUploadOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Upload CSV
          </Button>
        </div>
      </div>

      {/* Stats Card */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <Ban className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalCount}</p>
                  <p className="text-sm text-muted-foreground">Total Exclusions</p>
                </div>
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  {isLoadingMatches ? (
                    <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  )}
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoadingMatches ? '...' : matchCount}</p>
                  <p className="text-sm text-muted-foreground">Properties Match</p>
                </div>
              </div>
            </div>
            {matchCount > 0 && (
              <Button 
                variant="destructive" 
                onClick={() => setIsDeleteMatchesConfirmOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete {matchCount} Matching Properties
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Search & Actions */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search exclusions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        {exclusions.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setIsClearConfirmOpen(true)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All
          </Button>
        )}
      </div>

      {/* Exclusion Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : filteredExclusions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Ban className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-medium">No exclusions yet</p>
              <p className="text-sm">Upload a CSV or add entries manually to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Owner Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Matches</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExclusions.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.ownerName || '-'}</TableCell>
                      <TableCell>{entry.email || '-'}</TableCell>
                      <TableCell>{entry.phone || '-'}</TableCell>
                      <TableCell>
                        {entry.address ? (
                          <span>
                            {entry.address}
                            {entry.city && `, ${entry.city}`}
                            {entry.state && ` ${entry.state}`}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full",
                          entry.source === 'import' 
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                        )}>
                          {entry.source}
                        </span>
                      </TableCell>
                      <TableCell>
                        {(allMatches?.matchesByEntry?.get(entry.id) ?? 0) > 0 ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-amber-600 hover:text-amber-700"
                            onClick={() => handleViewMatches(entry)}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View ({allMatches?.matchesByEntry?.get(entry.id)})
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteExclusionMutation.mutate(entry.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={isUploadOpen} onOpenChange={(open) => { setIsUploadOpen(open); if (!open) resetUpload(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Exclusion List</DialogTitle>
            <DialogDescription>
              Upload a CSV file with owner names, emails, or addresses to exclude from imports
            </DialogDescription>
          </DialogHeader>

          {uploadStep === 'upload' ? (
            <div className="space-y-4">
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => document.getElementById('exclusion-csv-input')?.click()}
              >
                <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Click to select a CSV file
                </p>
                <input
                  id="exclusion-csv-input"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Found {csvData.length} rows in {uploadFile?.name}
                </p>
                <Button variant="ghost" size="sm" onClick={resetUpload}>
                  Choose different file
                </Button>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Map Columns</Label>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {csvHeaders.map((header, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="w-48 text-sm truncate text-muted-foreground">{header}</span>
                      <Select
                        value={columnMapping[idx.toString()] || 'skip'}
                        onValueChange={(val) => setColumnMapping(prev => ({ ...prev, [idx.toString()]: val }))}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="skip">Skip</SelectItem>
                          {EXCLUSION_FIELDS.map(field => (
                            <SelectItem key={field.id} value={field.id}>{field.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              {csvData.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Preview (first row)</p>
                  <div className="text-sm space-y-1">
                    {Object.entries(columnMapping)
                      .filter(([_, fieldId]) => fieldId !== 'skip')
                      .map(([colIdx, fieldId]) => (
                        <div key={colIdx} className="flex gap-2">
                          <span className="font-medium">{EXCLUSION_FIELDS.find(f => f.id === fieldId)?.label}:</span>
                          <span className="text-muted-foreground">{csvData[0]?.[parseInt(colIdx)] || '(empty)'}</span>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsUploadOpen(false); resetUpload(); }}>
              Cancel
            </Button>
            {uploadStep === 'map' && (
              <Button onClick={handleImport} disabled={addExclusionsMutation.isPending}>
                {addExclusionsMutation.isPending ? 'Importing...' : `Import ${csvData.length} Entries`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Add Dialog */}
      <Dialog open={isAddManualOpen} onOpenChange={setIsAddManualOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Exclusion Entry</DialogTitle>
            <DialogDescription>
              Add an owner, email, or address to exclude from imports
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Owner Name</Label>
              <Input
                value={manualEntry.ownerName}
                onChange={(e) => setManualEntry(prev => ({ ...prev, ownerName: e.target.value }))}
                placeholder="John Smith"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={manualEntry.email}
                onChange={(e) => setManualEntry(prev => ({ ...prev, email: e.target.value }))}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                type="tel"
                value={manualEntry.phone}
                onChange={(e) => setManualEntry(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={manualEntry.address}
                onChange={(e) => setManualEntry(prev => ({ ...prev, address: e.target.value }))}
                placeholder="123 Main St"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={manualEntry.city}
                  onChange={(e) => setManualEntry(prev => ({ ...prev, city: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input
                  value={manualEntry.state}
                  onChange={(e) => setManualEntry(prev => ({ ...prev, state: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddManualOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleManualAdd} disabled={addExclusionsMutation.isPending}>
              {addExclusionsMutation.isPending ? 'Adding...' : 'Add Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Confirm Dialog */}
      <Dialog open={isClearConfirmOpen} onOpenChange={setIsClearConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Clear Exclusion List?
            </DialogTitle>
            <DialogDescription>
              This will permanently delete all {totalCount} entries from your exclusion list. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsClearConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                clearListMutation.mutate();
                setIsClearConfirmOpen(false);
              }}
              disabled={clearListMutation.isPending}
            >
              {clearListMutation.isPending ? 'Clearing...' : 'Clear All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Matches Dialog */}
      <ViewMatchesDialog 
        entry={viewMatchesEntry} 
        onClose={() => setViewMatchesEntry(null)} 
      />

      {/* Delete Matching Properties Confirm Dialog */}
      <Dialog open={isDeleteMatchesConfirmOpen} onOpenChange={setIsDeleteMatchesConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete Matching Properties?
            </DialogTitle>
            <DialogDescription>
              This will permanently delete <span className="font-semibold text-foreground">{matchCount} properties</span> from your database that match entries in your exclusion list. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteMatchesConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteMatchingProperties}
              disabled={deletePropertiesMutation.isPending}
            >
              {deletePropertiesMutation.isPending ? 'Deleting...' : `Delete ${matchCount} Properties`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
