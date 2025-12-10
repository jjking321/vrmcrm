import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { transformImportToOwner, dedupePhones, dedupeEmails, mergeOwnerContacts } from '@/lib/ownerUtils';
import { verifyAddressBatch, BatchAddressInput } from '@/lib/enrichment';
import { normalizeAddressForMatch, namesMatch, emailsMatch, phonesMatch } from '@/lib/exclusionUtils';
import { parseFullAddress, isFullAddressField } from '@/lib/addressParser';

interface ImportOptions {
  standardize: boolean;
  globalTags?: string[];
  listName?: string;
  duplicateStrategy?: 'skip' | 'update' | 'merge' | 'review';
  duplicateDecisions?: Map<string, 'keep_existing' | 'use_import' | 'merge'>;
  contactMergeMode?: 'stack' | 'override';
}

// Normalize address for duplicate detection
const normalizeAddressForDupes = (address: string, city: string, state: string): string => {
  const streetSuffixes: Record<string, string> = {
    'street': 'st', 'st': 'st', 'avenue': 'ave', 'ave': 'ave',
    'drive': 'dr', 'dr': 'dr', 'road': 'rd', 'rd': 'rd',
    'lane': 'ln', 'ln': 'ln', 'boulevard': 'blvd', 'blvd': 'blvd',
    'court': 'ct', 'ct': 'ct', 'circle': 'cir', 'cir': 'cir',
    'place': 'pl', 'pl': 'pl', 'way': 'way', 'trail': 'trl', 'trl': 'trl',
  };

  let normalized = `${address} ${city} ${state}`
    .toLowerCase()
    .replace(/[.,#\-']/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  for (const [full, abbr] of Object.entries(streetSuffixes)) {
    normalized = normalized.replace(new RegExp(`\\b${full}\\b`, 'g'), abbr);
  }

  return normalized;
};

// Chunk array helper
const chunkArray = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

export const useImportProperties = () => {
  const queryClient = useQueryClient();
  const { company, user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      data, 
      options, 
      existingProperties 
    }: { 
      data: any[]; 
      options: ImportOptions; 
      existingProperties: Property[];
    }) => {
      if (!company?.id) throw new Error('No company');

      const toastId = toast.loading(`Preparing import of ${data.length} properties...`);

      // ========== PHASE 0: Fetch ALL existing properties for duplicate detection ==========
      toast.loading(`Checking for duplicates...`, { id: toastId });
      
      const { data: allExistingProps, error: fetchError } = await supabase
        .from('properties')
        .select('id, address, city, state, tags')
        .eq('company_id', company.id);
      
      if (fetchError) throw fetchError;

      // Build address index for duplicate handling from ALL database properties
      const existingAddressMap = new Map<string, { id: string; address: string; city: string; state: string; tags: string[] }>();
      (allExistingProps || []).forEach(prop => {
        const normalized = normalizeAddressForDupes(prop.address, prop.city, prop.state);
        existingAddressMap.set(normalized, prop);
      });

      // ========== PHASE 1: Batch Address Standardization ==========
      let standardizedData = data.map((row, idx) => ({ ...row, _originalIndex: idx }));
      let standardizedCount = 0;

      if (options.standardize) {
        toast.loading(`Standardizing addresses...`, { id: toastId });
        
        // Build batch input for addresses that can be standardized
        const addressesToVerify: BatchAddressInput[] = [];
        data.forEach((row, idx) => {
          if (row.address && row.city && row.state) {
            addressesToVerify.push({
              address: row.address,
              city: row.city,
              state: row.state,
              zip: row.zip || '',
              index: idx,
            });
          }
        });

        if (addressesToVerify.length > 0) {
          const batchResults = await verifyAddressBatch(addressesToVerify);
          
          // Check if standardization failed due to quota or other errors
          const firstResult = batchResults.values().next().value;
          if (firstResult && !firstResult.success && firstResult.error?.includes('quota exceeded')) {
            toast.warning('Address standardization skipped: ' + firstResult.error, { id: toastId, duration: 8000 });
            // Continue with import without standardization
          } else {
            // Apply standardized results to data
            standardizedData = data.map((row, idx) => {
              const result = batchResults.get(idx);
              if (result?.success && result.standardized) {
                standardizedCount++;
                return {
                  ...row,
                  _originalIndex: idx,
                  address: result.standardized.street,
                  city: result.standardized.city,
                  state: result.standardized.state,
                  zip: result.standardized.zip,
                  _latitude: result.latitude,
                  _longitude: result.longitude,
                };
              }
              return { ...row, _originalIndex: idx };
            });
          }
        }
      }

      // ========== PHASE 2: Fetch Exclusion List ==========
      toast.loading(`Checking exclusion list...`, { id: toastId });
      
      const { data: exclusionList } = await supabase
        .from('exclusion_list')
        .select('owner_name, email, phone, normalized_address, address, city, state')
        .eq('company_id', company.id);
      
      const exclusions = exclusionList || [];

      // ========== PHASE 3: Categorize into new vs updates (with exclusion filtering) ==========
      toast.loading(`Processing ${data.length} properties...`, { id: toastId });

      const newProperties: any[] = [];
      const updatedProperties: { id: string; normalizedAddr: string; row: any; mergeOnly: boolean }[] = [];
      let skippedCount = 0;
      let excludedCount = 0;

      // Helper function to check if a property matches exclusion list
      const isExcluded = (row: any, address: string, city: string, state: string): boolean => {
        const owner = transformImportToOwner(row);
        const normalizedAddr = normalizeAddressForMatch(address, city, state);
        
        for (const exclusion of exclusions) {
          // Check owner name match
          if (exclusion.owner_name && owner.name) {
            if (namesMatch(exclusion.owner_name, owner.name)) {
              return true;
            }
            // Also check individual owner names if present
            if (owner.owners && owner.owners.length > 0) {
              for (const o of owner.owners) {
                const fullName = `${o.firstName || ''} ${o.lastName || ''}`.trim();
                if (fullName && namesMatch(exclusion.owner_name, fullName)) {
                  return true;
                }
              }
            }
          }
          
          // Check email match
          if (exclusion.email && owner.email) {
            if (emailsMatch(exclusion.email, owner.email)) {
              return true;
            }
          }
          
          // Check phone match
          if (exclusion.phone) {
            // Check legacy phone field
            if (owner.phone && phonesMatch(exclusion.phone, owner.phone)) {
              return true;
            }
            // Check phones array
            if (owner.phones && owner.phones.length > 0) {
              for (const phoneContact of owner.phones) {
                if (phoneContact.number && phonesMatch(exclusion.phone, phoneContact.number)) {
                  return true;
                }
              }
            }
          }
          
          // Check address match
          if (exclusion.normalized_address && normalizedAddr) {
            if (exclusion.normalized_address === normalizedAddr) {
              return true;
            }
          }
        }
        
        return false;
      };

      for (const row of standardizedData) {
        let address = row.address || '';
        let city = row.city || '';
        let state = row.state || '';
        let zip = row.zip || '';
        let latitude = row._latitude;
        let longitude = row._longitude;

        // Auto-detect and parse full address in address field
        if (isFullAddressField(address, city, state)) {
          const parsed = parseFullAddress(address);
          if (parsed.isValid) {
            address = parsed.street;
            city = parsed.city;
            state = parsed.state;
            zip = parsed.zip || zip;
          }
        }

        // Handle GIS coordinates if provided and not already set from standardization
        if (!latitude && !longitude && row.gisCoordinates) {
          const coords = row.gisCoordinates.split(',').map((c: string) => parseFloat(c.trim()));
          if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
            latitude = coords[0];
            longitude = coords[1];
          }
        }

        // Check exclusion list
        if (isExcluded(row, address, city, state)) {
          excludedCount++;
          continue;
        }

        // Check for duplicate
        const normalizedAddr = normalizeAddressForDupes(address, city, state);
        const existingProp = existingAddressMap.get(normalizedAddr);

        if (existingProp) {
          const strategy = options.duplicateStrategy || 'skip';
          let decision: 'keep_existing' | 'use_import' | 'merge' = 'keep_existing';

          if (strategy === 'review' && options.duplicateDecisions) {
            decision = options.duplicateDecisions.get(normalizedAddr) || 'keep_existing';
          } else if (strategy === 'update') {
            decision = 'use_import';
          } else if (strategy === 'merge') {
            decision = 'merge';
          }

          if (decision !== 'keep_existing') {
            updatedProperties.push({
              id: existingProp.id,
              normalizedAddr,
              row: { ...row, address, city, state, zip, _latitude: latitude, _longitude: longitude },
              mergeOnly: decision === 'merge',
            });
          } else {
            skippedCount++;
          }
        } else {
          const owner = transformImportToOwner(row);
          newProperties.push({
            property: {
              company_id: company.id,
              address,
              city,
              state,
              zip,
              latitude,
              longitude,
              bedrooms: parseInt(row.bedrooms) || 0,
              bathrooms: parseFloat(row.bathrooms) || 0,
              tags: options.globalTags || [],
              property_url: row.propertyUrl || null,
              airbnb_url: row.airbnbUrl || null,
              listing_title: row.listingTitle || null,
              room_type: row.roomType || null,
              property_manager: row.propertyManager || null,
              host: row.host || null,
              market_data: { adr: 0, occupancyRate: 0, projectedRevenue: 0, propertyValue: 0 },
            },
            owner,
          });
        }
      }

      // ========== PHASE 3: Batch Insert New Properties ==========
      let insertedCount = 0;
      if (newProperties.length > 0) {
        toast.loading(`Inserting ${newProperties.length} new properties...`, { id: toastId });
        
        const { data: insertedProps, error: propError } = await supabase
          .from('properties')
          .insert(newProperties.map(p => p.property))
          .select();

        if (propError) throw propError;
        insertedCount = insertedProps?.length || 0;

        // Batch insert all owners
        if (insertedProps && insertedProps.length > 0) {
          const ownerInserts = insertedProps.map((prop, idx) => ({
            property_id: prop.id,
            company_id: company.id,
            name: newProperties[idx].owner.name || '',
            email: newProperties[idx].owner.email || null,
            phone: newProperties[idx].owner.phone || null,
            owners: newProperties[idx].owner.owners || null,
            phones: newProperties[idx].owner.phones || null,
            mailing_address: newProperties[idx].owner.mailingAddress || null,
            mailing_city: newProperties[idx].owner.mailingCity || null,
            mailing_state: newProperties[idx].owner.mailingState || null,
            mailing_zip: newProperties[idx].owner.mailingZip || null,
            ownership_length_months: newProperties[idx].owner.ownershipLengthMonths || null,
            owner_type: newProperties[idx].owner.ownerType || null,
            owner_occupied: newProperties[idx].owner.ownerOccupied || null,
            litigator: newProperties[idx].owner.litigator || false,
          }));

          const { error: ownerError } = await supabase.from('owners').insert(ownerInserts);
          if (ownerError) console.error('Error inserting owners:', ownerError);
        }
      }

      // ========== PHASE 4: Batch Update Existing Properties & Owners ==========
      let updatedCount = 0;
      if (updatedProperties.length > 0) {
        toast.loading(`Updating ${updatedProperties.length} existing properties...`, { id: toastId });

        // Pre-fetch ALL properties that need merge in ONE query
        const allUpdateIds = updatedProperties.map(u => u.id);
        let currentPropsMap = new Map<string, any>();
        let currentOwnersMap = new Map<string, any>();

        if (allUpdateIds.length > 0) {
          const { data: currentProperties } = await supabase
            .from('properties')
            .select('*')
            .in('id', allUpdateIds);
          
          if (currentProperties) {
            currentPropsMap = new Map(currentProperties.map(p => [p.id, p]));
          }

          // Fetch existing owners for contact stacking
          const { data: currentOwners } = await supabase
            .from('owners')
            .select('*')
            .in('property_id', allUpdateIds);
          
          if (currentOwners) {
            currentOwnersMap = new Map(currentOwners.map(o => [o.property_id, o]));
          }
        }

        // Process updates in parallel chunks
        const UPDATE_CHUNK_SIZE = 50;
        const updateChunks = chunkArray(updatedProperties, UPDATE_CHUNK_SIZE);
        const contactMode = options.contactMergeMode || 'stack';

        for (const chunk of updateChunks) {
          await Promise.all(chunk.map(async (update) => {
            const row = update.row;
            const importedOwner = transformImportToOwner(row);
            const existingOwner = currentOwnersMap.get(update.id);
            
            const propUpdates: Record<string, any> = {
              address: row.address,
              city: row.city,
              state: row.state,
              zip: row.zip,
              latitude: row._latitude,
              longitude: row._longitude,
              bedrooms: parseInt(row.bedrooms) || 0,
              bathrooms: parseFloat(row.bathrooms) || 0,
              tags: [...new Set([...(existingAddressMap.get(update.normalizedAddr)?.tags || []), ...(options.globalTags || [])])],
              property_url: row.propertyUrl || null,
              airbnb_url: row.airbnbUrl || null,
              listing_title: row.listingTitle || null,
              room_type: row.roomType || null,
              property_manager: row.propertyManager || null,
              host: row.host || null,
            };

            // Build owner updates based on contact merge mode
            let ownerUpdates: Record<string, any>;
            
            if (contactMode === 'stack' && existingOwner) {
              // STACK: Add new contacts to existing ones (deduplicated)
              const existingPhones = Array.isArray(existingOwner.phones) ? existingOwner.phones : [];
              const existingEmails = Array.isArray(existingOwner.emails) ? existingOwner.emails : [];
              const existingOwners = Array.isArray(existingOwner.owners) ? existingOwner.owners : [];
              
              ownerUpdates = {
                phones: dedupePhones([...existingPhones, ...(importedOwner.phones || [])]),
                emails: dedupeEmails([...existingEmails, ...(importedOwner.emails || [])]),
                owners: mergeOwnerContacts(existingOwners, importedOwner.owners || []),
                // Fill gaps for other fields
                name: existingOwner.name || importedOwner.name,
                email: existingOwner.email || importedOwner.email,
                phone: existingOwner.phone || importedOwner.phone,
                mailing_address: existingOwner.mailing_address || importedOwner.mailingAddress,
                mailing_city: existingOwner.mailing_city || importedOwner.mailingCity,
                mailing_state: existingOwner.mailing_state || importedOwner.mailingState,
                mailing_zip: existingOwner.mailing_zip || importedOwner.mailingZip,
                ownership_length_months: existingOwner.ownership_length_months || importedOwner.ownershipLengthMonths,
                owner_type: existingOwner.owner_type || importedOwner.ownerType,
                owner_occupied: existingOwner.owner_occupied ?? importedOwner.ownerOccupied,
                litigator: existingOwner.litigator || importedOwner.litigator,
              };
            } else {
              // OVERRIDE: Replace with imported data
              ownerUpdates = {
                name: importedOwner.name || '',
                email: importedOwner.email || null,
                phone: importedOwner.phone || null,
                phones: importedOwner.phones || [],
                emails: importedOwner.emails || [],
                owners: importedOwner.owners || [],
                mailing_address: importedOwner.mailingAddress || null,
                mailing_city: importedOwner.mailingCity || null,
                mailing_state: importedOwner.mailingState || null,
                mailing_zip: importedOwner.mailingZip || null,
                ownership_length_months: importedOwner.ownershipLengthMonths || null,
                owner_type: importedOwner.ownerType || null,
                owner_occupied: importedOwner.ownerOccupied || null,
                litigator: importedOwner.litigator || false,
              };
            }

            if (update.mergeOnly) {
              const current = currentPropsMap.get(update.id);
              if (current) {
                const mergeUpdates: Record<string, any> = {};
                if (!current.latitude && propUpdates.latitude) mergeUpdates.latitude = propUpdates.latitude;
                if (!current.longitude && propUpdates.longitude) mergeUpdates.longitude = propUpdates.longitude;
                if (!current.bedrooms && propUpdates.bedrooms) mergeUpdates.bedrooms = propUpdates.bedrooms;
                if (!current.bathrooms && propUpdates.bathrooms) mergeUpdates.bathrooms = propUpdates.bathrooms;
                if (!current.property_url && propUpdates.property_url) mergeUpdates.property_url = propUpdates.property_url;
                if (!current.airbnb_url && propUpdates.airbnb_url) mergeUpdates.airbnb_url = propUpdates.airbnb_url;
                if (!current.listing_title && propUpdates.listing_title) mergeUpdates.listing_title = propUpdates.listing_title;
                if (!current.room_type && propUpdates.room_type) mergeUpdates.room_type = propUpdates.room_type;
                if (!current.property_manager && propUpdates.property_manager) mergeUpdates.property_manager = propUpdates.property_manager;
                if (!current.host && propUpdates.host) mergeUpdates.host = propUpdates.host;
                
                if (propUpdates.tags?.length) {
                  mergeUpdates.tags = [...new Set([...(current.tags || []), ...propUpdates.tags])];
                }

                if (Object.keys(mergeUpdates).length > 0) {
                  await supabase.from('properties').update(mergeUpdates).eq('id', update.id);
                }
              }
            } else {
              await supabase.from('properties').update(propUpdates).eq('id', update.id);
            }

            // Update owner data
            if (existingOwner) {
              await supabase.from('owners').update(ownerUpdates).eq('property_id', update.id);
            }
            updatedCount++;
          }));
        }
      }

      // ========== PHASE 5: Create Smart List ==========
      if (options.listName && options.listName.trim()) {
        const importTag = options.globalTags?.[0] || `import-${Date.now()}`;
        
        await supabase.from('saved_lists').insert({
          company_id: company.id,
          created_by: user?.id,
          name: options.listName.trim(),
          rules: [{
            id: Date.now().toString(),
            field: 'tags',
            operator: 'contains',
            value: importTag,
          }],
          match_type: 'and',
        });
      }

      // ========== Report Results ==========
      const parts: string[] = [];
      if (insertedCount > 0) parts.push(`${insertedCount} new`);
      if (updatedCount > 0) parts.push(`${updatedCount} updated`);
      if (skippedCount > 0) parts.push(`${skippedCount} duplicates skipped`);
      if (excludedCount > 0) parts.push(`${excludedCount} excluded`);
      if (options.standardize && standardizedCount > 0) parts.push(`${standardizedCount} standardized`);

      toast.success(`Import complete: ${parts.join(', ')}`, { id: toastId });

      return { newCount: insertedCount, updatedCount };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['saved_lists'] });
    },
    onError: (error) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });
};
