import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Upload, Download, ArrowRight, Trash2, Merge, Edit, 
  ChevronDown, Undo, Check, AlertCircle, Sparkles, MapPin, Wrench, RefreshCw, CheckCircle2, Circle, Copy, User, Mail
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useMalformedAddresses, useFixAddresses, useFixSingleAddress, useUpdatePropertyAddress, useApplyLocalParse, tryLocalParse, MalformedProperty, FixAddressesResult } from '@/hooks/useAddressFixer';
import { useMalformedMailingAddresses, useFixMailingAddresses, useFixSingleMailingAddress, useUpdateOwnerMailingAddress, useApplyLocalMailingParse, tryLocalMailingParse, MalformedMailingAddress } from '@/hooks/useMailingAddressFixer';
import { useUnverifiedAddresses, useBulkVerifyAddresses } from '@/hooks/useAddressVerification';
import { useDuplicates, useAutoMergeDuplicates, DuplicateGroup } from '@/hooks/useDuplicateDetection';
import { DuplicateMergeModal } from './DuplicateMergeModal';
import { DuplicateWizard } from './DuplicateWizard';
import { useOwnerNameVariations, useNormalizeOwnerNames, useNormalizeSingleGroup, OwnerNameVariation } from '@/hooks/useOwnerNameFixer';

interface DataCleanupToolProps {
  onSendToImport?: (data: any[], headers: string[]) => void;
}

type TransformAction = {
  type: 'combine' | 'rename' | 'delete' | 'transform';
  columns: string[];
  newName?: string;
  transformType?: 'trim' | 'uppercase' | 'lowercase' | 'titlecase';
};

