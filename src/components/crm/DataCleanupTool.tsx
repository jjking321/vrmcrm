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
import { 
  Upload, Download, ArrowRight, Trash2, Merge, Edit, 
  ChevronDown, Undo, Check, AlertCircle, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

  // Render upload step
  if (step === 'upload') {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-2">Data Cleanup Tool</h1>
        <p className="text-muted-foreground mb-6">
          Clean and transform your CSV data before importing to the CRM
        </p>

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
      </div>
    );
  }

  // Render transform step
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Data Cleanup Tool</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {transformedData.length} rows • {transformedHeaders.length} columns • {fileName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleUndo} disabled={history.length === 0}>
            <Undo className="w-4 h-4 mr-1" /> Undo
          </Button>
          <Button variant="outline" size="sm" onClick={handleRemoveDuplicates}>
            Remove Duplicates
          </Button>
          <Button variant="outline" size="sm" onClick={handleRemoveEmptyRows}>
            Remove Empty Rows
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadCSV}>
            <Download className="w-4 h-4 mr-1" /> Download CSV
          </Button>
          <Button size="sm" onClick={handleSendToImport}>
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
                          <DropdownMenuItem onClick={() => openCombineModal(header)}>
                            <Merge className="w-4 h-4 mr-2" /> Combine with...
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openRenameModal(header)}>
                            <Edit className="w-4 h-4 mr-2" /> Rename
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleTransformColumn(header, 'trim')}>
                            Trim whitespace
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleTransformColumn(header, 'uppercase')}>
                            UPPERCASE
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleTransformColumn(header, 'lowercase')}>
                            lowercase
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleTransformColumn(header, 'titlecase')}>
                            Title Case
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDeleteColumn(header)}
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
              onClick={() => handleCombineColumns(combineColumns, newColumnName || 'Combined', separator)}
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
            <Button onClick={() => handleRenameColumn(selectedColumn, newColumnName)}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
