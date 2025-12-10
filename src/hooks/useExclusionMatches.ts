import { useMemo } from 'react';
import { Property, ExclusionEntry } from '@/types';
import { useExclusionList } from './useExclusionList';
import { 
  namesMatch, 
  emailsMatch, 
  phonesMatch, 
  addressesMatch 
} from '@/lib/exclusionUtils';

interface ExclusionMatch {
  property: Property;
  matchedBy: ('name' | 'email' | 'phone' | 'address')[];
  exclusionEntry: ExclusionEntry;
}

// Check if a single property matches an exclusion entry
export const propertyMatchesExclusion = (
  property: Property, 
  exclusion: ExclusionEntry
): ('name' | 'email' | 'phone' | 'address')[] => {
  const matches: ('name' | 'email' | 'phone' | 'address')[] = [];
  
  // Check owner name match
  if (exclusion.ownerName) {
    const ownerName = property.owner.name;
    if (ownerName && namesMatch(ownerName, exclusion.ownerName)) {
      matches.push('name');
    }
    // Also check individual owners array
    const owners = property.owner.owners || [];
    for (const owner of owners) {
      const fullName = `${owner.firstName} ${owner.lastName}`.trim();
      if (fullName && namesMatch(fullName, exclusion.ownerName)) {
        if (!matches.includes('name')) matches.push('name');
        break;
      }
    }
  }
  
  // Check email match
  if (exclusion.email && property.owner.email) {
    if (emailsMatch(property.owner.email, exclusion.email)) {
      matches.push('email');
    }
  }
  
  // Check phone match
  if (exclusion.phone) {
    const ownerPhone = property.owner.phone;
    if (ownerPhone && phonesMatch(ownerPhone, exclusion.phone)) {
      matches.push('phone');
    }
    // Also check phones array
    const phones = property.owner.phones || [];
    for (const phone of phones) {
      if (phonesMatch(phone.number, exclusion.phone)) {
        if (!matches.includes('phone')) matches.push('phone');
        break;
      }
    }
  }
  
  // Check address match
  if (exclusion.address) {
    const propAddr = { address: property.address, city: property.city, state: property.state };
    const exclAddr = { address: exclusion.address, city: exclusion.city, state: exclusion.state };
    if (addressesMatch(propAddr, exclAddr)) {
      matches.push('address');
    }
  }
  
  return matches;
};

// Check if a property is excluded by any entry
export const isPropertyExcluded = (
  property: Property,
  exclusions: ExclusionEntry[]
): boolean => {
  return exclusions.some(excl => propertyMatchesExclusion(property, excl).length > 0);
};

// Hook to get all properties that match exclusion list
export const useExclusionMatches = (properties: Property[]) => {
  const { data: exclusions = [] } = useExclusionList();
  
  const matches = useMemo(() => {
    const result: ExclusionMatch[] = [];
    
    for (const property of properties) {
      for (const exclusion of exclusions) {
        const matchedBy = propertyMatchesExclusion(property, exclusion);
        if (matchedBy.length > 0) {
          result.push({ property, matchedBy, exclusionEntry: exclusion });
          break; // Only add each property once
        }
      }
    }
    
    return result;
  }, [properties, exclusions]);
  
  return { matches, exclusions };
};

// Hook to get a set of excluded property IDs for quick lookup
export const useExcludedPropertyIds = (properties: Property[]) => {
  const { data: exclusions = [] } = useExclusionList();
  
  const excludedIds = useMemo(() => {
    const ids = new Set<string>();
    
    for (const property of properties) {
      if (isPropertyExcluded(property, exclusions)) {
        ids.add(property.id);
      }
    }
    
    return ids;
  }, [properties, exclusions]);
  
  return excludedIds;
};

// Find properties matching a specific exclusion entry
export const findMatchingProperties = (
  properties: Property[],
  exclusion: ExclusionEntry
): Property[] => {
  return properties.filter(p => propertyMatchesExclusion(p, exclusion).length > 0);
};
