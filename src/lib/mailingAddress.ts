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
 * Pattern to check if street address ends with a unit prefix (without number)
 * Matches: "PO Box", "PO BOX", "PMB", "Apt", "Suite", "Unit", "#"
 */
const STREET_ENDS_WITH_UNIT_PATTERN = /(PO\s*BOX|P\.?O\.?\s*BOX|PMB|APT\.?|APARTMENT|UNIT|STE\.?|SUITE|#)\s*$/i;

/**
 * Pattern to check if street address ends with a road suffix (without route number)
 * Matches: "420 County Road", "11988 State Route", "21998 Business Highway"
 */
const STREET_ENDS_WITH_ROAD_SUFFIX_PATTERN = /(HIGHWAY|HWY|ROUTE|RTE|ROAD|RD|COUNTY\s+ROAD|STATE\s+ROUTE|BUSINESS\s+HIGHWAY)\s*$/i;

/**
 * Pattern to detect number at start of city when street ends with unit prefix
 * Matches: "2699 Springfield", "123 Main City Name"
 * Captures: [1] number, [2] remaining city name
 */
const NUMBER_IN_CITY_PATTERN = /^(\d+)\s+(.+)$/;

/**
 * Pattern to detect directional prefix at start of city field
 * Matches: "NE Minneapolis", "SW Portland", "N Chicago"
 * Captures: [1] directional, [2] remaining city name
 * Note: Longer directionals (NE, NW, SE, SW) listed first to ensure correct matching
 */
const DIRECTIONAL_IN_CITY_PATTERN = /^(NE|NW|SE|SW|N|S|E|W)\s+(.+)$/i;

/**
 * Pattern to detect highway/route suffix at start of city field
 * Matches: "Hwy Islamorada", "Highway Tampa", "Rte Boston"
 * Captures: [1] highway suffix, [2] remaining city name
 */
const HIGHWAY_IN_CITY_PATTERN = /^(HIGHWAY|HWY|ROUTE|RTE)\s+(.+)$/i;

/**
 * Common city word abbreviations that should be expanded
 */
const CITY_ABBREVIATION_EXPANSIONS: Record<string, string> = {
  'bch': 'Beach',
  'hts': 'Heights',
  'spgs': 'Springs',
  'vlg': 'Village',
  'hbr': 'Harbor',
  'lk': 'Lake',
  'mt': 'Mount',
  'pt': 'Point',
  'jct': 'Junction',
  'vly': 'Valley',
  'ctr': 'Center',
  'twp': 'Township',
};

/**
 * Helper: Title Case conversion for addresses
 * Also expands common city abbreviations (Bch -> Beach, etc.)
 */
function toTitleCase(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    // Keep common abbreviations uppercase
    .replace(/\b(Nw|Ne|Sw|Se|Po|Apt|Ste|Fl|Pmb)\b/gi, (match) => match.toUpperCase())
    .replace(/\b(Ii|Iii|Iv)\b/gi, (match) => match.toUpperCase())
    // Expand common city abbreviations
    .replace(/\b(Bch|Hts|Spgs|Vlg|Hbr|Lk|Mt|Pt|Jct|Vly|Ctr|Twp)\b/gi, (match) => {
      const key = match.toLowerCase();
      return CITY_ABBREVIATION_EXPANSIONS[key] || match;
    });
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
    // Check for split PO Box: street ends with prefix, city starts with number
    // e.g., Address: "PO Box", City: "2699 Springfield"
    const streetEndsWithUnit = mailingAddress.match(STREET_ENDS_WITH_UNIT_PATTERN);
    const cityStartsWithNumber = mailingCity.match(NUMBER_IN_CITY_PATTERN);
    
    if (streetEndsWithUnit && cityStartsWithNumber) {
      const [, unitNumber, cleanCityName] = cityStartsWithNumber;
      // Append number to street address
      mailingAddress = `${toTitleCase(mailingAddress)} ${unitNumber}`;
      mailingCity = toTitleCase(cleanCityName.trim());
    } else {
      // Check for split route/road: street ends with road suffix, city starts with number
      // e.g., Address: "420 COUNTY ROAD", City: "793 BROOKLAND"
      const streetEndsWithRoadSuffix = mailingAddress.match(STREET_ENDS_WITH_ROAD_SUFFIX_PATTERN);
      if (streetEndsWithRoadSuffix && cityStartsWithNumber) {
        const [, routeNumber, cleanCityName] = cityStartsWithNumber;
        mailingAddress = `${toTitleCase(mailingAddress)} ${routeNumber}`;
        mailingCity = toTitleCase(cleanCityName.trim());
      } else {
        // Apply title case to address if no extraction happened
        mailingAddress = toTitleCase(mailingAddress);
        // Ensure city is title cased
        if (mailingCity) {
          mailingCity = toTitleCase(mailingCity);
        }
      }
    }
  }

  // Check for directional prefix in city: "NE Minneapolis" -> "Minneapolis"
  const directionalMatch = mailingCity.match(DIRECTIONAL_IN_CITY_PATTERN);
  if (directionalMatch) {
    const [, directional, cleanCityName] = directionalMatch;
    // Append directional to street address
    mailingAddress = `${mailingAddress} ${directional.toUpperCase()}`;
    mailingCity = toTitleCase(cleanCityName.trim());
  }

  // Check for highway suffix in city: "Hwy Islamorada" -> "Islamorada"
  const highwayMatch = mailingCity.match(HIGHWAY_IN_CITY_PATTERN);
  if (highwayMatch) {
    const [, highwaySuffix, cleanCityName] = highwayMatch;
    // Append highway suffix to street address (Title Case: "Hwy", "Highway", "Rte", "Route")
    const formattedSuffix = highwaySuffix.charAt(0).toUpperCase() + highwaySuffix.slice(1).toLowerCase();
    mailingAddress = `${mailingAddress} ${formattedSuffix}`;
    mailingCity = toTitleCase(cleanCityName.trim());
  }

  return {
    mailingAddress,
    mailingCity,
    mailingState,
    mailingZip,
    isCanadian,
  };
}
