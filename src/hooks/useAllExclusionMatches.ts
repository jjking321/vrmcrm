import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useExclusionList } from './useExclusionList';
import { ExclusionEntry, Property, Owner } from '@/types';
import { 
  namesMatch, 
  emailsMatch, 
  phonesMatch, 
  addressesMatch 
} from '@/lib/exclusionUtils';

// Transform database row to Property type (minimal for matching)
const transformPropertyForMatching = (row: any): Property => {
  return {
    id: row.id,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    owner: row.owner || {
      id: '',
      name: '',
      email: '',
      phone: '',
    },
  } as Property;
};

// Check if a property matches an exclusion entry
const propertyMatchesExclusion = (
  property: Property, 
  exclusion: ExclusionEntry
): boolean => {
  // Check owner name match
  if (exclusion.ownerName && property.owner?.name) {
    if (namesMatch(property.owner.name, exclusion.ownerName)) {
      return true;
    }
    // Also check individual owners array
    const owners = property.owner.owners || [];
    for (const owner of owners) {
      const fullName = `${owner.firstName} ${owner.lastName}`.trim();
      if (fullName && namesMatch(fullName, exclusion.ownerName)) {
        return true;
      }
    }
  }
  
  // Check email match
  if (exclusion.email && property.owner?.email) {
    if (emailsMatch(property.owner.email, exclusion.email)) {
      return true;
    }
  }
  
  // Check phone match
  if (exclusion.phone) {
    if (property.owner?.phone && phonesMatch(property.owner.phone, exclusion.phone)) {
      return true;
    }
    // Also check phones array
    const phones = property.owner?.phones || [];
    for (const phone of phones) {
      if (phonesMatch(phone.number, exclusion.phone)) {
        return true;
      }
    }
  }
  
  // Check address match
  if (exclusion.address) {
    const propAddr = { address: property.address, city: property.city, state: property.state };
    const exclAddr = { address: exclusion.address, city: exclusion.city, state: exclusion.state };
    if (addressesMatch(propAddr, exclAddr)) {
      return true;
    }
  }
  
  return false;
};

// Hook to get ALL matching property IDs from the entire database
export const useAllExclusionMatches = () => {
  const { company } = useAuth();
  const { data: exclusions = [] } = useExclusionList();

  return useQuery({
    queryKey: ['all-exclusion-matches', company?.id, exclusions.map(e => e.id).join(',')],
    queryFn: async () => {
      if (!company?.id || exclusions.length === 0) {
        return { count: 0, propertyIds: [] as string[] };
      }

      // Fetch ALL properties with owners from the database
      const { data: properties, error: propError } = await supabase
        .from('properties')
        .select('id, address, city, state, zip')
        .eq('company_id', company.id);

      if (propError) throw propError;

      // Fetch ALL owners
      const { data: owners, error: ownerError } = await supabase
        .from('owners')
        .select('*')
        .eq('company_id', company.id);

      if (ownerError) throw ownerError;

      // Create owner lookup map
      const ownerMap = new Map<string, any>();
      for (const owner of owners || []) {
        ownerMap.set(owner.property_id, {
          name: owner.name || '',
          email: owner.email || undefined,
          phone: owner.phone || undefined,
          phones: Array.isArray(owner.phones) ? owner.phones as any : [],
          emails: Array.isArray(owner.emails) ? owner.emails as any : [],
          owners: Array.isArray(owner.owners) ? owner.owners as any : [],
          mailingAddress: owner.mailing_address || undefined,
          mailingCity: owner.mailing_city || undefined,
          mailingState: owner.mailing_state || undefined,
          mailingZip: owner.mailing_zip || undefined,
        });
      }

      // Find matching properties
      const matchingIds: string[] = [];
      
      for (const prop of properties || []) {
        const property = transformPropertyForMatching({
          ...prop,
          owner: ownerMap.get(prop.id),
        });

        // Check against all exclusions
        for (const exclusion of exclusions) {
          if (propertyMatchesExclusion(property, exclusion)) {
            matchingIds.push(prop.id);
            break; // Property only needs to match once
          }
        }
      }

      return { 
        count: matchingIds.length, 
        propertyIds: matchingIds 
      };
    },
    enabled: !!company?.id && exclusions.length > 0,
    staleTime: 30000, // Cache for 30 seconds
  });
};

// Hook to find properties matching a specific exclusion entry
export const useFindMatchesForExclusion = (exclusion: ExclusionEntry | null) => {
  const { company } = useAuth();

  return useQuery({
    queryKey: ['exclusion-entry-matches', company?.id, exclusion?.id],
    queryFn: async () => {
      if (!company?.id || !exclusion) {
        return [];
      }

      // Fetch ALL properties with owners
      const { data: properties, error: propError } = await supabase
        .from('properties')
        .select('id, address, city, state, zip')
        .eq('company_id', company.id);

      if (propError) throw propError;

      // Fetch ALL owners
      const { data: owners, error: ownerError } = await supabase
        .from('owners')
        .select('*')
        .eq('company_id', company.id);

      if (ownerError) throw ownerError;

      // Create owner lookup map
      const ownerMap = new Map<string, any>();
      for (const owner of owners || []) {
        ownerMap.set(owner.property_id, {
          name: owner.name || '',
          email: owner.email || undefined,
          phone: owner.phone || undefined,
          phones: Array.isArray(owner.phones) ? owner.phones as any : [],
          emails: Array.isArray(owner.emails) ? owner.emails as any : [],
          owners: Array.isArray(owner.owners) ? owner.owners as any : [],
        });
      }

      // Find matching properties
      const matches: { id: string; address: string; city: string; state: string; ownerName: string }[] = [];
      
      for (const prop of properties || []) {
        const property = transformPropertyForMatching({
          ...prop,
          owner: ownerMap.get(prop.id),
        });

        if (propertyMatchesExclusion(property, exclusion)) {
          matches.push({
            id: prop.id,
            address: prop.address,
            city: prop.city,
            state: prop.state,
            ownerName: ownerMap.get(prop.id)?.name || '',
          });
        }
      }

      return matches;
    },
    enabled: !!company?.id && !!exclusion,
  });
};
