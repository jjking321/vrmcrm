// Canadian Address Parser - handles Canadian mailing addresses

// Canadian Province mappings (full name to abbreviation)
const canadianProvinces: Record<string, string> = {
  'alberta': 'AB',
  'british columbia': 'BC',
  'manitoba': 'MB',
  'new brunswick': 'NB',
  'newfoundland': 'NL',
  'newfoundland and labrador': 'NL',
  'nova scotia': 'NS',
  'northwest territories': 'NT',
  'nunavut': 'NU',
  'ontario': 'ON',
  'prince edward island': 'PE',
  'quebec': 'QC',
  'saskatchewan': 'SK',
  'yukon': 'YT',
};

// Valid province abbreviations
export const validProvinceAbbrs = new Set([
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'
]);

// Canadian postal code pattern: A1A 1A1 or A1A1A1
// First letter cannot be D, F, I, O, Q, U, W, Z
const CANADIAN_POSTAL_REGEX = /\b([ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z])\s?(\d[ABCEGHJ-NPRSTV-Z]\d)\b/i;

// Lenient fallback: accepts any leading letter to handle dirty/typo data (e.g. I4Y0B3)
// while still requiring the overall A1A1A1 structure.
const CANADIAN_POSTAL_REGEX_LENIENT = /\b([A-Z]\d[A-Z])\s?(\d[A-Z]\d)\b/i;

// Partial postal code: A1A 1A (5 chars - missing final digit)
const CANADIAN_POSTAL_PARTIAL = /\b([A-Z]\d[A-Z])\s?(\d[A-Z])\b/i;

/**
 * Check if string contains a province keyword (name or abbreviation)
 */
function containsProvinceKeyword(str: string): boolean {
  const upper = str.toUpperCase();
  // Check abbreviations
  for (const abbr of validProvinceAbbrs) {
    if (new RegExp(`\\b${abbr}\\b`).test(upper)) return true;
  }
  // Check full names
  for (const name of Object.keys(canadianProvinces)) {
    if (upper.toLowerCase().includes(name)) return true;
  }
  return false;
}

export interface ParsedCanadianAddress {
  street: string;
  city: string;
  province: string;
  postalCode: string;
  isValid: boolean;
}

/**
 * Check if a string contains a Canadian postal code
 */
export function containsCanadianPostalCode(address: string): boolean {
  if (!address) return false;
  return CANADIAN_POSTAL_REGEX.test(address);
}

/**
 * Check if a string looks like a Canadian address
 * (has Canadian postal code or ends with CANADA)
 */
export function isCanadianAddress(address: string): boolean {
  if (!address) return false;
  const upper = address.toUpperCase();
  
  // Check for CANADA suffix
  if (upper.endsWith('CANADA') || upper.includes(', CANADA')) {
    return true;
  }
  
  // Check for Canadian postal code
  return containsCanadianPostalCode(address);
}

/**
 * Normalize a Canadian postal code to standard format (A1A 1A1)
 */
export function normalizePostalCode(postalCode: string): string {
  const cleaned = postalCode.replace(/\s/g, '').toUpperCase();
  if (cleaned.length === 6) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
  }
  return postalCode.toUpperCase();
}

/**
 * Title case conversion for Canadian addresses
 */
function toTitleCase(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    // Keep common abbreviations uppercase
    .replace(/\b(Nw|Ne|Sw|Se|Po|Apt|Ste|Fl|Ave|St|Rd|Dr|Blvd|Ln|Cres|Pl)\b/gi, 
      (match) => match.toUpperCase())
    .replace(/\b(Ii|Iii|Iv)\b/gi, (match) => match.toUpperCase());
}

/**
 * Parse a Canadian address string into components
 * 
 * Handles formats like:
 * - "6 SCARTH ROAD TORONTO ON M4W 2S6 CANADA"
 * - "206 WESTMINSTER AVE TORONTO M6R 1P1 ON CANADA"
 * - "41 WARDEN LN STOUFFVILLE ON L4A 7X5 CANADA"
 * - "331 PARKWOOD CIRCLE DORVAL QC H9S 3A4 CANADA"
 */
