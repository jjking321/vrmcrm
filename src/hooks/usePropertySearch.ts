import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Property, Owner, MarketData, PhoneContact, OwnerContact, EmailContact } from '@/types';

export const usePropertySearch = (searchTerm: string, enabled: boolean = true) => {
  const { company } = useAuth();

  return useQuery({
    queryKey: ['property-search', company?.id, searchTerm],
    queryFn: async () => {
      if (!company?.id || !searchTerm || searchTerm.length < 2) return [];

      const term = `%${searchTerm}%`;

      // Search properties by address, city, state, zip
      const { data: propertiesData, error: propertiesError } = await supabase
        .from('properties')
        .select(`
          *,
          owners (*)
        `)
        .eq('company_id', company.id)
      .or(`address.ilike.${term},city.ilike.${term},state.ilike.${term},zip.ilike.${term}`)
        .range(0, 9999);

      if (propertiesError) throw propertiesError;

      // Also search by owner name
      const { data: ownerMatches, error: ownerError } = await supabase
        .from('owners')
        .select(`
          property_id,
          properties (
            *,
            owners (*)
          )
        `)
        .eq('company_id', company.id)
        .ilike('name', term)
        .range(0, 9999);

      if (ownerError) throw ownerError;

      // Merge results, avoiding duplicates
      const propertyMap = new Map<string, any>();
      
      // Add properties from direct search
      (propertiesData || []).forEach(p => {
        propertyMap.set(p.id, p);
      });

      // Add properties from owner search
      (ownerMatches || []).forEach(match => {
        if (match.properties && !propertyMap.has(match.properties.id)) {
          propertyMap.set(match.properties.id, match.properties);
        }
      });

      // Transform to Property type
      const results: Property[] = Array.from(propertyMap.values()).map((row: any) => {
        const ownerData = row.owners?.[0];
        
        const owner: Owner = ownerData ? {
          name: ownerData.name || '',
          email: ownerData.email || '',
          phone: ownerData.phone || '',
          phones: (ownerData.phones as PhoneContact[]) || [],
          emails: (ownerData.emails as EmailContact[]) || [],
          mailingAddress: ownerData.mailing_address || '',
          mailingCity: ownerData.mailing_city || '',
          mailingState: ownerData.mailing_state || '',
          mailingZip: ownerData.mailing_zip || '',
          ownerType: ownerData.owner_type || undefined,
          contactName: ownerData.contact_name || undefined,
          ownershipLengthMonths: ownerData.ownership_length_months || undefined,
          ownerOccupied: ownerData.owner_occupied || undefined,
          litigator: ownerData.litigator || false,
          owners: (ownerData.owners as OwnerContact[]) || [],
          notes: ownerData.notes || '',
        } : {
          name: '',
          email: '',
          phone: '',
          phones: [],
          emails: [],
          mailingAddress: '',
          mailingCity: '',
          mailingState: '',
          mailingZip: '',
          owners: [],
          notes: '',
        };

        const marketData: MarketData = {
          projectedRevenue: (row.market_data as any)?.projectedRevenue || 0,
          propertyValue: (row.market_data as any)?.propertyValue || 0,
          adr: (row.market_data as any)?.adr || 0,
          occupancyRate: (row.market_data as any)?.occupancyRate || 0,
          monthlyRevenueDistribution: (row.market_data as any)?.monthlyRevenueDistribution || [],
        };

        return {
          id: row.id,
          companyId: row.company_id,
          address: row.address,
          city: row.city,
          state: row.state,
          zip: row.zip,
          latitude: row.latitude,
          longitude: row.longitude,
          bedrooms: row.bedrooms || 0,
          bathrooms: row.bathrooms || 0,
          guests: row.guests,
          squareFeet: row.square_feet,
          yearBuilt: row.year_built,
          lotSize: row.lot_size,
          propertyType: row.property_type,
          image: row.image || '',
          airbnbUrl: row.airbnb_url,
          zillowUrl: row.zillow_url,
          propertyUrl: row.property_url,
          listingTitle: row.listing_title,
          roomType: row.room_type,
          propertyManager: row.property_manager,
          host: row.host,
          stageId: row.stage_id || '',
          tags: row.tags || [],
          owner,
          marketData,
          activities: [],
          customFields: (row.custom_fields as Record<string, any>) || {},
        };
      });

      return results;
    },
    enabled: enabled && !!company?.id && searchTerm.length >= 2,
    staleTime: 30000, // Cache for 30 seconds
  });
};