export const DataCleanupTool: React.FC<DataCleanupToolProps> = ({ onSendToImport }) => {
  const [activeTab, setActiveTab] = useState<'csv' | 'fix-addresses' | 'verify-addresses' | 'fix-mailing-addresses' | 'duplicates' | 'fix-owner-names'>('duplicates');
  const [step, setStep] = useState<'upload' | 'transform' | 'preview'>('upload');
  const [rawData, setRawData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [transformedData, setTransformedData] = useState<any[]>([]);
  const [transformedHeaders, setTransformedHeaders] = useState<string[]>([]);
  const [history, setHistory] = useState<{ data: any[]; headers: string[] }[]>([]);
  const [fileName, setFileName] = useState<string>('');
  
  // Modal states
  const [combineModalOpen, setCombineModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [combineColumns, setCombineColumns] = useState<string[]>([]);
  const [newColumnName, setNewColumnName] = useState('');
  const [separator, setSeparator] = useState(' ');

  // Address fixer hooks
  const { data: malformedAddresses = [], isLoading: isLoadingMalformed, refetch: refetchMalformed } = useMalformedAddresses();
  const fixAddressesMutation = useFixAddresses();
  const fixSingleMutation = useFixSingleAddress();
  const updateAddressMutation = useUpdatePropertyAddress();
  const applyLocalParseMutation = useApplyLocalParse();
  const [failedAddresses, setFailedAddresses] = useState<MalformedProperty[]>([]);
  
  // Edit modal state
  const [editingProperty, setEditingProperty] = useState<MalformedProperty | null>(null);
  const [editForm, setEditForm] = useState({ address: '', city: '', state: '', zip: '' });

  // Address verification hooks
  const { data: verificationData, isLoading: isLoadingVerification, refetch: refetchVerification } = useUnverifiedAddresses();
  const bulkVerifyMutation = useBulkVerifyAddresses();

  // Duplicate detection hooks
  const { data: duplicateGroups = [], isLoading: isLoadingDuplicates, refetch: refetchDuplicates } = useDuplicates();
  const autoMergeMutation = useAutoMergeDuplicates();
  const [selectedDuplicateGroup, setSelectedDuplicateGroup] = useState<DuplicateGroup | null>(null);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Owner name normalization hooks
  const { data: ownerNameVariations = [], isLoading: isLoadingOwnerNames, refetch: refetchOwnerNames } = useOwnerNameVariations();
  const normalizeAllMutation = useNormalizeOwnerNames();
  const normalizeSingleMutation = useNormalizeSingleGroup();

  // Mailing address fixer hooks
  const { data: malformedMailingAddresses = [], isLoading: isLoadingMailingAddresses, refetch: refetchMailingAddresses } = useMalformedMailingAddresses();
  const fixMailingAddressesMutation = useFixMailingAddresses();
  const fixSingleMailingMutation = useFixSingleMailingAddress();
  const updateMailingAddressMutation = useUpdateOwnerMailingAddress();
  const applyLocalMailingParseMutation = useApplyLocalMailingParse();
  const [failedMailingAddresses, setFailedMailingAddresses] = useState<MalformedMailingAddress[]>([]);
  
  // Mailing address edit modal state
  const [editingMailingAddress, setEditingMailingAddress] = useState<MalformedMailingAddress | null>(null);
  const [editMailingForm, setEditMailingForm] = useState({ address: '', city: '', state: '', zip: '' });

  const totalDuplicateProperties = duplicateGroups.reduce((sum, g) => sum + g.properties.length, 0);

  // Suggestions for auto-detection
  const suggestions = useMemo(() => {
    const found: { message: string; action: () => void }[] = [];
    
    // Detect split address columns
    const streetNoCol = headers.find(h => 
      h.toLowerCase().includes('street no') || 
      h.toLowerCase().includes('street number') ||
      h.toLowerCase() === 'streetno'
    );
    const streetNameCol = headers.find(h => 
      (h.toLowerCase().includes('street name') || h.toLowerCase() === 'streetname') &&
      !h.toLowerCase().includes('no')
    );
    
    if (streetNoCol && streetNameCol) {
      found.push({
        message: `Combine "${streetNoCol}" + "${streetNameCol}" into "Mailing Address"`,
        action: () => {
          handleCombineColumns([streetNoCol, streetNameCol], 'Mailing Address', ' ');
        }
      });
    }

    // Detect first/last name columns
    const firstNameCol = headers.find(h => 
      h.toLowerCase().includes('first') && h.toLowerCase().includes('name')
    );
    const lastNameCol = headers.find(h => 
      h.toLowerCase().includes('last') && h.toLowerCase().includes('name')
    );
    
    if (firstNameCol && lastNameCol) {
      found.push({
        message: `Combine "${firstNameCol}" + "${lastNameCol}" into "Owner Name"`,
        action: () => {
          handleCombineColumns([firstNameCol, lastNameCol], 'Owner Name', ' ');
        }
      });
    }

    return found;
  }, [headers]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        toast.error('File is empty');
        return;
      }

      // Parse CSV
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
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
      };

      const headerRow = parseCSVLine(lines[0]);
      const dataRows = lines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const row: Record<string, string> = {};
        headerRow.forEach((header, i) => {
          row[header] = values[i] || '';
        });
        return row;
      });

      setHeaders(headerRow);
      setRawData(dataRows);
      setTransformedHeaders(headerRow);
      setTransformedData(dataRows);
      setHistory([]);
      setStep('transform');
      toast.success(`Loaded ${dataRows.length} rows`);
    };
    reader.readAsText(file);
  }, []);

  const saveToHistory = useCallback(() => {
    setHistory(prev => [...prev, { data: [...transformedData], headers: [...transformedHeaders] }]);
  }, [transformedData, transformedHeaders]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setTransformedData(last.data);
    setTransformedHeaders(last.headers);
    setHistory(prev => prev.slice(0, -1));
    toast.info('Undone');
  }, [history]);

  const handleCombineColumns = useCallback((cols: string[], name: string, sep: string) => {
    saveToHistory();
    
    const newHeaders = transformedHeaders.filter(h => !cols.includes(h));
    // Insert new column at position of first combined column
    const insertIdx = transformedHeaders.findIndex(h => cols.includes(h));
    newHeaders.splice(insertIdx, 0, name);

    const newData = transformedData.map(row => {
      const newRow = { ...row };
      
      // Smart combine with deduplication for messy data
      const values = cols.map(c => (row[c] || '').toString().trim()).filter(Boolean);
      let combined = '';
      
      if (values.length === 2) {
        const [first, second] = values;
        // Check if first value already contains second (e.g., "1695 GRACEWOOD DR" + "GRACEWOOD DR")
        const firstWords = first.toLowerCase().split(/\s+/);
        const secondWords = second.toLowerCase().split(/\s+/);
        
        if (secondWords.every(w => firstWords.includes(w))) {
          combined = first; // Use first value as it's more complete
        } else if (firstWords.every(w => secondWords.includes(w))) {
          combined = second; // Use second value as it's more complete
        } else {
          combined = values.join(sep);
        }
      } else {
        combined = values.join(sep);
      }
      
      newRow[name] = combined;
      cols.forEach(c => delete newRow[c]);
      return newRow;
    });

    setTransformedHeaders(newHeaders);
    setTransformedData(newData);
    setCombineModalOpen(false);
    setCombineColumns([]);
    setNewColumnName('');
    toast.success(`Combined columns into "${name}"`);
  }, [transformedData, transformedHeaders, saveToHistory]);

  const handleRenameColumn = useCallback((oldName: string, newName: string) => {
    if (!newName.trim()) return;
    saveToHistory();

    const newHeaders = transformedHeaders.map(h => h === oldName ? newName : h);
    const newData = transformedData.map(row => {
      const newRow = { ...row };
      newRow[newName] = row[oldName];
      delete newRow[oldName];
      return newRow;
    });

    setTransformedHeaders(newHeaders);
    setTransformedData(newData);
    setRenameModalOpen(false);
    setSelectedColumn('');
    setNewColumnName('');
    toast.success(`Renamed column to "${newName}"`);
  }, [transformedData, transformedHeaders, saveToHistory]);

  const handleDeleteColumn = useCallback((column: string) => {
    saveToHistory();
    
    const newHeaders = transformedHeaders.filter(h => h !== column);
    const newData = transformedData.map(row => {
      const newRow = { ...row };
      delete newRow[column];
      return newRow;
    });

    setTransformedHeaders(newHeaders);
    setTransformedData(newData);
    toast.success(`Deleted column "${column}"`);
  }, [transformedData, transformedHeaders, saveToHistory]);

  const handleTransformColumn = useCallback((column: string, type: 'trim' | 'uppercase' | 'lowercase' | 'titlecase') => {
    saveToHistory();

    const transform = (val: string): string => {
      switch (type) {
        case 'trim': return val.trim();
        case 'uppercase': return val.toUpperCase();
        case 'lowercase': return val.toLowerCase();
        case 'titlecase': return val.replace(/\w\S*/g, txt => 
          txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
        default: return val;
      }
    };

    const newData = transformedData.map(row => ({
      ...row,
      [column]: transform(row[column] || '')
    }));

    setTransformedData(newData);
    toast.success(`Applied ${type} to "${column}"`);
  }, [transformedData, saveToHistory]);

  const handleRemoveDuplicates = useCallback(() => {
    saveToHistory();
    const seen = new Set<string>();
    const newData = transformedData.filter(row => {
      const key = JSON.stringify(row);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    const removed = transformedData.length - newData.length;
    setTransformedData(newData);
    toast.success(`Removed ${removed} duplicate rows`);
  }, [transformedData, saveToHistory]);

  const handleRemoveEmptyRows = useCallback(() => {
    saveToHistory();
    const newData = transformedData.filter(row => 
      Object.values(row).some(v => v && v.toString().trim())
    );
    
    const removed = transformedData.length - newData.length;
    setTransformedData(newData);
    toast.success(`Removed ${removed} empty rows`);
  }, [transformedData, saveToHistory]);

  const handleDownloadCSV = useCallback(() => {
    const csvContent = [
      transformedHeaders.join(','),
      ...transformedData.map(row => 
        transformedHeaders.map(h => {
          const val = row[h] || '';
          return val.includes(',') || val.includes('"') 
            ? `"${val.replace(/"/g, '""')}"` 
            : val;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cleaned_${fileName || 'data.csv'}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded cleaned CSV');
  }, [transformedData, transformedHeaders, fileName]);

  const handleSendToImport = useCallback(() => {
    if (onSendToImport) {
      onSendToImport(transformedData, transformedHeaders);
    } else {
      toast.info('Send to Import not configured yet');
    }
  }, [transformedData, transformedHeaders, onSendToImport]);

  const openCombineModal = (column: string) => {
    setSelectedColumn(column);
    setCombineColumns([column]);
    setCombineModalOpen(true);
  };

  const openRenameModal = (column: string) => {
    setSelectedColumn(column);
    setNewColumnName(column);
    setRenameModalOpen(true);
  };

  // Handle fix addresses with failure tracking
  const handleFixAddresses = async (addresses: MalformedProperty[]) => {
    const result = await fixAddressesMutation.mutateAsync(addresses);
    if (result.failed.length > 0) {
      setFailedAddresses(result.failed);
    } else {
      setFailedAddresses([]);
    }
  };

  // Handle local parse attempt for single address
  const handleTryParse = (prop: MalformedProperty) => {
    const { success, parsed } = tryLocalParse(prop);
    if (success) {
      toast.success(
        `Parsed: ${parsed.street}, ${parsed.city}, ${parsed.state} ${parsed.zip}`,
        {
          action: {
            label: 'Apply',
            onClick: () => {
              applyLocalParseMutation.mutate(
                { propertyId: prop.id, parsed },
                {
                  onSuccess: () => toast.success('Address updated'),
                  onError: (err) => toast.error(`Failed: ${err.message}`),
                }
              );
            },
          },
        }
      );
    } else {
      toast.error('Could not parse locally - try Geocodio or edit manually');
    }
  };

  // Handle Geocodio for single address
  const handleSendToGeocodio = (prop: MalformedProperty) => {
    fixSingleMutation.mutate(prop, {
      onSuccess: (standardized) => {
        toast.success(`Fixed: ${standardized.street}, ${standardized.city}, ${standardized.state} ${standardized.zip}`);
      },
      onError: (err) => {
        toast.error(`Geocodio failed: ${err.message}`);
      },
    });
  };

  // Open edit modal
  const handleOpenEdit = (prop: MalformedProperty) => {
    setEditingProperty(prop);
    setEditForm({
      address: prop.address,
      city: prop.city,
      state: prop.state,
      zip: prop.zip,
    });
  };

  // Save manual edit
  const handleSaveEdit = () => {
    if (!editingProperty) return;
    updateAddressMutation.mutate(
      { id: editingProperty.id, ...editForm },
      {
        onSuccess: () => {
          toast.success('Address updated');
          setEditingProperty(null);
        },
        onError: (err) => toast.error(`Failed: ${err.message}`),
      }
    );
  };

  // ==================== MAILING ADDRESS FIXER HANDLERS ====================
  
  // Handle fix all mailing addresses
  const handleFixMailingAddresses = async (addresses: MalformedMailingAddress[]) => {
    const result = await fixMailingAddressesMutation.mutateAsync(addresses);
    if (result.failed.length > 0) {
      setFailedMailingAddresses(result.failed);
    } else {
      setFailedMailingAddresses([]);
    }
  };

  // Handle local parse attempt for single mailing address
  const handleTryMailingParse = (addr: MalformedMailingAddress) => {
    const { success, parsed } = tryLocalMailingParse(addr);
    if (success) {
      toast.success(
        `Parsed: ${parsed.street}, ${parsed.city}, ${parsed.state} ${parsed.zip}`,
        {
          action: {
            label: 'Apply',
            onClick: () => {
              applyLocalMailingParseMutation.mutate(
                { ownerId: addr.ownerId, parsed },
                {
                  onSuccess: () => toast.success('Mailing address updated'),
                  onError: (err) => toast.error(`Failed: ${err.message}`),
                }
              );
            },
          },
        }
      );
    } else {
      toast.error('Could not parse locally - try Geocodio or edit manually');
    }
  };

  // Handle Geocodio for single mailing address
  const handleSendMailingToGeocodio = (addr: MalformedMailingAddress) => {
    fixSingleMailingMutation.mutate(addr, {
      onSuccess: (standardized) => {
        toast.success(`Fixed: ${standardized.street}, ${standardized.city}, ${standardized.state} ${standardized.zip}`);
      },
      onError: (err) => {
        toast.error(`Geocodio failed: ${err.message}`);
      },
    });
  };

  // Open mailing address edit modal
  const handleOpenMailingEdit = (addr: MalformedMailingAddress) => {
    setEditingMailingAddress(addr);
    setEditMailingForm({
      address: addr.mailingAddress,
      city: addr.mailingCity,
      state: addr.mailingState,
      zip: addr.mailingZip,
    });
  };

  // Save mailing address manual edit
  const handleSaveMailingEdit = () => {
    if (!editingMailingAddress) return;
    updateMailingAddressMutation.mutate(
      { 
        ownerId: editingMailingAddress.ownerId, 
        mailingAddress: editMailingForm.address,
        mailingCity: editMailingForm.city,
        mailingState: editMailingForm.state,
        mailingZip: editMailingForm.zip,
      },
      {
        onSuccess: () => {
          toast.success('Mailing address updated');
          setEditingMailingAddress(null);
        },
        onError: (err) => toast.error(`Failed: ${err.message}`),
      }
    );
  };

  // Render Address Fixer Tab
  const renderAddressFixer = () => (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Fix Incomplete Addresses</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Parse locally first, then use Geocodio for remaining addresses
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { refetchMalformed(); setFailedAddresses([]); }}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      {isLoadingMalformed ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Scanning for incomplete addresses...
          </CardContent>
        </Card>
      ) : malformedAddresses.length === 0 && failedAddresses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Check className="w-12 h-12 mx-auto text-green-500 mb-4" />
            <p className="text-lg font-medium text-foreground">All addresses are complete!</p>
            <p className="text-sm text-muted-foreground mt-1">
              No properties found with missing city, state, or zip.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Incomplete addresses to fix */}
          {malformedAddresses.length > 0 && (
            <>
              <Card className="mb-4 border-amber-500/30 bg-amber-500/5">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-500" />
                      <div>
                        <p className="font-medium text-foreground">
                          Found {malformedAddresses.length} properties with incomplete addresses
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Local parse attempted first, then Geocodio for remaining
                        </p>
                      </div>
                    </div>
                    <Button 
                      onClick={() => handleFixAddresses(malformedAddresses)}
                      disabled={fixAddressesMutation.isPending}
                    >
                      <Wrench className="w-4 h-4 mr-1" />
                      Fix All {malformedAddresses.length}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="mb-4">
                <CardContent className="p-0">
                  <div className="overflow-auto max-h-[40vh]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-card z-10">
                        <TableRow>
                          <TableHead>Address</TableHead>
                          <TableHead>City</TableHead>
                          <TableHead>State</TableHead>
                          <TableHead>Zip</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {malformedAddresses.map((prop) => (
                          <TableRow key={prop.id}>
                            <TableCell className="font-mono text-sm">
                              {prop.address}
                            </TableCell>
                            <TableCell className={cn("text-sm", !prop.city && "text-muted-foreground italic")}>
                              {prop.city || '(empty)'}
                            </TableCell>
                            <TableCell className={cn("text-sm", !prop.state && "text-muted-foreground italic")}>
                              {prop.state || '(empty)'}
                            </TableCell>
                            <TableCell className={cn("text-sm", !prop.zip && "text-muted-foreground italic")}>
                              {prop.zip || '(empty)'}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 justify-end">
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => handleTryParse(prop)}
                                  disabled={applyLocalParseMutation.isPending}
                                  title="Try local parse"
                                >
                                  <Sparkles className="w-3 h-3" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => handleSendToGeocodio(prop)}
                                  disabled={fixSingleMutation.isPending}
                                  title="Send to Geocodio"
                                >
                                  <MapPin className="w-3 h-3" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => handleOpenEdit(prop)}
                                  title="Edit manually"
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Failed addresses - could not be fixed */}
          {failedAddresses.length > 0 && (
            <>
              <Card className="mb-4 border-destructive/30 bg-destructive/5">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-destructive" />
                      <div>
                        <p className="font-medium text-foreground">
                          {failedAddresses.length} addresses could not be parsed
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Try editing manually or retry with Geocodio
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="outline"
                      onClick={() => handleFixAddresses(failedAddresses)}
                      disabled={fixAddressesMutation.isPending}
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Retry All
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-0">
                  <div className="overflow-auto max-h-[30vh]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-card z-10">
                        <TableRow>
                          <TableHead>Address</TableHead>
                          <TableHead>City</TableHead>
                          <TableHead>State</TableHead>
                          <TableHead>Zip</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {failedAddresses.map((prop) => (
                          <TableRow key={prop.id}>
                            <TableCell className="font-mono text-sm text-destructive">
                              {prop.address}
                            </TableCell>
                            <TableCell className={cn("text-sm", !prop.city && "text-muted-foreground italic")}>
                              {prop.city || '(empty)'}
                            </TableCell>
                            <TableCell className={cn("text-sm", !prop.state && "text-muted-foreground italic")}>
                              {prop.state || '(empty)'}
                            </TableCell>
                            <TableCell className={cn("text-sm", !prop.zip && "text-muted-foreground italic")}>
                              {prop.zip || '(empty)'}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 justify-end">
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => handleSendToGeocodio(prop)}
                                  disabled={fixSingleMutation.isPending}
                                  title="Retry Geocodio"
                                >
                                  <MapPin className="w-3 h-3" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => handleOpenEdit(prop)}
                                  title="Edit manually"
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {/* Edit Address Modal */}
      <Dialog open={!!editingProperty} onOpenChange={(open) => !open && setEditingProperty(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Address</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-address">Street Address</Label>
              <Input
                id="edit-address"
                value={editForm.address}
                onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                placeholder="123 Main St"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="edit-city">City</Label>
                <Input
                  id="edit-city"
                  value={editForm.city}
                  onChange={(e) => setEditForm(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="City"
                />
              </div>
              <div>
                <Label htmlFor="edit-state">State</Label>
                <Input
                  id="edit-state"
                  value={editForm.state}
                  onChange={(e) => setEditForm(prev => ({ ...prev, state: e.target.value }))}
                  placeholder="FL"
                  maxLength={2}
                />
              </div>
              <div>
                <Label htmlFor="edit-zip">Zip</Label>
                <Input
                  id="edit-zip"
                  value={editForm.zip}
                  onChange={(e) => setEditForm(prev => ({ ...prev, zip: e.target.value }))}
                  placeholder="12345"
                  maxLength={10}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProperty(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={updateAddressMutation.isPending}>
              {updateAddressMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  // Render Mailing Address Fixer Tab
  const renderMailingAddressFixer = () => (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Fix Mailing Addresses</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Parse and fix mailing addresses that have city/state/zip embedded in the street field
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { refetchMailingAddresses(); setFailedMailingAddresses([]); }}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      {isLoadingMailingAddresses ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Scanning for malformed mailing addresses...
          </CardContent>
        </Card>
      ) : malformedMailingAddresses.length === 0 && failedMailingAddresses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Check className="w-12 h-12 mx-auto text-green-500 mb-4" />
            <p className="text-lg font-medium text-foreground">All mailing addresses are properly formatted!</p>
            <p className="text-sm text-muted-foreground mt-1">
              No addresses found with embedded city/state/zip that need fixing.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Malformed mailing addresses to fix */}
          {malformedMailingAddresses.length > 0 && (
            <>
              <Card className="mb-4 border-amber-500/30 bg-amber-500/5">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-500" />
                      <div>
                        <p className="font-medium text-foreground">
                          Found {malformedMailingAddresses.length} mailing addresses with embedded city/state/zip
                        </p>
                        <p className="text-sm text-muted-foreground">
                          These addresses have full address data in the street field
                        </p>
                      </div>
                    </div>
                    <Button 
                      onClick={() => handleFixMailingAddresses(malformedMailingAddresses)}
                      disabled={fixMailingAddressesMutation.isPending}
                    >
                      <Wrench className="w-4 h-4 mr-1" />
                      Fix All {malformedMailingAddresses.length}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="mb-4">
                <CardContent className="p-0">
                  <div className="overflow-auto max-h-[40vh]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-card z-10">
                        <TableRow>
                          <TableHead>Mailing Address (Full)</TableHead>
                          <TableHead>Current City</TableHead>
                          <TableHead>Current State</TableHead>
                          <TableHead>Current Zip</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {malformedMailingAddresses.map((addr) => (
                          <TableRow key={addr.ownerId}>
                            <TableCell className="font-mono text-sm max-w-[300px]">
                              <div className="truncate" title={addr.mailingAddress}>
                                {addr.mailingAddress}
                              </div>
                            </TableCell>
                            <TableCell className={cn("text-sm", addr.mailingCity === addr.propertyCity && "text-amber-600 font-medium")}>
                              {addr.mailingCity || <span className="text-muted-foreground italic">(empty)</span>}
                              {addr.mailingCity === addr.propertyCity && (
                                <span className="ml-1 text-xs">(= property)</span>
                              )}
                            </TableCell>
                            <TableCell className={cn("text-sm", addr.mailingState === addr.propertyState && "text-amber-600 font-medium")}>
                              {addr.mailingState || <span className="text-muted-foreground italic">(empty)</span>}
                            </TableCell>
                            <TableCell className="text-sm">
                              {addr.mailingZip || <span className="text-muted-foreground italic">(empty)</span>}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 justify-end">
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => handleTryMailingParse(addr)}
                                  disabled={applyLocalMailingParseMutation.isPending}
                                  title="Try local parse"
                                >
                                  <Sparkles className="w-3 h-3" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => handleSendMailingToGeocodio(addr)}
                                  disabled={fixSingleMailingMutation.isPending}
                                  title="Send to Geocodio"
                                >
                                  <MapPin className="w-3 h-3" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => handleOpenMailingEdit(addr)}
                                  title="Edit manually"
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Failed mailing addresses - could not be fixed */}
          {failedMailingAddresses.length > 0 && (
            <>
              <Card className="mb-4 border-destructive/30 bg-destructive/5">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-destructive" />
                      <div>
                        <p className="font-medium text-foreground">
                          {failedMailingAddresses.length} mailing addresses could not be parsed
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Try editing manually or retry with Geocodio
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="outline"
                      onClick={() => handleFixMailingAddresses(failedMailingAddresses)}
                      disabled={fixMailingAddressesMutation.isPending}
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Retry All
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-0">
                  <div className="overflow-auto max-h-[30vh]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-card z-10">
                        <TableRow>
                          <TableHead>Mailing Address</TableHead>
                          <TableHead>City</TableHead>
                          <TableHead>State</TableHead>
                          <TableHead>Zip</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {failedMailingAddresses.map((addr) => (
                          <TableRow key={addr.ownerId}>
                            <TableCell className="font-mono text-sm text-destructive">
                              {addr.mailingAddress}
                            </TableCell>
                            <TableCell className={cn("text-sm", !addr.mailingCity && "text-muted-foreground italic")}>
                              {addr.mailingCity || '(empty)'}
                            </TableCell>
                            <TableCell className={cn("text-sm", !addr.mailingState && "text-muted-foreground italic")}>
                              {addr.mailingState || '(empty)'}
                            </TableCell>
                            <TableCell className={cn("text-sm", !addr.mailingZip && "text-muted-foreground italic")}>
                              {addr.mailingZip || '(empty)'}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 justify-end">
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => handleSendMailingToGeocodio(addr)}
                                  disabled={fixSingleMailingMutation.isPending}
                                  title="Retry Geocodio"
                                >
                                  <MapPin className="w-3 h-3" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => handleOpenMailingEdit(addr)}
                                  title="Edit manually"
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {/* Edit Mailing Address Modal */}
      <Dialog open={!!editingMailingAddress} onOpenChange={(open) => !open && setEditingMailingAddress(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Mailing Address</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-mailing-address">Street Address</Label>
              <Input
                id="edit-mailing-address"
                value={editMailingForm.address}
                onChange={(e) => setEditMailingForm(prev => ({ ...prev, address: e.target.value }))}
                placeholder="123 Main St"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="edit-mailing-city">City</Label>
                <Input
                  id="edit-mailing-city"
                  value={editMailingForm.city}
                  onChange={(e) => setEditMailingForm(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="City"
                />
              </div>
              <div>
                <Label htmlFor="edit-mailing-state">State</Label>
                <Input
                  id="edit-mailing-state"
                  value={editMailingForm.state}
                  onChange={(e) => setEditMailingForm(prev => ({ ...prev, state: e.target.value }))}
                  placeholder="FL"
                  maxLength={2}
                />
              </div>
              <div>
                <Label htmlFor="edit-mailing-zip">Zip</Label>
                <Input
                  id="edit-mailing-zip"
                  value={editMailingForm.zip}
                  onChange={(e) => setEditMailingForm(prev => ({ ...prev, zip: e.target.value }))}
                  placeholder="12345"
                  maxLength={10}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMailingAddress(null)}>Cancel</Button>
            <Button onClick={handleSaveMailingEdit} disabled={updateMailingAddressMutation.isPending}>
              {updateMailingAddressMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  // Render Address Verification Tab
  const renderAddressVerification = () => {
    const unverifiedCount = verificationData?.unverified.length || 0;
    const verifiedCount = verificationData?.verified || 0;
    const totalCount = verificationData?.total || 0;
    const verificationPercent = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 0;

    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Verify Addresses</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Verify and geocode addresses using Geocodio for accurate location data
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchVerification()}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{verifiedCount}</p>
                  <p className="text-xs text-muted-foreground">Verified</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Circle className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{unverifiedCount}</p>
                  <p className="text-xs text-muted-foreground">Unverified</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{verificationPercent}%</p>
                  <p className="text-xs text-muted-foreground">Coverage</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {isLoadingVerification ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Scanning for unverified addresses...
            </CardContent>
          </Card>
        ) : unverifiedCount === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium text-foreground">All addresses are verified!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Every property has geocoordinates for mapping and location features.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="mb-4 border-primary/30 bg-primary/5">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium text-foreground">
                        {unverifiedCount} addresses need verification
                      </p>
                      <p className="text-sm text-muted-foreground">
                        These properties don't have geocoordinates yet
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => bulkVerifyMutation.mutate(verificationData?.unverified || [])}
                    disabled={bulkVerifyMutation.isPending}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Verify All {unverifiedCount} Addresses
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-auto max-h-[50vh]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>Zip</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {verificationData?.unverified.slice(0, 50).map((prop) => (
                        <TableRow key={prop.id}>
                          <TableCell>
                            <Circle className="w-4 h-4 text-muted-foreground/40" />
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            {prop.address}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {prop.city}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {prop.state}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {prop.zip}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {unverifiedCount > 50 && (
                  <div className="p-3 text-center text-sm text-muted-foreground border-t">
                    Showing first 50 of {unverifiedCount} properties
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    );
  };

  // Render Duplicate Finder Tab
  const renderDuplicateFinder = () => (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Find & Merge Duplicates</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Detect duplicate properties by address and merge them into single records
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchDuplicates()}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      {isLoadingDuplicates ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Scanning for duplicate addresses...
          </CardContent>
        </Card>
      ) : duplicateGroups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Check className="w-12 h-12 mx-auto text-green-500 mb-4" />
            <p className="text-lg font-medium text-foreground">No duplicates found!</p>
            <p className="text-sm text-muted-foreground mt-1">
              All properties have unique addresses.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mb-4 border-amber-500/30 bg-amber-500/5">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Copy className="w-5 h-5 text-amber-500" />
                  <div>
                    <p className="font-medium text-foreground">
                      Found {duplicateGroups.length} addresses with duplicates ({totalDuplicateProperties} total properties)
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Review each group to merge records and remove duplicates
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => setWizardOpen(true)}
                  >
                    <Merge className="w-4 h-4 mr-1" />
                    Start Wizard
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => autoMergeMutation.mutate({ groups: duplicateGroups, strategy: 'oldest' })}
                    disabled={autoMergeMutation.isPending}
                  >
                    {autoMergeMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                        Merging...
                      </>
                    ) : (
                      'Auto-merge (Keep Oldest)'
                    )}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => autoMergeMutation.mutate({ groups: duplicateGroups, strategy: 'newest' })}
                    disabled={autoMergeMutation.isPending}
                  >
                    {autoMergeMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                        Merging...
                      </>
                    ) : (
                      'Auto-merge (Keep Newest)'
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {duplicateGroups.map((group) => (
              <Card key={group.normalizedAddress} className="hover:border-primary/30 transition-colors">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                        <span className="text-sm font-semibold text-amber-600">{group.properties.length}</span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{group.displayAddress}</p>
                        <p className="text-xs text-muted-foreground">
                          {group.properties.length} copies found
                        </p>
                      </div>
                    </div>
                    <Button 
                      size="sm"
                      onClick={() => {
                        setSelectedDuplicateGroup(group);
                        setMergeModalOpen(true);
                      }}
                    >
                      <Merge className="w-4 h-4 mr-1" />
                      Review & Merge
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <DuplicateMergeModal
        open={mergeModalOpen}
        onOpenChange={setMergeModalOpen}
        group={selectedDuplicateGroup}
        onMergeComplete={() => {
          setSelectedDuplicateGroup(null);
          refetchDuplicates();
        }}
      />

      <DuplicateWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        groups={duplicateGroups}
        onComplete={() => refetchDuplicates()}
      />
    </div>
  );

  // Render Owner Name Fixer Tab
  const renderOwnerNameFixer = () => {
    const totalAffected = ownerNameVariations.reduce((sum, g) => sum + g.variations.length, 0);
    
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Fix Owner Names</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Normalize owner names to Title Case (e.g., "JOHN SMITH" → "John Smith")
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchOwnerNames()}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </div>

        {isLoadingOwnerNames ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Scanning for owner name variations...
            </CardContent>
          </Card>
        ) : ownerNameVariations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium text-foreground">All owner names are properly formatted!</p>
              <p className="text-sm text-muted-foreground mt-1">
                No case variations or improperly formatted names found.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="mb-4 border-amber-500/30 bg-amber-500/5">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-amber-600" />
                    <div>
                      <p className="font-medium text-foreground">
                        {ownerNameVariations.length} name variation groups found ({totalAffected} total records)
                      </p>
                      <p className="text-sm text-muted-foreground">
                        These names have inconsistent casing or formatting
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => normalizeAllMutation.mutate(ownerNameVariations)}
                    disabled={normalizeAllMutation.isPending}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Normalize All to Title Case
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {ownerNameVariations.slice(0, 50).map((group) => (
                <Card key={group.normalizedKey} className="overflow-hidden">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium text-muted-foreground">
                            {group.variations.length} record{group.variations.length > 1 ? 's' : ''}
                          </span>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          <span className="font-semibold text-foreground">{group.suggestedName}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {[...new Set(group.variations.map(v => v.name))].map((name) => {
                            const count = group.variations.filter(v => v.name === name).length;
                            const isTarget = name === group.suggestedName;
                            return (
                              <span 
                                key={name} 
                                className={cn(
                                  "px-2 py-1 rounded text-sm",
                                  isTarget 
                                    ? "bg-green-500/10 text-green-700 border border-green-500/20" 
                                    : "bg-muted text-muted-foreground"
                                )}
                              >
                                "{name}" ({count})
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => normalizeSingleMutation.mutate({ group })}
                        disabled={normalizeSingleMutation.isPending}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Fix
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {ownerNameVariations.length > 50 && (
              <div className="mt-4 text-center text-sm text-muted-foreground">
                Showing first 50 of {ownerNameVariations.length} groups. Use "Normalize All" to fix everything.
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // Main render with tabs
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Data Cleanup Tool</h1>
      <p className="text-muted-foreground mb-6">
        Clean CSV data before import or fix existing database records
      </p>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'csv' | 'fix-addresses' | 'verify-addresses' | 'fix-mailing-addresses' | 'duplicates' | 'fix-owner-names')} className="space-y-6">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="duplicates" className="gap-2">
            <Copy className="w-4 h-4" /> Find Duplicates
            {duplicateGroups.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-amber-500/20 text-amber-600 rounded">
                {duplicateGroups.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="fix-owner-names" className="gap-2">
            <User className="w-4 h-4" /> Fix Owner Names
            {ownerNameVariations.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-amber-500/20 text-amber-600 rounded">
                {ownerNameVariations.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="fix-mailing-addresses" className="gap-2">
            <Mail className="w-4 h-4" /> Fix Mailing Addresses
            {malformedMailingAddresses.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-amber-500/20 text-amber-600 rounded">
                {malformedMailingAddresses.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="csv" className="gap-2">
            <Upload className="w-4 h-4" /> CSV Cleanup
          </TabsTrigger>
          <TabsTrigger value="fix-addresses" className="gap-2">
            <Wrench className="w-4 h-4" /> Fix Addresses
            {malformedAddresses.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-amber-500/20 text-amber-600 rounded">
                {malformedAddresses.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="verify-addresses" className="gap-2">
            <CheckCircle2 className="w-4 h-4" /> Verify Addresses
            {(verificationData?.unverified.length || 0) > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary/20 text-primary rounded">
                {verificationData?.unverified.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="duplicates">
          {renderDuplicateFinder()}
        </TabsContent>

        <TabsContent value="fix-owner-names">
          {renderOwnerNameFixer()}
        </TabsContent>

        <TabsContent value="fix-mailing-addresses">
          {renderMailingAddressFixer()}
        </TabsContent>

        <TabsContent value="fix-addresses">
          {renderAddressFixer()}
        </TabsContent>

        <TabsContent value="verify-addresses">
          {renderAddressVerification()}
        </TabsContent>

        <TabsContent value="csv">
          {step === 'upload' ? (
            <Card>
              <CardContent className="pt-6">
                <div 
                  className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium text-foreground mb-1">Drop your CSV file here</p>
                  <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button variant="outline">Select File</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <CSVTransformView
              transformedData={transformedData}
              transformedHeaders={transformedHeaders}
              fileName={fileName}
              history={history}
              suggestions={suggestions}
              onUndo={handleUndo}
              onRemoveDuplicates={handleRemoveDuplicates}
              onRemoveEmptyRows={handleRemoveEmptyRows}
              onDownloadCSV={handleDownloadCSV}
              onSendToImport={handleSendToImport}
              onCombineModal={openCombineModal}
              onRenameModal={openRenameModal}
              onTransformColumn={handleTransformColumn}
              onDeleteColumn={handleDeleteColumn}
              combineModalOpen={combineModalOpen}
              setCombineModalOpen={setCombineModalOpen}
              combineColumns={combineColumns}
              setCombineColumns={setCombineColumns}
              newColumnName={newColumnName}
              setNewColumnName={setNewColumnName}
              separator={separator}
              setSeparator={setSeparator}
              onCombineColumns={handleCombineColumns}
              renameModalOpen={renameModalOpen}
              setRenameModalOpen={setRenameModalOpen}
              selectedColumn={selectedColumn}
              onRenameColumn={handleRenameColumn}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Extracted CSV Transform View Component
interface CSVTransformViewProps {
  transformedData: any[];
  transformedHeaders: string[];
  fileName: string;
  history: { data: any[]; headers: string[] }[];
  suggestions: { message: string; action: () => void }[];
  onUndo: () => void;
  onRemoveDuplicates: () => void;
  onRemoveEmptyRows: () => void;
  onDownloadCSV: () => void;
  onSendToImport: () => void;
  onCombineModal: (col: string) => void;
  onRenameModal: (col: string) => void;
  onTransformColumn: (col: string, type: 'trim' | 'uppercase' | 'lowercase' | 'titlecase') => void;
  onDeleteColumn: (col: string) => void;
  combineModalOpen: boolean;
  setCombineModalOpen: (open: boolean) => void;
  combineColumns: string[];
  setCombineColumns: (cols: string[] | ((prev: string[]) => string[])) => void;
  newColumnName: string;
  setNewColumnName: (name: string) => void;
  separator: string;
  setSeparator: (sep: string) => void;
  onCombineColumns: (cols: string[], name: string, sep: string) => void;
  renameModalOpen: boolean;
  setRenameModalOpen: (open: boolean) => void;
  selectedColumn: string;
  onRenameColumn: (oldName: string, newName: string) => void;
}

const CSVTransformView: React.FC<CSVTransformViewProps> = ({
  transformedData,
  transformedHeaders,
  fileName,
  history,
  suggestions,
  onUndo,
  onRemoveDuplicates,
  onRemoveEmptyRows,
  onDownloadCSV,
  onSendToImport,
  onCombineModal,
  onRenameModal,
  onTransformColumn,
  onDeleteColumn,
  combineModalOpen,
  setCombineModalOpen,
  combineColumns,
  setCombineColumns,
  newColumnName,
  setNewColumnName,
  separator,
  setSeparator,
  onCombineColumns,
  renameModalOpen,
  setRenameModalOpen,
  selectedColumn,
  onRenameColumn,
}) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-muted-foreground text-sm">
            {transformedData.length} rows • {transformedHeaders.length} columns • {fileName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onUndo} disabled={history.length === 0}>
            <Undo className="w-4 h-4 mr-1" /> Undo
          </Button>
          <Button variant="outline" size="sm" onClick={onRemoveDuplicates}>
            Remove Duplicates
          </Button>
          <Button variant="outline" size="sm" onClick={onRemoveEmptyRows}>
            Remove Empty Rows
          </Button>
          <Button variant="outline" size="sm" onClick={onDownloadCSV}>
            <Download className="w-4 h-4 mr-1" /> Download CSV
          </Button>
          <Button size="sm" onClick={onSendToImport}>
            <ArrowRight className="w-4 h-4 mr-1" /> Send to Import
          </Button>
        </div>
      </div>

      {/* Smart Suggestions */}
      {suggestions.length > 0 && (
        <Card className="mb-4 border-primary/20 bg-primary/5">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm">Suggestions</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s, i) => (
                <Button key={i} variant="outline" size="sm" onClick={s.action} className="text-xs">
                  <Check className="w-3 h-3 mr-1" /> {s.message}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[60vh]">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  {transformedHeaders.map((header) => (
                    <TableHead key={header} className="whitespace-nowrap">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-auto py-1 px-2 font-medium">
                            {header}
                            <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="bg-popover z-50">
                          <DropdownMenuItem onClick={() => onCombineModal(header)}>
                            <Merge className="w-4 h-4 mr-2" /> Combine with...
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onRenameModal(header)}>
                            <Edit className="w-4 h-4 mr-2" /> Rename
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onTransformColumn(header, 'trim')}>
                            Trim whitespace
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onTransformColumn(header, 'uppercase')}>
                            UPPERCASE
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onTransformColumn(header, 'lowercase')}>
                            lowercase
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onTransformColumn(header, 'titlecase')}>
                            Title Case
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => onDeleteColumn(header)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete column
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {transformedData.slice(0, 100).map((row, idx) => (
                  <TableRow key={idx}>
                    {transformedHeaders.map((header) => (
                      <TableCell key={header} className="max-w-[200px] truncate text-sm">
                        {row[header] || <span className="text-muted-foreground/40 italic">empty</span>}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {transformedData.length > 100 && (
            <div className="p-3 text-center text-sm text-muted-foreground border-t">
              Showing first 100 of {transformedData.length} rows
            </div>
          )}
        </CardContent>
      </Card>

      {/* Combine Modal */}
      <Dialog open={combineModalOpen} onOpenChange={setCombineModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Combine Columns</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Select columns to combine</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {transformedHeaders.map((h) => (
                  <Button
                    key={h}
                    variant={combineColumns.includes(h) ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (combineColumns.includes(h)) {
                        setCombineColumns(prev => prev.filter(c => c !== h));
                      } else {
                        setCombineColumns(prev => [...prev, h]);
                      }
                    }}
                  >
                    {h}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label>New column name</Label>
              <Input 
                value={newColumnName} 
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder="e.g., Mailing Address"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Separator</Label>
              <Input 
                value={separator} 
                onChange={(e) => setSeparator(e.target.value)}
                placeholder="Space"
                className="mt-1 w-24"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCombineModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => onCombineColumns(combineColumns, newColumnName || 'Combined', separator)}
              disabled={combineColumns.length < 2}
            >
              Combine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Modal */}
      <Dialog open={renameModalOpen} onOpenChange={setRenameModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Column</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>New name for "{selectedColumn}"</Label>
            <Input 
              value={newColumnName} 
              onChange={(e) => setNewColumnName(e.target.value)}
              className="mt-1"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameModalOpen(false)}>Cancel</Button>
            <Button onClick={() => onRenameColumn(selectedColumn, newColumnName)}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
