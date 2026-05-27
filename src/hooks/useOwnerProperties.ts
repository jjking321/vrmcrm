import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Property, Owner, Activity, PhoneContact, EmailContact, OwnerContact, MarketData } from '@/types';

export const useOwnerProperties = (ownerName: string | null) => {
  const { company } = useAuth();

  return useQuery({
    queryKey: ['owner-properties', ownerName, company?.id],
    queryFn: async () => {
      if (!ownerName || !company?.id) return [];

      // Query owners table where name matches
      const { data: owners, error } = await supabase
        .from('owners')
        .select('property_id')
        .eq('company_id', company.id)
        .or(`name.ilike.%${ownerName}%`);

      if (error) throw error;

      // Get unique property IDs
      const propertyIds = [...new Set(owners?.map(o => o.property_id) || [])];
      
      if (propertyIds.length === 0) return [];

      // Fetch all properties with their owners and activities
      const { data: propertiesData, error: propError } = await supabase
        .from('properties')
        .select(`
          *,
          owners (*),
          activity_logs (*)
        `)
        .in('id', propertyIds);

      if (propError) throw propError;

      // Transform to Property type
      const properties: Property[] = (propertiesData || []).map(p => {
        const ownerData = Array.isArray(p.owners) ? p.owners[0] : p.owners;
        
        const owner: Owner = ownerData ? {
          // @ts-expect-error - storing the owner row id on the legacy Owner type
          id: ownerData.id,
          name: ownerData.name || '',
          email: ownerData.email || '',
          phone: ownerData.phone || '',
          owners: (ownerData.owners as unknown as OwnerContact[]) || [],
          phones: (ownerData.phones as unknown as PhoneContact[]) || [],
          emails: (ownerData.emails as unknown as EmailContact[]) || [],
          mailingAddress: ownerData.mailing_address || undefined,
          mailingCity: ownerData.mailing_city || undefined,
          mailingState: ownerData.mailing_state || undefined,
          mailingZip: ownerData.mailing_zip || undefined,
          ownerType: ownerData.owner_type || undefined,
          ownershipLengthMonths: ownerData.ownership_length_months || undefined,
          ownerOccupied: ownerData.owner_occupied || undefined,
          litigator: ownerData.litigator || false,
          lastVerifiedDate: ownerData.last_verified_date || undefined,
          notes: ownerData.notes || undefined,
          age: ownerData.age || undefined,
          contactName: ownerData.contact_name || undefined,
        } : {
          name: '',
          email: '',
          phone: '',
          owners: [],
          phones: [],
          emails: [],
        };

        const activities: Activity[] = (p.activity_logs || []).map((a: any) => ({
          id: a.id,
          type: a.type,
          content: a.content,
          date: a.date,
          outcome: a.outcome,
        }));

        const rawMarketData = p.market_data as unknown as Record<string, any> | null;
        const marketData: MarketData = {
          adr: rawMarketData?.adr || rawMarketData?.ADR || 0,
          occupancyRate: rawMarketData?.occupancyRate || 0,
          projectedRevenue: rawMarketData?.projectedRevenue || 0,
          propertyValue: rawMarketData?.propertyValue || 0,
          airbnbRating: rawMarketData?.airbnbRating,
          reviewCount: rawMarketData?.reviewCount,
          monthlyRevenueDistribution: rawMarketData?.monthlyRevenueDistribution,
        };

        return {
          id: p.id,
          companyId: p.company_id,
          address: p.address,
          city: p.city,
          state: p.state,
          zip: p.zip,
          bedrooms: p.bedrooms,
          bathrooms: p.bathrooms,
          guests: p.guests || undefined,
          squareFeet: p.square_feet || undefined,
          yearBuilt: p.year_built || undefined,
          lotSize: p.lot_size ? Number(p.lot_size) : undefined,
          propertyType: p.property_type || undefined,
          image: p.image || '',
          stageId: p.stage_id || '',
          tags: p.tags || [],
          owner,
          activities,
          marketData,
          customFields: (p.custom_fields as Record<string, any>) || {},
          airbnbUrl: p.airbnb_url || undefined,
          zillowUrl: p.zillow_url || undefined,
          propertyUrl: p.property_url || undefined,
          listingTitle: p.listing_title || undefined,
          roomType: p.room_type || undefined,
          propertyManager: p.property_manager || undefined,
          host: p.host || undefined,
          latitude: p.latitude || undefined,
          longitude: p.longitude || undefined,
        };
      });

      // Filter to only properties where this owner name actually matches (case-insensitive)
      const ownerNameLower = ownerName.toLowerCase();
      
      return properties.filter(p => {
        // Check primary name (case-insensitive)
        const primaryName = p.owner.owners?.[0] 
          ? `${p.owner.owners[0].firstName} ${p.owner.owners[0].lastName}`.trim()
          : p.owner.name;
        if (primaryName.toLowerCase() === ownerNameLower) return true;
        
        // Check additional owners (case-insensitive)
        if (p.owner.owners) {
          return p.owner.owners.some(o => 
            `${o.firstName} ${o.lastName}`.trim().toLowerCase() === ownerNameLower
          );
        }
        
        return p.owner.name.toLowerCase() === ownerNameLower;
      });
    },
    enabled: !!ownerName && !!company?.id,
  });
};
