import React, { useState, useCallback } from 'react';
import { FieldDefinition, Property } from '@/types';
import { Upload, X, FileSpreadsheet, Check, AlertCircle, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { transformImportToOwner } from '@/lib/ownerUtils';
import { DuplicateReviewModal, DuplicateStrategy, normalizeAddress } from './DuplicateReviewModal';

interface ImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: any[], options: { 
    standardize: boolean; 
    globalTags?: string[]; 
    listName?: string;
    duplicateStrategy?: DuplicateStrategy;
    duplicateDecisions?: Map<string, 'keep_existing' | 'use_import' | 'merge'>;
  }) => void;
  fields: FieldDefinition[];
  existingProperties: Property[];
  preLoadedData?: any[];
  preLoadedHeaders?: string[];
}

// Auto-mapping rules: CSV header patterns -> target field
const AUTO_MAP_PATTERNS: Record<string, string[]> = {
  address: ['street', 'address', 'property address', 'street address', 'full address'],
  city: ['city'],
  state: ['state', 'st'],
  zip: ['zip', 'zipcode', 'zip code', 'postal'],
  propertyUrl: ['url', 'property url', 'link', 'propwire'],
  
  owner1FirstName: ['owner 1 first name', 'owner1 first name', 'first name 1', 'owner first', 'name 1'],
  owner1LastName: ['owner 1 last name', 'owner1 last name', 'last name 1', 'owner last'],
  owner2FirstName: ['owner 2 first name', 'owner2 first name', 'first name 2', 'name 2'],
  owner2LastName: ['owner 2 last name', 'owner2 last name', 'last name 2'],
  owner3FirstName: ['owner 3 first name', 'owner3 first name', 'first name 3', 'name 3'],
  owner3LastName: ['owner 3 last name', 'owner3 last name', 'last name 3'],
  owner4FirstName: ['owner 4 first name', 'owner4 first name', 'first name 4', 'name 4'],
  owner4LastName: ['owner 4 last name', 'owner4 last name', 'last name 4'],
  
  mailingAddress: ['mailing address', 'owner mailing address', 'mail address', 'owner address'],
  mailingCity: ['mailing city', 'owner mailing city', 'owner city'],
  mailingState: ['mailing state', 'owner mailing state', 'owner state'],
  mailingZip: ['mailing zip', 'owner mailing zip', 'owner zip'],
  
  ownershipLength: ['ownership length', 'ownership months', 'length of ownership', 'los', 'months owned'],
  ownerType: ['owner type', 'ownership type'],
  ownerOccupied: ['owner occupied', 'owner occ', 'oo', 'occupied'],
  
  contactName: ['contact name', 'name 1', 'primary contact'],
  email: ['email', 'owner email', 'e-mail'],
  age: ['age', 'owner age'],
  
  phone1: ['phone 1', 'phone1', 'primary phone', 'phone', 'phone number 1'],
  phone1Type: ['phone 1 type', 'phone1 type', 'phone type 1'],
  phone1DNC: ['phone 1 dnc', 'phone1 dnc', 'dnc 1', 'phone 1 do not call'],
  phone2: ['phone 2', 'phone2', 'phone number 2'],
  phone2Type: ['phone 2 type', 'phone2 type', 'phone type 2'],
  phone2DNC: ['phone 2 dnc', 'phone2 dnc', 'dnc 2', 'phone 2 do not call'],
  phone3: ['phone 3', 'phone3', 'phone number 3'],
  phone3Type: ['phone 3 type', 'phone3 type', 'phone type 3'],
  phone3DNC: ['phone 3 dnc', 'phone3 dnc', 'dnc 3', 'phone 3 do not call'],
  
  litigator: ['litigator', 'litigator flag', 'litigation'],
  
  bedrooms: ['bedrooms', 'beds', 'br'],
  bathrooms: ['bathrooms', 'baths', 'ba'],
  
  // Scraped Airbnb data fields
  listingTitle: ['listing title', 'title', 'listing name', 'property name'],
  roomType: ['room type', 'type'],
  propertyManager: ['property manager', 'manager', 'pm', 'management company'],
  host: ['host', 'airbnb host', 'host name'],
  airbnbUrl: ['airbnb property link', 'airbnb url', 'airbnb link', 'airbnb'],
  gisCoordinates: ['gis coordinates', 'coordinates', 'lat/long', 'latlong'],
};

function autoMapHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  
  headers.forEach((header, idx) => {
    const normalizedHeader = header.toLowerCase().trim();
    
    for (const [fieldId, patterns] of Object.entries(AUTO_MAP_PATTERNS)) {
      if (patterns.some(pattern => normalizedHeader === pattern || normalizedHeader.includes(pattern))) {
        // Only map if not already mapped to another column
        if (!Object.values(mapping).includes(fieldId)) {
          mapping[idx.toString()] = fieldId;
          break;
        }
      }
    }
  });
  
  return mapping;
}

export const ImportWizard: React.FC<ImportWizardProps> = ({ 
  isOpen, 
  onClose, 
  onImport, 
  fields,
  existingProperties,
  preLoadedData,
  preLoadedHeaders,
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
  const [standardizeAddresses, setStandardizeAddresses] = useState(true);
  const [recordCount, setRecordCount] = useState(0);
  
  // Duplicate detection state
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicates, setDuplicates] = useState<{ importRow: Record<string, any>; existingProperty: Property; normalizedAddress: string }[]>([]);
  const [nonDuplicates, setNonDuplicates] = useState<Record<string, any>[]>([]);
  const [parsedImportData, setParsedImportData] = useState<Record<string, any>[]>([]);

  // Handle pre-loaded data from Data Cleanup Tool
  React.useEffect(() => {
    if (isOpen && preLoadedData && preLoadedHeaders && preLoadedData.length > 0) {
      setCsvHeaders(preLoadedHeaders);
      // Convert data objects to preview format (array of arrays)
      const preview = preLoadedData.slice(0, 5).map(row => 
        preLoadedHeaders.map(h => row[h] || '')
      );
      setCsvPreview(preview);
      setRecordCount(preLoadedData.length);
      
      // Auto-map headers
      const autoMapping = autoMapHeaders(preLoadedHeaders);
      setMapping(autoMapping);
      
      setStep('map');
    }
  }, [isOpen, preLoadedData, preLoadedHeaders]);

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
    
    // Auto-map headers
    const autoMapping = autoMapHeaders(headers);
    setMapping(autoMapping);
    
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

  const processParsedData = (parsedData: Record<string, any>[]) => {
    // Build address index from existing properties
    const existingAddressMap = new Map<string, Property>();
    existingProperties.forEach(prop => {
      const normalized = normalizeAddress(prop.address, prop.city, prop.state);
      existingAddressMap.set(normalized, prop);
    });

    // Check for duplicates
    const foundDuplicates: { importRow: Record<string, any>; existingProperty: Property; normalizedAddress: string }[] = [];
    const nonDups: Record<string, any>[] = [];

    parsedData.forEach(row => {
      const address = row.address || '';
      const city = row.city || '';
      const state = row.state || '';
      const normalized = normalizeAddress(address, city, state);
      
      const existingProp = existingAddressMap.get(normalized);
      if (existingProp) {
        foundDuplicates.push({
          importRow: row,
          existingProperty: existingProp,
          normalizedAddress: normalized,
        });
      } else {
        nonDups.push(row);
      }
    });

    // If duplicates found, show modal
    if (foundDuplicates.length > 0) {
      setDuplicates(foundDuplicates);
      setNonDuplicates(nonDups);
      setParsedImportData(parsedData);
      setShowDuplicateModal(true);
    } else {
      // No duplicates, proceed directly
      onImport(parsedData, {
        standardize: standardizeAddresses,
        globalTags: globalTags ? globalTags.split(',').map(t => t.trim().toLowerCase()) : undefined,
        listName: createList && listName ? listName : undefined,
      });
      handleClose();
    }
  };

  const handleImport = () => {
    // Handle pre-loaded data from Data Cleanup Tool
    if (preLoadedData && preLoadedData.length > 0 && preLoadedHeaders) {
      const parsedData = preLoadedData.map(row => {
        const obj: Record<string, any> = {};
        Object.entries(mapping).forEach(([colIndex, fieldId]) => {
          if (fieldId) {
            const header = preLoadedHeaders[parseInt(colIndex)];
            obj[fieldId] = row[header] || '';
          }
        });
        return obj;
      });
      processParsedData(parsedData);
      return;
    }

    // Original file-based import logic
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

        processParsedData(parsedData);
      }
    };
    reader.readAsText(file);
  };

  const handleDuplicateConfirm = (
    strategy: DuplicateStrategy,
    reviewDecisions?: Map<string, 'keep_existing' | 'use_import' | 'merge'>
  ) => {
    onImport(parsedImportData, {
      standardize: standardizeAddresses,
      globalTags: globalTags ? globalTags.split(',').map(t => t.trim().toLowerCase()) : undefined,
      listName: createList && listName ? listName : undefined,
      duplicateStrategy: strategy,
      duplicateDecisions: reviewDecisions,
    });
    setShowDuplicateModal(false);
    handleClose();
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
    setStandardizeAddresses(true);
    setShowDuplicateModal(false);
    setDuplicates([]);
    setNonDuplicates([]);
    setParsedImportData([]);
    onClose();
  };

  const targetFields = [
    { id: '', label: '-- Skip --' },
    
    // Property
    { id: 'address', label: '📍 Street Address', group: 'Property' },
    { id: 'city', label: '📍 City', group: 'Property' },
    { id: 'state', label: '📍 State', group: 'Property' },
    { id: 'zip', label: '📍 ZIP Code', group: 'Property' },
    { id: 'propertyUrl', label: '🔗 Property URL', group: 'Property' },
    { id: 'bedrooms', label: '🛏️ Bedrooms', group: 'Property' },
    { id: 'bathrooms', label: '🚿 Bathrooms', group: 'Property' },
    { id: 'gisCoordinates', label: '📍 GIS Coordinates', group: 'Property' },
    
    // Airbnb/Scraped Data
    { id: 'listingTitle', label: '🏠 Listing Title', group: 'Airbnb' },
    { id: 'roomType', label: '🛋️ Room Type', group: 'Airbnb' },
    { id: 'propertyManager', label: '👔 Property Manager', group: 'Airbnb' },
    { id: 'host', label: '👤 Host Name', group: 'Airbnb' },
    { id: 'airbnbUrl', label: '🔗 Airbnb URL', group: 'Airbnb' },
    
    // Multiple Owners
    { id: 'owner1FirstName', label: '👤 Owner 1 First Name', group: 'Owners' },
    { id: 'owner1LastName', label: '👤 Owner 1 Last Name', group: 'Owners' },
    { id: 'owner2FirstName', label: '👤 Owner 2 First Name', group: 'Owners' },
    { id: 'owner2LastName', label: '👤 Owner 2 Last Name', group: 'Owners' },
    { id: 'owner3FirstName', label: '👤 Owner 3 First Name', group: 'Owners' },
    { id: 'owner3LastName', label: '👤 Owner 3 Last Name', group: 'Owners' },
    { id: 'owner4FirstName', label: '👤 Owner 4 First Name', group: 'Owners' },
    { id: 'owner4LastName', label: '👤 Owner 4 Last Name', group: 'Owners' },
    
    // Mailing Address
    { id: 'mailingAddress', label: '📬 Owner Mailing Address', group: 'Mailing' },
    { id: 'mailingCity', label: '📬 Owner Mailing City', group: 'Mailing' },
    { id: 'mailingState', label: '📬 Owner Mailing State', group: 'Mailing' },
    { id: 'mailingZip', label: '📬 Owner Mailing ZIP', group: 'Mailing' },
    
    // Ownership Info
    { id: 'ownershipLength', label: '📅 Ownership Length (Months)', group: 'Ownership' },
    { id: 'ownerType', label: '🏷️ Owner Type', group: 'Ownership' },
    { id: 'ownerOccupied', label: '🏠 Owner Occupied', group: 'Ownership' },
    
    // Contact
    { id: 'contactName', label: '👤 Contact Name', group: 'Contact' },
    { id: 'email', label: '✉️ Email', group: 'Contact' },
    { id: 'age', label: '📊 Age', group: 'Contact' },
    
    // Multiple Phones
    { id: 'phone1', label: '📞 Phone 1', group: 'Phones' },
    { id: 'phone1Type', label: '📞 Phone 1 Type', group: 'Phones' },
    { id: 'phone1DNC', label: '🚫 Phone 1 Do Not Call', group: 'Phones' },
    { id: 'phone2', label: '📞 Phone 2', group: 'Phones' },
    { id: 'phone2Type', label: '📞 Phone 2 Type', group: 'Phones' },
    { id: 'phone2DNC', label: '🚫 Phone 2 Do Not Call', group: 'Phones' },
    { id: 'phone3', label: '📞 Phone 3', group: 'Phones' },
    { id: 'phone3Type', label: '📞 Phone 3 Type', group: 'Phones' },
    { id: 'phone3DNC', label: '🚫 Phone 3 Do Not Call', group: 'Phones' },
    
    // Compliance
    { id: 'litigator', label: '⚠️ Litigator Flag', group: 'Compliance' },
    
    // Legacy single owner (for simpler imports)
    { id: 'ownerName', label: '👤 Owner Name (Single)', group: 'Legacy' },
    { id: 'ownerEmail', label: '✉️ Owner Email (Legacy)', group: 'Legacy' },
    { id: 'ownerPhone', label: '📞 Owner Phone (Legacy)', group: 'Legacy' },
    
    // Custom fields
    ...fields.filter(f => !f.isSystem).map(f => ({ id: f.id, label: f.label, group: 'Custom' })),
  ];

  // Count auto-mapped columns
  const autoMappedCount = Object.values(mapping).filter(v => v).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div>
            <h2 className="text-lg font-bold text-foreground">Import Properties</h2>
            <p className="text-xs text-muted-foreground">Bulk upload via CSV with smart field mapping</p>
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
                  <p className="text-xs text-muted-foreground">
                    {recordCount} records found • {autoMappedCount} columns auto-mapped
                  </p>
                </div>
                <Check className="w-5 h-5 text-emerald-500" />
              </div>

              {/* Column Mapping */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Map your columns</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                  {csvHeaders.map((header, idx) => {
                    const mappedField = mapping[idx];
                    const isMapped = mappedField && mappedField !== '';
                    
                    return (
                      <div key={idx} className={cn(
                        "flex items-center gap-3 p-2 rounded-lg transition-colors",
                        isMapped ? "bg-emerald-50/50" : "bg-transparent"
                      )}>
                        <span className="w-1/3 text-sm text-muted-foreground truncate font-medium" title={header}>
                          {header}
                        </span>
                        <span className="text-muted-foreground">→</span>
                        <select
                          value={mapping[idx] || ''}
                          onChange={(e) => setMapping({ ...mapping, [idx]: e.target.value })}
                          className={cn(
                            "flex-1 p-2 border rounded-lg text-sm bg-card focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none",
                            isMapped ? "border-emerald-300" : "border-input"
                          )}
                        >
                          {targetFields.map(f => (
                            <option key={f.id} value={f.id}>{f.label}</option>
                          ))}
                        </select>
                        {isMapped && <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Options */}
              <div className="space-y-4 pt-4 border-t border-border">
                {/* Geocodio Standardization */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={standardizeAddresses}
                      onChange={(e) => setStandardizeAddresses(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded border-border text-brand focus:ring-brand"
                    />
                    <div>
                      <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-blue-600" />
                        Standardize addresses with Geocodio
                      </span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Verify and format addresses using USPS standards. Adds lat/long coordinates.
                      </p>
                    </div>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    Apply tags to all imports (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={globalTags}
                    onChange={(e) => setGlobalTags(e.target.value)}
                    className="w-full p-2.5 border border-input rounded-lg text-sm bg-card focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none"
                    placeholder="e.g. imported, q4-list, condos"
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
              {!Object.values(mapping).includes('address') && (
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

      {/* Duplicate Review Modal */}
      <DuplicateReviewModal
        isOpen={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        duplicates={duplicates}
        nonDuplicates={nonDuplicates}
        onConfirm={handleDuplicateConfirm}
      />
    </div>
  );
};
