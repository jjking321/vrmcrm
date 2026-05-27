import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
  isLoading: boolean;
} {
  const { company } = useAuth();
  const { data: bad = [] } = useBadContactData();

  const { data: ownersRaw = [], isLoading } = useQuery({
    queryKey: ['data-quality-owners', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      let all: any[] = [];
      let offset = 0;
      const batchSize = 1000;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from('owners')
          .select('phones, emails, mailing_address')
          .eq('company_id', company!.id)
          .range(offset, offset + batchSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < batchSize) break;
        offset += batchSize;
      }
      return all;
    },
  });

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

    let totalContacts = 0;
    for (const o of ownersRaw as any[]) {
      if (o.mailing_address) {
        const row = getRow('unknown'); // mailing address source not tracked yet
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

    return { rows, totalBad: bad.length, totalContacts, isLoading };
  }, [ownersRaw, bad, isLoading]);
}