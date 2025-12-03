import React, { useState, useCallback } from 'react';
import { FieldDefinition } from '@/types';
import { Upload, X, FileSpreadsheet, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: any[], options: { standardize: boolean; globalTags?: string[]; listName?: string }) => void;
  fields: FieldDefinition[];
  geocodioApiKey: string;
}

export const ImportWizard: React.FC<ImportWizardProps> = ({ 
  isOpen, 
  onClose, 
  onImport, 
  fields,
  geocodioApiKey 
}) => {
  const [step, setStep] = useState<'upload' | 'map' | 'summary'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [dragActive, setDragActive] = useState(false);
  const [globalTags, setGlobalTags] = useState('');
  const [createList, setCreateList] = useState(false);
  const [listName, setListName] = useState('');
  const [recordCount, setRecordCount] = useState(0);

  const parseCSV = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) return;

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    setCsvHeaders(headers);

    const preview = lines.slice(1, 6).map(line => {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;

      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      return values;
    });

    setCsvPreview(preview);
    setRecordCount(lines.length - 1);
    setStep('map');
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'text/csv') {
      setFile(droppedFile);
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          parseCSV(evt.target.result as string);
        }
      };
      reader.readAsText(droppedFile);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          parseCSV(evt.target.result as string);
        }
      };
      reader.readAsText(selectedFile);
    }
  };

  const handleImport = () => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        const text = evt.target.result as string;
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const dataRows = lines.slice(1);

        const parsedData = dataRows.map(line => {
          const values: string[] = [];
          let current = '';
          let inQuotes = false;

          for (const char of line) {
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim());

          const obj: Record<string, any> = {};
          Object.entries(mapping).forEach(([colIndex, fieldId]) => {
            if (fieldId) {
              obj[fieldId] = values[parseInt(colIndex)] || '';
            }
          });
          return obj;
        });

        onImport(parsedData, {
          standardize: !!geocodioApiKey,
          globalTags: globalTags ? globalTags.split(',').map(t => t.trim().toLowerCase()) : undefined,
          listName: createList && listName ? listName : undefined,
        });

        handleClose();
      }
    };
    reader.readAsText(file);
  };

  const handleClose = () => {
    setStep('upload');
    setFile(null);
    setCsvHeaders([]);
    setCsvPreview([]);
    setMapping({});
    setGlobalTags('');
    setCreateList(false);
    setListName('');
    onClose();
  };

  const targetFields = [
    { id: '', label: '-- Skip --' },
    { id: 'address', label: 'Street Address' },
    { id: 'city', label: 'City' },
    { id: 'state', label: 'State' },
    { id: 'zip', label: 'ZIP Code' },
    { id: 'ownerName', label: 'Owner Name' },
    { id: 'ownerEmail', label: 'Owner Email' },
    { id: 'ownerPhone', label: 'Owner Phone' },
    { id: 'bedrooms', label: 'Bedrooms' },
    { id: 'bathrooms', label: 'Bathrooms' },
    ...fields.filter(f => !f.isSystem).map(f => ({ id: f.id, label: f.label })),
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div>
            <h2 className="text-lg font-bold text-foreground">Import Properties</h2>
            <p className="text-xs text-muted-foreground">Bulk upload via CSV</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {step === 'upload' && (
            <div
              className={cn(
                "border-2 border-dashed rounded-xl p-12 text-center transition-colors",
                dragActive ? "border-brand bg-brand-50" : "border-border hover:border-brand/50"
              )}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              <FileSpreadsheet className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-foreground font-medium mb-2">Drop your CSV file here</p>
              <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-brand-foreground rounded-lg text-sm font-medium hover:bg-brand-600 cursor-pointer transition-colors"
              >
                <Upload className="w-4 h-4" />
                Select File
              </label>
            </div>
          )}

          {step === 'map' && (
            <div className="space-y-6">
              {/* File Info */}
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <FileSpreadsheet className="w-5 h-5 text-brand" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{file?.name}</p>
                  <p className="text-xs text-muted-foreground">{recordCount} records found</p>
                </div>
                <Check className="w-5 h-5 text-emerald-500" />
              </div>

              {/* Column Mapping */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Map your columns</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {csvHeaders.map((header, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="w-1/3 text-sm text-muted-foreground truncate" title={header}>
                        {header}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <select
                        value={mapping[idx] || ''}
                        onChange={(e) => setMapping({ ...mapping, [idx]: e.target.value })}
                        className="flex-1 p-2 border border-input rounded-lg text-sm bg-card focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none"
                      >
                        {targetFields.map(f => (
                          <option key={f.id} value={f.id}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Options */}
              <div className="space-y-4 pt-4 border-t border-border">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    Apply tags to all imports (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={globalTags}
                    onChange={(e) => setGlobalTags(e.target.value)}
                    className="w-full p-2.5 border border-input rounded-lg text-sm bg-card focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none"
                    placeholder="e.g. imported, q4-list"
                  />
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createList}
                    onChange={(e) => setCreateList(e.target.checked)}
                    className="w-4 h-4 rounded border-border text-brand focus:ring-brand"
                  />
                  <span className="text-sm text-foreground">Create a Smart List from this import</span>
                </label>

                {createList && (
                  <input
                    type="text"
                    value={listName}
                    onChange={(e) => setListName(e.target.value)}
                    className="w-full p-2.5 border border-input rounded-lg text-sm bg-card focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none"
                    placeholder="List name..."
                  />
                )}
              </div>

              {/* Validation Warning */}
              {!mapping[Object.keys(mapping).find(k => mapping[k] === 'address') || ''] && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  Make sure to map the Street Address column for proper import.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-muted/30">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          {step === 'map' && (
            <button
              onClick={handleImport}
              disabled={!Object.values(mapping).includes('address')}
              className="px-4 py-2 bg-brand text-brand-foreground rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              Import {recordCount} Properties
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
