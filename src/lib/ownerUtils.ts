import { Owner, PhoneContact, OwnerContact, EmailContact } from '@/types';

/**
 * Convert a string to Title Case
 */
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Normalize owner name to Title Case with special handling for Mc/Mac surnames
 */
export function normalizeOwnerName(name: string): string {
  if (!name || !name.trim()) return '';
  
  let result = toTitleCase(name.trim());
  
  // Handle Mc/Mac surnames (McDonald, McAuliff, MacArthur, etc.)
  result = result.replace(/\bMc([a-z])/g, (_, letter) => `Mc${letter.toUpperCase()}`);
  result = result.replace(/\bMac([a-z])/g, (_, letter) => `Mac${letter.toUpperCase()}`);
  
  // Handle O' surnames (O'Brien, O'Connor)
  result = result.replace(/\bO'([a-z])/g, (_, letter) => `O'${letter.toUpperCase()}`);
  
  return result;
}

/**
 * Check if a name is in Title Case format (better formatted than ALL CAPS or all lowercase)
 */
export function isProperlyFormatted(name: string): boolean {
  if (!name) return false;
  // A properly formatted name has mixed case (not all upper, not all lower)
  const hasUpper = /[A-Z]/.test(name);
  const hasLower = /[a-z]/.test(name);
  return hasUpper && hasLower;
}

/**
 * Get the primary display name for an owner
 * Uses the first owner in the owners array, or falls back to the legacy name field
 */
export function getPrimaryOwnerName(owner: Owner): string {
  if (owner.owners && owner.owners.length > 0) {
    const first = owner.owners[0];
    return `${first.firstName} ${first.lastName}`.trim();
  }
  return owner.name || 'Unknown';
}

/**
 * Get all owner names as a formatted string
 */
export function getAllOwnerNames(owner: Owner): string {
  if (owner.owners && owner.owners.length > 0) {
    return owner.owners
      .map(o => `${o.firstName} ${o.lastName}`.trim())
      .filter(n => n.length > 0)
      .join(', ');
  }
  return owner.name || 'Unknown';
}

/**
 * Get all owner names as an array
 */
export function getAllOwnerNamesArray(owner: Owner): string[] {
  if (owner.owners && owner.owners.length > 0) {
    return owner.owners
      .map(o => `${o.firstName} ${o.lastName}`.trim())
      .filter(n => n.length > 0);
  }
  return owner.name ? [owner.name] : [];
}

/**
 * Get owner count
 */
export function getOwnerCount(owner: Owner): number {
  if (owner.owners && owner.owners.length > 0) {
    return owner.owners.length;
  }
  return owner.name ? 1 : 0;
}

/**
 * Get phones that are NOT flagged as Do Not Call
 */
export function getCallablePhones(owner: Owner): PhoneContact[] {
  if (owner.phones) {
    return owner.phones.filter(p => !p.doNotCall && p.number);
  }
  // Legacy single phone
  if (owner.phone) {
    return [{ number: owner.phone, type: 'unknown', doNotCall: false }];
  }
  return [];
}

/**
 * Get the primary phone number (first callable, or first in list)
 */
export function getPrimaryPhone(owner: Owner): PhoneContact | null {
  if (owner.phones && owner.phones.length > 0) {
    // Prefer callable phones
    const callable = owner.phones.find(p => !p.doNotCall && p.number);
    if (callable) return callable;
    // Fall back to first phone
    return owner.phones[0];
  }
  // Legacy single phone
  if (owner.phone) {
    return { number: owner.phone, type: 'unknown', doNotCall: false };
  }
  return null;
}

/**
 * Check if any phone has DNC flag
 */
export function hasDoNotCall(owner: Owner): boolean {
  if (owner.phones) {
    return owner.phones.some(p => p.doNotCall);
  }
  return false;
}

/**
 * Check if owner is a litigator (compliance risk)
 */
export function isLitigator(owner: Owner): boolean {
  return owner.litigator === true;
}

/**
 * Format the full mailing address
 */
export function formatMailingAddress(owner: Owner): string {
  const parts: string[] = [];
  
  if (owner.mailingAddress) {
    parts.push(owner.mailingAddress);
  }
  
  const cityStateParts: string[] = [];
  if (owner.mailingCity) cityStateParts.push(owner.mailingCity);
  if (owner.mailingState) cityStateParts.push(owner.mailingState);
  if (cityStateParts.length > 0) {
    let cityState = cityStateParts.join(', ');
    if (owner.mailingZip) cityState += ` ${owner.mailingZip}`;
    parts.push(cityState);
  } else if (owner.mailingZip) {
    parts.push(owner.mailingZip);
  }
  
  return parts.join(', ');
}

/**
 * Format ownership length in human-readable format
 */
export function formatOwnershipLength(months?: number): string {
  if (!months) return 'Unknown';
  
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  
  if (years === 0) {
    return `${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
  }
  
  if (remainingMonths === 0) {
    return `${years} year${years !== 1 ? 's' : ''}`;
  }
  
  return `${years} year${years !== 1 ? 's' : ''}, ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
}

/**
 * Get phone type badge color
 */
export function getPhoneTypeBadgeClass(type: string): string {
  switch (type) {
    case 'mobile':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'landline':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200';
  }
}

/**
 * Get owner type badge color
 */
export function getOwnerTypeBadgeClass(type?: string): string {
  if (!type) return 'bg-slate-50 text-slate-600 border-slate-200';
  
  const lowerType = type.toLowerCase();
  if (lowerType.includes('trust')) {
    return 'bg-violet-50 text-violet-700 border-violet-200';
  }
  if (lowerType.includes('individual')) {
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

// ============= Deduplication Helpers =============

/**
 * Normalize phone number for comparison (last 10 digits)
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

/**
 * Deduplicate phones by normalized number
 * First occurrence wins - preserves original source
 */
export function dedupePhones(phones: PhoneContact[]): PhoneContact[] {
  const seen = new Map<string, PhoneContact>();
  for (const phone of phones) {
    if (!phone.number) continue;
    const key = normalizePhone(phone.number);
    if (key.length >= 7 && !seen.has(key)) {
      seen.set(key, phone);
    }
  }
  return Array.from(seen.values());
}

/**
 * Deduplicate emails by address (case-insensitive)
 * First occurrence wins - preserves original source
 */
export function dedupeEmails(emails: EmailContact[]): EmailContact[] {
  const seen = new Map<string, EmailContact>();
  for (const email of emails) {
    if (!email.address) continue;
    const key = email.address.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.set(key, email);
    }
  }
  return Array.from(seen.values());
}

/**
 * Merge owner contacts (dedupe by name similarity, normalize to Title Case)
 * First occurrence wins - preserves original source
 */
export function mergeOwnerContacts(existing: OwnerContact[], incoming: OwnerContact[]): OwnerContact[] {
  const result: OwnerContact[] = [];
  
  // First, add existing with normalized names (preserve source)
  for (const owner of existing) {
    result.push({
      firstName: normalizeOwnerName(owner.firstName || ''),
      lastName: normalizeOwnerName(owner.lastName || ''),
      source: owner.source,
      addedAt: owner.addedAt,
    });
  }
  
  // Then add incoming if not duplicate (case-insensitive check)
  for (const newOwner of incoming) {
    if (!newOwner.firstName && !newOwner.lastName) continue;
    const normalizedFirst = normalizeOwnerName(newOwner.firstName || '');
    const normalizedLast = normalizeOwnerName(newOwner.lastName || '');
    
    const exists = result.some(e => 
      (e.firstName?.toLowerCase() || '') === (normalizedFirst.toLowerCase()) &&
      (e.lastName?.toLowerCase() || '') === (normalizedLast.toLowerCase())
    );
    
    if (!exists) {
      result.push({
        firstName: normalizedFirst,
        lastName: normalizedLast,
        source: newOwner.source,
        addedAt: newOwner.addedAt,
      });
    }
  }
  
  return result;
}

/**
 * Transform import data row to Owner structure
 * @param data - The import row data
 * @param source - Optional source name (list name or "manual")
 */
export function transformImportToOwner(data: Record<string, any>, source?: string): Owner {
  const owners: OwnerContact[] = [];
  const phones: PhoneContact[] = [];
  const emails: EmailContact[] = [];
  const now = new Date().toISOString();
  
  // Parse multiple owners
  for (let i = 1; i <= 4; i++) {
    const firstName = data[`owner${i}FirstName`] || '';
    const lastName = data[`owner${i}LastName`] || '';
    if (firstName || lastName) {
      owners.push({ 
        firstName, 
        lastName,
        source: source || undefined,
        addedAt: now,
      });
    }
  }
  
  // Parse multiple phones
  for (let i = 1; i <= 3; i++) {
    const number = data[`phone${i}`] || '';
    if (number) {
      const typeRaw = (data[`phone${i}Type`] || 'unknown').toLowerCase();
      const type: 'mobile' | 'landline' | 'unknown' = 
        typeRaw.includes('mobile') || typeRaw.includes('wireless') ? 'mobile' :
        typeRaw.includes('landline') || typeRaw.includes('land') ? 'landline' : 'unknown';
      
      const dncRaw = data[`phone${i}DNC`] || '';
      const doNotCall = dncRaw === 'true' || dncRaw === '1' || dncRaw.toLowerCase() === 'yes' || dncRaw.toLowerCase() === 'dnc';
      
      phones.push({ 
        number, 
        type, 
        doNotCall,
        source: source || undefined,
        addedAt: now,
        status: 'unknown',
        callCount: 0,
      });
    }
  }
  
  // Parse multiple emails
  for (let i = 1; i <= 4; i++) {
    const emailAddr = data[`email${i}`] || (i === 1 ? (data.email || data.ownerEmail) : null);
    if (emailAddr && emailAddr.trim()) {
      emails.push({
        address: emailAddr.trim(),
        type: 'unknown',
        optedOut: false,
        source: source || undefined,
        addedAt: now,
        status: 'unknown',
      });
    }
  }
  
  // Normalize owner names to Title Case (preserve source metadata)
  const normalizedOwners: OwnerContact[] = owners.map(o => ({
    firstName: normalizeOwnerName(o.firstName),
    lastName: normalizeOwnerName(o.lastName),
    source: o.source,
    addedAt: o.addedAt,
  }));
  
  // Determine primary name for legacy field (normalized)
  const rawPrimaryName = normalizedOwners.length > 0 
    ? `${normalizedOwners[0].firstName} ${normalizedOwners[0].lastName}`.trim()
    : data.ownerName || data.contactName || '';
  const primaryName = normalizeOwnerName(rawPrimaryName);
  
  // Parse boolean fields
  const ownerOccupiedRaw = data.ownerOccupied || '';
  const ownerOccupied = ownerOccupiedRaw === 'true' || ownerOccupiedRaw === '1' || 
    ownerOccupiedRaw.toLowerCase() === 'yes' || ownerOccupiedRaw.toLowerCase() === 'owner occupied';
  
  const litigatorRaw = data.litigator || '';
  const litigator = litigatorRaw === 'true' || litigatorRaw === '1' || 
    litigatorRaw.toLowerCase() === 'yes' || litigatorRaw.toLowerCase() === 'litigator';
  
  return {
    name: primaryName,
    owners: normalizedOwners.length > 0 ? normalizedOwners : undefined,
    phones: phones.length > 0 ? phones : undefined,
    emails: emails.length > 0 ? emails : undefined,
    email: emails.length > 0 ? emails[0].address : (data.email || data.ownerEmail || ''),
    phone: phones.length > 0 ? phones[0].number : (data.ownerPhone || ''),
    mailingAddress: data.mailingAddress || '',
    mailingCity: data.mailingCity || '',
    mailingState: data.mailingState || '',
    mailingZip: data.mailingZip || '',
    ownershipLengthMonths: data.ownershipLength ? parseInt(data.ownershipLength, 10) : undefined,
    ownerType: data.ownerType || undefined,
    ownerOccupied: ownerOccupied || undefined,
    litigator: litigator || undefined,
    contactName: data.contactName || undefined,
    age: data.age ? parseInt(data.age, 10) : undefined,
    lastVerifiedDate: now,
  };
}
