import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface AggregatedOwner {
  name: string;
  propertyCount: number;
  email: string;
  phone: string;
  totalRevenue: number;
}

export const useAllOwners = () => {
  const { company } = useAuth();

  return useQuery({
    queryKey: ['all-owners', company?.id],
    queryFn: async () => {
      if (!company?.id) return { owners: [], propertiesWithoutOwner: 0 };

      // Fetch all owners with their property data
      // Handle pagination for large datasets
      let allOwners: any[] = [];
      let hasMore = true;
      let offset = 0;
      const batchSize = 1000;

      while (hasMore) {
        const { data: ownersBatch, error } = await supabase
          .from('owners')
          .select('name, email, phone, property_id')
          .eq('company_id', company.id)
          .range(offset, offset + batchSize - 1);

        if (error) throw error;
        
        if (ownersBatch) {
          allOwners = [...allOwners, ...ownersBatch];
        }
        
        hasMore = ownersBatch?.length === batchSize;
        offset += batchSize;
      }

      // Get property IDs that have owners
      const propertyIdsWithOwners = new Set(allOwners.map(o => o.property_id));

      // Fetch all properties with market data for revenue calculation
      let allProperties: any[] = [];
      hasMore = true;
      offset = 0;

      while (hasMore) {
        const { data: propertiesBatch, error } = await supabase
          .from('properties')
          .select('id, market_data')
          .eq('company_id', company.id)
          .range(offset, offset + batchSize - 1);

        if (error) throw error;
        
        if (propertiesBatch) {
          allProperties = [...allProperties, ...propertiesBatch];
        }
        
        hasMore = propertiesBatch?.length === batchSize;
        offset += batchSize;
      }

      // Create map of property ID to revenue
      const propertyRevenueMap = new Map<string, number>();
      allProperties.forEach(p => {
        const marketData = p.market_data as Record<string, any> | null;
        const revenue = marketData?.projectedRevenue || 0;
        propertyRevenueMap.set(p.id, revenue);
      });

      // Count properties without owners
      const propertiesWithoutOwner = allProperties.filter(p => !propertyIdsWithOwners.has(p.id)).length;

      // Aggregate owners by name (case-insensitive to match dashboard)
      const ownersMap = new Map<string, AggregatedOwner>();

      allOwners.forEach(owner => {
        const rawName = owner.name?.trim();
        if (!rawName) return; // Skip empty owner names

        // Use case-insensitive key for aggregation (matches useDashboardStats)
        const normalizedKey = rawName.toLowerCase();
        const existing = ownersMap.get(normalizedKey);
        const revenue = propertyRevenueMap.get(owner.property_id) || 0;

        if (existing) {
          // Keep the better formatted name (prefer Title Case over ALL CAPS)
          const hasProperCase = (n: string) => /[A-Z]/.test(n) && /[a-z]/.test(n);
          const displayName = hasProperCase(rawName) ? rawName : existing.name;
          
          ownersMap.set(normalizedKey, {
            ...existing,
            name: displayName,
            propertyCount: existing.propertyCount + 1,
            totalRevenue: existing.totalRevenue + revenue,
          });
        } else {
          ownersMap.set(normalizedKey, {
            name: rawName,
            propertyCount: 1,
            email: owner.email || '',
            phone: owner.phone || '',
            totalRevenue: revenue,
          });
        }
      });

      const owners = Array.from(ownersMap.values());

      return { owners, propertiesWithoutOwner };
    },
    enabled: !!company?.id,
  });
};
