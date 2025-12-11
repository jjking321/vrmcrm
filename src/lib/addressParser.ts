// Address parser utility to split full addresses into components

// US State mappings (full name to abbreviation)
const stateAbbreviations: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
  'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
  'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
  'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
  'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
  'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
  'district of columbia': 'DC',
};

// Valid state abbreviations for validation
const validStateAbbrs = new Set(Object.values(stateAbbreviations));

export interface ParsedAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  isValid: boolean;
}

/**
 * Parse a full address string into components
 * Handles formats like:
 * - "123 MAIN ST, CITY, STATE 12345"
 * - "123 MAIN ST, Unit 5, CITY, FL 12345"
 * - "123 Main Street, City, FLORIDA 32931"
 * - "123 MAIN ST, CITY, ST"
 */
export function parseFullAddress(fullAddress: string): ParsedAddress {
  const result: ParsedAddress = {
    street: '',
    city: '',
    state: '',
    zip: '',
    isValid: false,
  };

  if (!fullAddress || typeof fullAddress !== 'string') {
    return result;
  }

  let trimmed = fullAddress.trim();
  if (!trimmed) {
    return result;
  }

  // Strip common country suffixes (e.g., ", USA", ", US", ", United States")
  const countrySuffixes = [', USA', ', US', ', United States', ',USA', ',US'];
  for (const suffix of countrySuffixes) {
    if (trimmed.toUpperCase().endsWith(suffix.toUpperCase())) {
      trimmed = trimmed.slice(0, -suffix.length).trim();
      break;
    }
  }

  // Try to extract ZIP code (5 digits or 5+4 format) - more flexible matching
  const zipMatch = trimmed.match(/\b(\d{5})(?:-\d{4})?\b\s*,?\s*$/);
  let workingAddress = trimmed;
  
  if (zipMatch) {
    result.zip = zipMatch[1];
    workingAddress = trimmed.slice(0, zipMatch.index).trim();
    // Remove trailing comma if present
    workingAddress = workingAddress.replace(/,\s*$/, '').trim();
  }

  // Split by comma to get components
  const parts = workingAddress.split(',').map(p => p.trim()).filter(Boolean);

  if (parts.length === 0) {
    return result;
  }

  // If only one part (no commas), try to parse space-delimited address
  if (parts.length === 1) {
    const words = parts[0].split(/\s+/);
    
    // Try to find STATE ZIP pattern at the end
    // e.g., "15 SUNFLOWER ST UNIT 44 COCOA BEACH FL 32931"
    let stateIndex = -1;
    for (let i = words.length - 1; i >= 0; i--) {
      const word = words[i].toLowerCase();
      if (validStateAbbrs.has(word.toUpperCase())) {
        stateIndex = i;
        result.state = word.toUpperCase();
        break;
      } else if (stateAbbreviations[word]) {
        stateIndex = i;
        result.state = stateAbbreviations[word];
        break;
      }
    }
    
    if (stateIndex > 0) {
      // Found state - now try to find city boundary
      // Common city names are 1-3 words before the state
      // Look for patterns: street indicators, unit numbers, etc.
      const streetIndicators = ['st', 'street', 'ave', 'avenue', 'rd', 'road', 'dr', 'drive', 
        'ln', 'lane', 'blvd', 'boulevard', 'ct', 'court', 'cir', 'circle', 'way', 'pl', 'place',
        'unit', 'apt', 'suite', 'ste', '#'];
      
      let streetEndIndex = stateIndex - 1; // Default: everything before state is street+city
      
      // Work backwards from state to find where street ends
      for (let i = stateIndex - 1; i >= 0; i--) {
        const word = words[i].toLowerCase();
        // If we find a street indicator, the next word(s) are likely city
        if (streetIndicators.includes(word)) {
          // Check if this is a unit indicator with a number after it
          if (['unit', 'apt', 'suite', 'ste', '#'].includes(word) && i + 1 < stateIndex) {
            // Skip unit number, continue looking
            continue;
          }
          // Found street suffix - words after this (before state) are city
          streetEndIndex = i;
          break;
        }
        // If it's a number and previous word is a unit indicator, skip
        if (/^\d+$/.test(word) && i > 0 && ['unit', 'apt', 'suite', 'ste', '#'].includes(words[i-1].toLowerCase())) {
          continue;
        }
      }
      
      // Extract city (words between street end and state)
      // Try to be smart about city: usually 1-2 words
      const potentialCityWords = words.slice(streetEndIndex + 1, stateIndex);
      if (potentialCityWords.length > 0) {
        result.city = potentialCityWords.join(' ');
        result.street = words.slice(0, streetEndIndex + 1).join(' ');
      } else {
        // Fallback: assume last 2 words before state are city
        const cityStart = Math.max(0, stateIndex - 2);
        result.city = words.slice(cityStart, stateIndex).join(' ');
        result.street = words.slice(0, cityStart).join(' ');
      }
      result.isValid = !!result.street && !!result.city;
    } else {
      // No state found, just use as street
      result.street = parts[0];
    }
    return result;
  }

  // Two parts: likely "street, city state zip" or "street, city"
  if (parts.length === 2) {
    result.street = parts[0];
    
    // Parse second part for city and state
    const secondPart = parts[1];
    const stateResult = extractStateFromPart(secondPart);
    
    if (stateResult.state) {
      result.state = stateResult.state;
      result.city = stateResult.remaining;
      result.isValid = true;
    } else {
      result.city = secondPart;
      result.isValid = !!result.street && !!result.city;
    }
    return result;
  }

  // Three or more parts
  // Last part should contain state (and possibly zip if not already extracted)
  const lastPart = parts[parts.length - 1];
  const secondLastPart = parts[parts.length - 2];
  
  // Check if last part is state
  const stateFromLast = extractStateFromPart(lastPart);
  
  if (stateFromLast.state) {
    result.state = stateFromLast.state;
    
    // Second-to-last is city
    result.city = secondLastPart;
    
    // Everything before is street (may include unit)
    result.street = parts.slice(0, -2).join(', ');
    result.isValid = true;
  } else {
    // Maybe format is "street, unit, city state"
    const stateFromSecondLast = extractStateFromPart(secondLastPart);
    
    if (stateFromSecondLast.state) {
      result.state = stateFromSecondLast.state;
      result.city = stateFromSecondLast.remaining;
      result.street = parts.slice(0, -2).join(', ');
      result.isValid = true;
    } else {
      // Fallback: first part is street, rest is uncertain
      result.street = parts[0];
      result.city = parts.slice(1, -1).join(', ');
      
      // Try one more time to extract state from last part
      const words = lastPart.split(/\s+/);
      for (let i = words.length - 1; i >= 0; i--) {
        const word = words[i].toLowerCase();
        if (validStateAbbrs.has(word.toUpperCase())) {
          result.state = word.toUpperCase();
          if (words.slice(0, i).join(' ')) {
            result.city = (result.city ? result.city + ', ' : '') + words.slice(0, i).join(' ');
          }
          result.isValid = true;
          break;
        } else if (stateAbbreviations[word]) {
          result.state = stateAbbreviations[word];
          if (words.slice(0, i).join(' ')) {
            result.city = (result.city ? result.city + ', ' : '') + words.slice(0, i).join(' ');
          }
          result.isValid = true;
          break;
        }
      }
    }
  }

  return result;
}

