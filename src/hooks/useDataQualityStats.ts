import { useMemo } from 'react';
import { useAllOwners } from './useAllOwners';
import { useBadContactData } from './useBadContactData';

export interface SourceQualityRow {
  source: string;
  addressTotal: number;
  addressBad: number;
  phoneTotal: number;
  phoneBad: number;
  emailTotal: number;
  emailBad: number;
  totalContributions: number;
  totalBad: number;
  badRate: number;
}

export function useDataQualityStats(): {
  rows: SourceQualityRow[];
  totalBad: number;
  totalContacts: number;
} {
  const { data: ownersData } = useAllOwners();
  const { data: bad = [] } = useBadContactData();

  return useMemo(() => {
    const map = new Map<string, SourceQualityRow>();
    const getRow = (source: string): SourceQualityRow => {
      const key = source || 'unknown';
      if (!map.has(key)) {
        map.set(key, {
          source: key,
          addressTotal: 0,
          addressBad: 0,
          phoneTotal: 0,
          phoneBad: 0,
          emailTotal: 0,
          emailBad: 0,
          totalContributions: 0,
          totalBad: 0,
          badRate: 0,
        });
      }
      return map.get(key)!;
    };

    const owners = ownersData?.owners || [];
    let totalContacts = 0;
    for (const o of owners as any[]) {
      // mailing addresses sourced from owner-level source if present
      if (o.mailingAddress) {
        const row = getRow(o.source || 'unknown');
        row.addressTotal++;
        totalContacts++;
      }
      for (const p of o.phones || []) {
        const row = getRow(p.source || 'unknown');
        row.phoneTotal++;
        totalContacts++;
      }
      for (const e of o.emails || []) {
        const row = getRow(e.source || 'unknown');
        row.emailTotal++;
        totalContacts++;
      }
    }

    for (const b of bad) {
      const row = getRow(b.source || 'unknown');
      if (b.data_type === 'mailing_address') row.addressBad++;
      else if (b.data_type === 'phone') row.phoneBad++;
      else if (b.data_type === 'email') row.emailBad++;
    }

    const rows = Array.from(map.values()).map(r => {
      r.totalContributions = r.addressTotal + r.phoneTotal + r.emailTotal;
      r.totalBad = r.addressBad + r.phoneBad + r.emailBad;
      r.badRate = r.totalContributions > 0 ? r.totalBad / r.totalContributions : 0;
      return r;
    });
    rows.sort((a, b) => b.badRate - a.badRate);

    return { rows, totalBad: bad.length, totalContacts };
  }, [ownersData, bad]);
}