// Utility functions for exclusion list matching

/**
 * Normalize a name for comparison
 * Handles variations like "John Smith" vs "Smith, John"
 */
export const normalizeNameForMatch = (name: string): string => {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[.,\-']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Check if two names match
 * Handles "Last, First" vs "First Last" format
 */
export const namesMatch = (name1: string, name2: string): boolean => {
  if (!name1 || !name2) return false;
  
  const n1 = normalizeNameForMatch(name1);
  const n2 = normalizeNameForMatch(name2);
  
  if (n1 === n2) return true;
  
  // Handle "Last, First" vs "First Last"
  const checkReversed = (a: string, b: string): boolean => {
    const parts = b.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length === 2) {
      const reversed = `${parts[1]} ${parts[0]}`;
      if (normalizeNameForMatch(reversed) === a) return true;
    }
    return false;
  };
  
  return checkReversed(n1, n2) || checkReversed(n2, n1);
};

/**
 * Normalize an address for comparison
 * Standardizes street suffixes and removes punctuation
 */
export const normalizeAddressForMatch = (
  address: string,
  city: string,
  state: string
): string => {
  if (!address) return '';
  
  const streetSuffixes: Record<string, string> = {
    'street': 'st', 'st': 'st',
    'avenue': 'ave', 'ave': 'ave',
    'drive': 'dr', 'dr': 'dr',
    'road': 'rd', 'rd': 'rd',
    'lane': 'ln', 'ln': 'ln',
    'boulevard': 'blvd', 'blvd': 'blvd',
    'court': 'ct', 'ct': 'ct',
    'circle': 'cir', 'cir': 'cir',
    'place': 'pl', 'pl': 'pl',
    'way': 'way',
    'trail': 'trl', 'trl': 'trl',
  };

  let normalized = `${address} ${city || ''} ${state || ''}`
    .toLowerCase()
    .replace(/[.,#\-']/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  for (const [full, abbr] of Object.entries(streetSuffixes)) {
    normalized = normalized.replace(new RegExp(`\\b${full}\\b`, 'g'), abbr);
  }

  return normalized;
};

/**
 * Check if two addresses match
 */
export const addressesMatch = (
  addr1: { address: string; city?: string; state?: string },
  addr2: { address: string; city?: string; state?: string }
): boolean => {
  const n1 = normalizeAddressForMatch(addr1.address, addr1.city || '', addr1.state || '');
  const n2 = normalizeAddressForMatch(addr2.address, addr2.city || '', addr2.state || '');
  
  return n1 === n2 && n1 !== '';
};

/**
 * Check if an email matches (case-insensitive)
 */
export const emailsMatch = (email1: string, email2: string): boolean => {
  if (!email1 || !email2) return false;
  return email1.toLowerCase().trim() === email2.toLowerCase().trim();
};

/**
 * Normalize a phone number for comparison
 * Strips all non-digits and returns last 10 digits (handles country codes)
 */
export const normalizePhoneForMatch = (phone: string): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  // Return last 10 digits to handle country codes like +1
  return digits.slice(-10);
};

/**
 * Check if two phone numbers match
 * Requires at least 10 digits for a valid match
 */
export const phonesMatch = (phone1: string, phone2: string): boolean => {
  if (!phone1 || !phone2) return false;
  const n1 = normalizePhoneForMatch(phone1);
  const n2 = normalizePhoneForMatch(phone2);
  return n1 === n2 && n1.length >= 10;
};