/**
 * Extract state from a string part, handling both abbreviations and full names
 */
function extractStateFromPart(part: string): { state: string; remaining: string } {
  const words = part.split(/\s+/);
  
  // Check last word first
  for (let i = words.length - 1; i >= 0; i--) {
    const word = words[i].toLowerCase();
    
    // Check if it's a state abbreviation
    if (validStateAbbrs.has(word.toUpperCase())) {
      return {
        state: word.toUpperCase(),
        remaining: words.slice(0, i).join(' ').trim(),
      };
    }
    
    // Check if it's a full state name
    if (stateAbbreviations[word]) {
      return {
        state: stateAbbreviations[word],
        remaining: words.slice(0, i).join(' ').trim(),
      };
    }
    
    // Check two-word state names (e.g., "New York", "North Carolina")
    if (i > 0) {
      const twoWords = `${words[i - 1]} ${words[i]}`.toLowerCase();
      if (stateAbbreviations[twoWords]) {
        return {
          state: stateAbbreviations[twoWords],
          remaining: words.slice(0, i - 1).join(' ').trim(),
        };
      }
    }
  }
  
  return { state: '', remaining: part };
}

/**
 * Check if an address field appears to contain a full address
 * (has city/state/zip embedded in it)
 */
export function isFullAddressField(address: string, city: string, state: string): boolean {
  // If city and state are already populated, not a full address issue
  if (city?.trim() && state?.trim()) {
    return false;
  }
  
  if (!address) return false;
  
  // Check for comma-delimited addresses
  if (address.includes(',')) {
    const parsed = parseFullAddress(address);
    return parsed.isValid && !!parsed.city && !!parsed.state;
  }
  
  // Check for space-delimited addresses (e.g., "123 MAIN ST CITY FL 32931")
  // Look for STATE ZIP pattern at the end
  const stateZipPattern = /\b([A-Z]{2})\s+(\d{5})(?:-\d{4})?\s*$/i;
  const match = address.match(stateZipPattern);
  if (match) {
    const potentialState = match[1].toUpperCase();
    if (validStateAbbrs.has(potentialState)) {
      return true;
    }
  }
  
  // Also check for STATE at end without ZIP (e.g., "123 MAIN ST CITY FL")
  const stateOnlyPattern = /\b([A-Z]{2})\s*$/i;
  const stateMatch = address.match(stateOnlyPattern);
  if (stateMatch) {
    const potentialState = stateMatch[1].toUpperCase();
    if (validStateAbbrs.has(potentialState)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Normalize state to 2-letter abbreviation
 */
export function normalizeState(state: string): string {
  if (!state) return '';
  
  const trimmed = state.trim().toLowerCase();
  
  // Already an abbreviation
  if (validStateAbbrs.has(trimmed.toUpperCase())) {
    return trimmed.toUpperCase();
  }
  
  // Full name
  return stateAbbreviations[trimmed] || state.toUpperCase();
}