export function parseCanadianAddress(fullAddress: string): ParsedCanadianAddress {
  const result: ParsedCanadianAddress = {
    street: '',
    city: '',
    province: '',
    postalCode: '',
    isValid: false,
  };

  if (!fullAddress || typeof fullAddress !== 'string') {
    return result;
  }

  let working = fullAddress.trim();
  if (!working) {
    return result;
  }

  // Step 1: Strip CANADA suffix (handle typos too)
  const canadaSuffixes = [
    ', CANADA', ',CANADA', ' CANADA', ' CANAD', ' CANDA', ',CANAD', ',CANDA'
  ];
  for (const suffix of canadaSuffixes) {
    if (working.toUpperCase().endsWith(suffix)) {
      working = working.slice(0, -suffix.length).trim();
      break;
    }
  }

  // Step 2: Extract postal code
  // Prefer strict match; fallback to lenient for dirty data that still looks like a postal code.
  let postalMatch = working.match(CANADIAN_POSTAL_REGEX);
  let isPartialPostal = false;
  
  if (!postalMatch) {
    postalMatch = working.match(CANADIAN_POSTAL_REGEX_LENIENT);
  }
  if (!postalMatch) {
    // Try partial postal code (5 chars) if address contains province indicator
    if (containsProvinceKeyword(working)) {
      postalMatch = working.match(CANADIAN_POSTAL_PARTIAL);
      if (postalMatch) {
        isPartialPostal = true;
      }
    }
  }
  if (!postalMatch) return result;

  // Mark partial postal codes with ? suffix to indicate incomplete data
  result.postalCode = normalizePostalCode(postalMatch[1] + postalMatch[2]) + (isPartialPostal ? '?' : '');
  
  // Remove postal code from working string
  const postalStart = postalMatch.index!;
  const postalEnd = postalStart + postalMatch[0].length;
  
  // Get text before and after postal code
  let beforePostal = working.slice(0, postalStart).trim();
  let afterPostal = working.slice(postalEnd).trim();
  
  // Step 3: Find province - could be before or after postal code
  let province = '';
  let provinceSource: 'before' | 'after' | null = null;
  
  // Check after postal first (e.g., "TORONTO M6R 1P1 ON")
  if (afterPostal) {
    const words = afterPostal.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const word = words[i].toUpperCase();
      if (validProvinceAbbrs.has(word)) {
        province = word;
        provinceSource = 'after';
        afterPostal = words.slice(i + 1).join(' ').trim();
        break;
      }
      // Check full province name
      const fullName = words.slice(0, i + 1).join(' ').toLowerCase();
      if (canadianProvinces[fullName]) {
        province = canadianProvinces[fullName];
        provinceSource = 'after';
        afterPostal = words.slice(i + 1).join(' ').trim();
        break;
      }
    }
  }
  
  // Check before postal if not found after (e.g., "TORONTO ON M4W 2S6")
  if (!province) {
    const words = beforePostal.split(/\s+/);
    // Check last word(s)
    for (let i = words.length - 1; i >= 0; i--) {
      const word = words[i].toUpperCase();
      if (validProvinceAbbrs.has(word)) {
        province = word;
        provinceSource = 'before';
        beforePostal = words.slice(0, i).join(' ').trim();
        break;
      }
      // Check two-word province names
      if (i > 0) {
        const twoWords = `${words[i - 1]} ${words[i]}`.toLowerCase();
        if (canadianProvinces[twoWords]) {
          province = canadianProvinces[twoWords];
          provinceSource = 'before';
          beforePostal = words.slice(0, i - 1).join(' ').trim();
          break;
        }
      }
      // Single word province name
      const fullName = word.toLowerCase();
      if (canadianProvinces[fullName]) {
        province = canadianProvinces[fullName];
        provinceSource = 'before';
        beforePostal = words.slice(0, i).join(' ').trim();
        break;
      }
    }
  }

  if (!province) {
    // Can't determine province
    return result;
  }

  result.province = province;

  // Step 4: Extract city and street from beforePostal
  // The remaining beforePostal should be "street city"
  // We need to figure out where street ends and city begins
  
  const parts = beforePostal.split(',').map(p => p.trim()).filter(Boolean);
  
  if (parts.length >= 2) {
    // Comma-separated: "6 SCARTH ROAD, TORONTO" or "6 SCARTH ROAD, UNIT 5, TORONTO"
    result.city = parts[parts.length - 1];
    result.street = parts.slice(0, -1).join(', ');
  } else {
    // Space-delimited: "6 SCARTH ROAD TORONTO"
    const words = beforePostal.split(/\s+/);
    
    // Common street suffixes to help identify where street ends
    const streetSuffixes = [
      'st', 'street', 'ave', 'avenue', 'rd', 'road', 'dr', 'drive',
      'ln', 'lane', 'blvd', 'boulevard', 'ct', 'court', 'cir', 'circle',
      'way', 'pl', 'place', 'cres', 'crescent', 'terr', 'terrace',
      'unit', 'apt', 'suite', 'ste', '#', 'trl', 'trail', 'pkwy', 'parkway',
      'hwy', 'highway', 'park', 'close', 'grove', 'green', 'path'
    ];
    
    let streetEndIndex = words.length - 1; // Default: last word is city
    
    // Work backwards to find where street ends
    for (let i = words.length - 2; i >= 0; i--) {
      const word = words[i].toLowerCase();
      
      // If we find a street suffix, everything up to and including it is street
      if (streetSuffixes.includes(word)) {
        // Check if next word is a unit number
        if (['unit', 'apt', 'suite', 'ste', '#'].includes(word) && i + 1 < words.length - 1) {
          // Skip the unit number
          const nextWord = words[i + 1];
          if (/^\d+[A-Z]?$/i.test(nextWord)) {
            streetEndIndex = i + 2;
            break;
          }
        }
        streetEndIndex = i + 1;
        break;
      }
      
      // If it's a number after a unit indicator, include it in street
      if (/^\d+[A-Z]?$/i.test(word) && i > 0) {
        const prevWord = words[i - 1].toLowerCase();
        if (['unit', 'apt', 'suite', 'ste', '#'].includes(prevWord)) {
          continue;
        }
      }
    }
    
    if (streetEndIndex > 0 && streetEndIndex < words.length) {
      result.street = words.slice(0, streetEndIndex).join(' ');
      result.city = words.slice(streetEndIndex).join(' ');
    } else {
      // Fallback: assume last word is city
      result.city = words[words.length - 1];
      result.street = words.slice(0, -1).join(' ');
    }
  }

  // Apply title case
  result.street = toTitleCase(result.street);
  result.city = toTitleCase(result.city);
  result.isValid = !!result.street && !!result.city && !!result.province && !!result.postalCode;

  return result;
}
