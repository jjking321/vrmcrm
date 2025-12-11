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

  // If only one part (no commas), try to parse it
  if (parts.length === 1) {
    // Try to find state at the end
    const words = parts[0].split(/\s+/);
    const lastWord = words[words.length - 1]?.toLowerCase();
    
    // Check if last word is a state abbreviation
    if (lastWord && validStateAbbrs.has(lastWord.toUpperCase())) {
      result.state = lastWord.toUpperCase();
      result.street = words.slice(0, -1).join(' ');
      result.isValid = !!result.street;
    } else if (lastWord && stateAbbreviations[lastWord]) {
      result.state = stateAbbreviations[lastWord];
      result.street = words.slice(0, -1).join(' ');
      result.isValid = !!result.street;
    } else {
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
  
  // Check if address contains a comma (suggests city/state in it)
  if (!address.includes(',')) return false;
  
  // Parse and see if we can extract valid components
  const parsed = parseFullAddress(address);
  return parsed.isValid && !!parsed.city && !!parsed.state;
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
