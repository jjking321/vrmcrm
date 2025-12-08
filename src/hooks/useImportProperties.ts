import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { transformImportToOwner } from '@/lib/ownerUtils';
import { verifyAddress } from '@/lib/enrichment';

interface ImportOptions {
  standardize: boolean;
  globalTags?: string[];
  listName?: string;
  duplicateStrategy?: 'skip' | 'update' | 'merge' | 'review';
  duplicateDecisions?: Map<string, 'keep_existing' | 'use_import' | 'merge'>;
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

      const toastId = toast.loading(`Importing ${data.length} properties...`);

      // Build address index for duplicate handling
      const existingAddressMap = new Map<string, Property>();
      existingProperties.forEach(prop => {
        const normalized = normalizeAddressForDupes(prop.address, prop.city, prop.state);
        existingAddressMap.set(normalized, prop);
      });

      const newProperties: any[] = [];
      const updatedProperties: { id: string; updates: any }[] = [];
      let standardizedCount = 0;

      for (const row of data) {
        let address = row.address || '';
        let city = row.city || '';
        let state = row.state || '';
        let zip = row.zip || '';
        let latitude: number | undefined;
        let longitude: number | undefined;

        // Handle GIS coordinates if provided
        if (row.gisCoordinates) {
          const coords = row.gisCoordinates.split(',').map((c: string) => parseFloat(c.trim()));
          if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
            latitude = coords[0];
            longitude = coords[1];
          }
        }

        // Standardize address with Geocodio if enabled
        if (options.standardize && address && city && state) {
          try {
            const result = await verifyAddress(address, city, state, zip);
            if (result.success && result.data?.standardized) {
              address = result.data.standardized.street;
              city = result.data.standardized.city;
              state = result.data.standardized.state;
              zip = result.data.standardized.zip;
              latitude = result.data.latitude;
              longitude = result.data.longitude;
              standardizedCount++;
            }
          } catch (err) {
            console.error('Failed to standardize address:', address, err);
          }
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

          if (decision === 'keep_existing') {
            continue;
          } else if (decision === 'use_import' || decision === 'merge') {
            const owner = transformImportToOwner(row);
            updatedProperties.push({
              id: existingProp.id,
              updates: {
                property: {
                  address,
                  city,
                  state,
                  zip,
                  latitude,
                  longitude,
                  bedrooms: parseInt(row.bedrooms) || existingProp.bedrooms,
                  bathrooms: parseFloat(row.bathrooms) || existingProp.bathrooms,
                  tags: [...new Set([...(existingProp.tags || []), ...(options.globalTags || [])])],
                  property_url: row.propertyUrl || existingProp.propertyUrl,
                  airbnb_url: row.airbnbUrl || existingProp.airbnbUrl,
                  listing_title: row.listingTitle || existingProp.listingTitle,
                  room_type: row.roomType || existingProp.roomType,
                  property_manager: row.propertyManager || existingProp.propertyManager,
                  host: row.host || existingProp.host,
                },
                owner,
                mergeOnly: decision === 'merge',
              },
            });
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

      // Insert new properties
      if (newProperties.length > 0) {
        const { data: insertedProps, error: propError } = await supabase
          .from('properties')
          .insert(newProperties.map(p => p.property))
          .select();

        if (propError) throw propError;

        // Insert owners for new properties
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

        const { error: ownerError } = await supabase
          .from('owners')
          .insert(ownerInserts);

        if (ownerError) console.error('Error inserting owners:', ownerError);
      }

      // Update existing properties
      for (const update of updatedProperties) {
        const propUpdates = update.updates.property;
        
        // For merge, only update if existing value is empty
        if (update.updates.mergeOnly) {
          // Fetch current property to check empty fields
          const { data: current } = await supabase
            .from('properties')
            .select('*')
            .eq('id', update.id)
            .single();

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
              await supabase
                .from('properties')
                .update(mergeUpdates)
                .eq('id', update.id);
            }
          }
        } else {
          await supabase
            .from('properties')
            .update(propUpdates)
            .eq('id', update.id);
        }
      }

      // Create smart list if name provided
      if (options.listName && options.listName.trim()) {
        const importTag = options.globalTags?.[0] || `import-${Date.now()}`;
        
        await supabase
          .from('saved_lists')
          .insert({
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

      const parts: string[] = [];
      if (newProperties.length > 0) parts.push(`${newProperties.length} new`);
      if (updatedProperties.length > 0) parts.push(`${updatedProperties.length} updated`);
      if (options.standardize && standardizedCount > 0) parts.push(`${standardizedCount} standardized`);

      toast.success(`Import complete: ${parts.join(', ')}`, { id: toastId });

      return { newCount: newProperties.length, updatedCount: updatedProperties.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['saved_lists'] });
    },
    onError: (error, _, context) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });
};
