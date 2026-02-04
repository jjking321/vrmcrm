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
 * Derive mailing components for UI/export.
 *
 * Prefers structured mailing fields when present; otherwise attempts local
 * Canadian parsing (no external verification) before falling back to the
 * property's address components.
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

  return {
    mailingAddress,
    mailingCity,
    mailingState,
    mailingZip,
    isCanadian,
  };
}
