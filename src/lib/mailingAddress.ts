import type { Owner } from "@/types";
import {
  containsCanadianPostalCode,
  isCanadianAddress,
  parseCanadianAddress,
} from "@/lib/canadianAddressParser";

export type DerivedMailingFields = {
  mailingAddress: string;
  mailingCity: string;
  mailingState: string;
  mailingZip: string;
  isCanadian: boolean;
};

/**
 * Pattern to detect unit/PO Box prefixes at the start of a city field.
 * Matches: "PMB 1033", "PO BOX 456", "P.O. BOX 789", "APT 5A", "UNIT 12-B", "STE 100", "# 22"
 * Captures: [1] prefix, [2] unit number, [3] remaining city name
 */
const UNIT_IN_CITY_PATTERN = /^(PMB|P\.?O\.?\s*BOX|APT\.?|APARTMENT|UNIT|STE\.?|SUITE|#)\s*([A-Z0-9]+(?:[-][A-Z0-9]+)?)\s+(.+)$/i;

/**
 * Helper: Title Case conversion for addresses
 */
function toTitleCase(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    // Keep common abbreviations uppercase
    .replace(/\b(Nw|Ne|Sw|Se|Po|Apt|Ste|Fl|Pmb)\b/gi, (match) => match.toUpperCase())
    .replace(/\b(Ii|Iii|Iv)\b/gi, (match) => match.toUpperCase());
}

/**
 * Normalize unit prefix for consistent display
 */
function normalizeUnitPrefix(prefix: string): string {
  const upper = prefix.toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
  if (upper === 'POBOX' || upper === 'PO BOX') return 'PO Box';
  if (upper === 'PMB') return 'PMB';
  if (upper === 'APT' || upper === 'APARTMENT') return 'Apt';
  if (upper === 'STE' || upper === 'SUITE') return 'Ste';
  if (upper === 'UNIT') return 'Unit';
  if (upper === '#') return '#';
  return toTitleCase(prefix);
}

/**
 * Detect and extract unit/PO Box from city field.
 * Returns null if no unit prefix detected.
 */
export function extractUnitFromCity(city: string): { unit: string; cleanCity: string } | null {
  if (!city) return null;
  
  const match = city.trim().match(UNIT_IN_CITY_PATTERN);
  if (!match) return null;
  
  const [, prefix, unitNum, remainingCity] = match;
  const normalizedPrefix = normalizeUnitPrefix(prefix);
  const unit = normalizedPrefix === '#' 
    ? `#${unitNum.toUpperCase()}` 
    : `${normalizedPrefix} ${unitNum.toUpperCase()}`;
  
  return {
    unit,
    cleanCity: toTitleCase(remainingCity.trim()),
  };
}

/**
 * Check if a city field contains a unit/PO Box prefix
 */
export function hasUnitInCity(city: string): boolean {
  if (!city) return false;
  return UNIT_IN_CITY_PATTERN.test(city.trim());
}

/**
 * Derive mailing components for UI/export.
 *
 * Prefers structured mailing fields when present; otherwise attempts local
 * Canadian parsing (no external verification) before falling back to the
 * property's address components.
 * 
 * Also detects and fixes PO Box/PMB/Unit prefixes incorrectly stored in city field.
 */
export function deriveMailingFields(
  owner: Partial<Owner> | null | undefined,
  property: any
): DerivedMailingFields {
  const propertyAddress = String(property?.address ?? "").trim();
  const rawMailingAddress = String(owner?.mailingAddress ?? propertyAddress).trim();

  const structuredComplete =
    !!String(owner?.mailingCity ?? "").trim() &&
    !!String(owner?.mailingState ?? "").trim() &&
    !!String(owner?.mailingZip ?? "").trim() &&
    String(owner?.mailingState ?? "").trim().toUpperCase() !== "XX";

  const isCanadian =
    !!rawMailingAddress &&
    (isCanadianAddress(rawMailingAddress) || containsCanadianPostalCode(rawMailingAddress));

  // Default fallbacks (today's behavior)
  let mailingAddress = rawMailingAddress;
  let mailingCity = String(owner?.mailingCity ?? property?.city ?? "").trim();
  let mailingState = String(owner?.mailingState ?? property?.state ?? "").trim();
  let mailingZip = String(owner?.mailingZip ?? property?.zip ?? "").trim();

  // If structured is missing (or state placeholder), try parsing CA address inline
  const shouldAttemptParse = !structuredComplete || mailingState.toUpperCase() === "XX";
  if (shouldAttemptParse && isCanadian) {
    const parsed = parseCanadianAddress(rawMailingAddress);
    if (parsed.isValid) {
      mailingAddress = parsed.street;
      mailingCity = parsed.city;
      mailingState = parsed.province;
      mailingZip = parsed.postalCode;
    }
  }

  // Check for unit/PO Box prefix incorrectly stored in city field
  const unitExtraction = extractUnitFromCity(mailingCity);
  if (unitExtraction) {
    // Append unit to street address with comma separator
    mailingAddress = mailingAddress
      ? `${toTitleCase(mailingAddress)}, ${unitExtraction.unit}`
      : unitExtraction.unit;
    mailingCity = unitExtraction.cleanCity;
  } else {
    // Apply title case to address if no unit extraction happened
    mailingAddress = toTitleCase(mailingAddress);
  }

  // Ensure city is title cased
  if (mailingCity && !unitExtraction) {
    mailingCity = toTitleCase(mailingCity);
  }

  return {
    mailingAddress,
    mailingCity,
    mailingState,
    mailingZip,
    isCanadian,
  };
}
