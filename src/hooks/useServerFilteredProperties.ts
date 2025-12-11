import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Property, FilterRule, Activity, MarketData } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

interface DbProperty {
  id: string;
  company_id: string;
  stage_id: string | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number;
  bathrooms: number;
  guests: number | null;
  square_feet: number | null;
  year_built: number | null;
  lot_size: number | null;
  property_type: string | null;
  image: string | null;
  airbnb_url: string | null;
  zillow_url: string | null;
  property_url: string | null;
  booking_link: string | null;
  listing_title: string | null;
  room_type: string | null;
  property_manager: string | null;
  host: string | null;
  market_data: MarketData | null;
  tags: string[];
  custom_fields: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

interface DbOwner {
  id: string;
  property_id: string;
  company_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  owners: any[] | null;
  phones: any[] | null;
  emails: any[] | null;
  mailing_address: string | null;
  mailing_city: string | null;
  mailing_state: string | null;
  mailing_zip: string | null;
  ownership_length_months: number | null;
  owner_type: string | null;
  owner_occupied: boolean | null;
  litigator: boolean;
  contact_name: string | null;
  age: number | null;
  notes: string | null;
  last_verified_date: string | null;
}

interface DbActivity {
  id: string;
  property_id: string;
  company_id: string;
  type: string;
  content: string;
  outcome: string | null;
  date: string;
}

const toProperty = (
  dbProp: DbProperty,
  dbOwner: DbOwner | null,
  dbActivities: DbActivity[]
): Property => ({
  id: dbProp.id,
  companyId: dbProp.company_id,
  address: dbProp.address,
  city: dbProp.city,
  state: dbProp.state,
  zip: dbProp.zip,
  latitude: dbProp.latitude || undefined,
  longitude: dbProp.longitude || undefined,
  bedrooms: dbProp.bedrooms,
  bathrooms: dbProp.bathrooms,
  guests: dbProp.guests || undefined,
  squareFeet: dbProp.square_feet || undefined,
  yearBuilt: dbProp.year_built || undefined,
  lotSize: dbProp.lot_size || undefined,
  propertyType: dbProp.property_type || undefined,
  image: dbProp.image || '',
  stageId: dbProp.stage_id || undefined,
  tags: dbProp.tags || [],
  airbnbUrl: dbProp.airbnb_url || undefined,
  zillowUrl: dbProp.zillow_url || undefined,
  propertyUrl: dbProp.property_url || undefined,
  bookingLink: dbProp.booking_link || undefined,
  listingTitle: dbProp.listing_title || undefined,
  roomType: dbProp.room_type || undefined,
  propertyManager: dbProp.property_manager || undefined,
  host: dbProp.host || undefined,
  marketData: dbProp.market_data || {
    adr: 0,
    occupancyRate: 0,
    projectedRevenue: 0,
    propertyValue: 0,
  },
  customFields: dbProp.custom_fields || {},
  owner: dbOwner ? {
    name: dbOwner.name,
    email: dbOwner.email || '',
    phone: dbOwner.phone || '',
    owners: dbOwner.owners || undefined,
    phones: dbOwner.phones || undefined,
    emails: dbOwner.emails || undefined,
    mailingAddress: dbOwner.mailing_address || undefined,
    mailingCity: dbOwner.mailing_city || undefined,
    mailingState: dbOwner.mailing_state || undefined,
    mailingZip: dbOwner.mailing_zip || undefined,
    ownershipLengthMonths: dbOwner.ownership_length_months || undefined,
    ownerType: dbOwner.owner_type || undefined,
    ownerOccupied: dbOwner.owner_occupied || undefined,
    litigator: dbOwner.litigator,
    contactName: dbOwner.contact_name || undefined,
    age: dbOwner.age || undefined,
    notes: dbOwner.notes || undefined,
    lastVerifiedDate: dbOwner.last_verified_date || undefined,
  } : {
    name: '',
    email: '',
    phone: '',
  },
  activities: dbActivities.map(a => ({
    id: a.id,
    type: a.type as Activity['type'],
    date: a.date,
    content: a.content,
    outcome: a.outcome || undefined,
  })),
});

// Build RPC-style filter for a cleaner approach
const buildFilterParams = (rules: FilterRule[], matchType: 'and' | 'or') => {
  const propertyFilters: Array<{ field: string; op: string; value: string }> = [];
  const ownerFilters: Array<{ field: string; op: string; value: string }> = [];

  for (const rule of rules) {
    const { field, operator, value } = rule;
    
    // Map field to database column
    let dbField: string;
    let isOwnerField = false;
    
    switch (field) {
      case 'stageId':
        dbField = 'stage_id';
        break;
      case 'bedrooms':
        dbField = 'bedrooms';
        break;
      case 'bathrooms':
        dbField = 'bathrooms';
        break;
      case 'estimatedRevenue':
        // Skip - can't easily filter JSON in simple query
        continue;
      case 'city':
        dbField = 'city';
        break;
      case 'state':
        dbField = 'state';
        break;
      case 'address':
        dbField = 'address';
        break;
      case 'ownerName':
        dbField = 'name';
        isOwnerField = true;
        break;
      case 'tags':
        dbField = 'tags';
        break;
      default:
        // Custom fields - skip for server-side
        continue;
    }

    const filter = { field: dbField, op: operator, value: String(value) };
    
    if (isOwnerField) {
      ownerFilters.push(filter);
    } else {
      propertyFilters.push(filter);
    }
  }

  return { propertyFilters, ownerFilters, matchType };
};

export const useServerFilteredProperties = (
  rules: FilterRule[],
  matchType: 'and' | 'or',
  enabled: boolean = true
) => {
  const { company } = useAuth();
  const companyId = company?.id;

  const rulesKey = JSON.stringify(rules.map(r => ({ f: r.field, o: r.operator, v: r.value })));

  return useQuery<Property[], Error>({
    queryKey: ['filtered-properties', companyId, rulesKey, matchType],
    queryFn: async () => {
      if (!companyId || rules.length === 0) return [];

      const { propertyFilters, ownerFilters } = buildFilterParams(rules, matchType);

      // First handle owner filters if any
      let ownerPropertyIds: string[] | null = null;
      
      if (ownerFilters.length > 0) {
        // Check if we're looking for empty/null owner names
        const isNotSetFilter = ownerFilters.find(f => f.field === 'name' && f.op === 'is_not_set');
        const isSetFilter = ownerFilters.find(f => f.field === 'name' && f.op === 'is_set');
        
        if (isNotSetFilter) {
          // Query for owners with null OR empty name
          const { data: ownerData, error: ownerError } = await supabase
            .from('owners')
            .select('property_id')
            .eq('company_id', companyId)
            .or('name.is.null,name.eq.');
          
          if (ownerError) throw ownerError;
          ownerPropertyIds = (ownerData || []).map(o => o.property_id);
        } else if (isSetFilter) {
          // Query for owners with non-null AND non-empty name
          const { data: ownerData, error: ownerError } = await supabase
            .from('owners')
            .select('property_id')
            .eq('company_id', companyId)
            .not('name', 'is', null)
            .neq('name', '');
          
          if (ownerError) throw ownerError;
          ownerPropertyIds = (ownerData || []).map(o => o.property_id);
        } else {
          let ownerQuery = supabase
            .from('owners')
            .select('property_id')
            .eq('company_id', companyId);

          for (const filter of ownerFilters) {
            switch (filter.op) {
              case 'equals':
                ownerQuery = ownerQuery.ilike(filter.field, filter.value);
                break;
              case 'not_equals':
                ownerQuery = ownerQuery.not(filter.field, 'ilike', filter.value);
                break;
              case 'contains':
                ownerQuery = ownerQuery.ilike(filter.field, `%${filter.value}%`);
                break;
              case 'starts_with':
                ownerQuery = ownerQuery.ilike(filter.field, `${filter.value}%`);
                break;
            }
          }

          const { data: ownerData, error: ownerError } = await ownerQuery;
          if (ownerError) throw ownerError;
          ownerPropertyIds = (ownerData || []).map(o => o.property_id);
        }
        
        if (ownerPropertyIds.length === 0 && matchType === 'and') {
          return [];
        }
      }

      // Build base query - use range to override default 1000 row limit
      let query = supabase
        .from('properties')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .range(0, 9999);

      // Constrain to owner filter results if applicable
      if (ownerPropertyIds !== null && ownerPropertyIds.length > 0) {
        query = query.in('id', ownerPropertyIds);
      }

      // Apply property filters
      if (propertyFilters.length > 0) {
        if (matchType === 'or') {
          // Build OR condition string
          const orConditions = propertyFilters.map(f => {
            switch (f.op) {
              case 'equals':
                if (f.field === 'stage_id' && (f.value === '' || f.value === 'unassigned')) {
                  return `${f.field}.is.null`;
                }
                return `${f.field}.ilike.${f.value}`;
              case 'not_equals':
                if (f.field === 'stage_id' && (f.value === '' || f.value === 'unassigned')) {
                  return `${f.field}.not.is.null`;
                }
                return `${f.field}.not.ilike.${f.value}`;
              case 'contains':
                // Special handling for tags array field
                if (f.field === 'tags') {
                  return `tags.ov.{${f.value.trim()}}`;
                }
                return `${f.field}.ilike.%${f.value}%`;
              case 'starts_with':
                return `${f.field}.ilike.${f.value}%`;
              case 'gt':
                return `${f.field}.gt.${f.value}`;
              case 'lt':
                return `${f.field}.lt.${f.value}`;
              case 'is_set':
                return `${f.field}.not.is.null`;
              case 'is_not_set':
                return `${f.field}.is.null`;
              case 'any_of':
                if (f.field === 'tags') {
                  const tags = f.value.split(',').filter(t => t.trim());
                  return `tags.ov.{${tags.join(',')}}`;
                }
                return null;
              case 'not_any_of':
                // Can't easily do NOT overlap in OR
                return null;
              default:
                return null;
            }
          }).filter(Boolean);
          
          if (orConditions.length > 0) {
            query = query.or(orConditions.join(','));
          }
        } else {
          // Apply each filter with AND logic
          for (const f of propertyFilters) {
            switch (f.op) {
              case 'equals':
                if (f.field === 'stage_id' && (f.value === '' || f.value === 'unassigned')) {
                  query = query.is('stage_id', null);
                } else {
                  query = query.ilike(f.field, f.value);
                }
                break;
              case 'not_equals':
                if (f.field === 'stage_id' && (f.value === '' || f.value === 'unassigned')) {
                  query = query.not('stage_id', 'is', null);
                } else {
                  query = query.not(f.field, 'ilike', f.value);
                }
                break;
              case 'contains':
                // Special handling for tags array field
                if (f.field === 'tags') {
                  query = query.overlaps('tags', [f.value.trim()]);
                } else {
                  query = query.ilike(f.field, `%${f.value}%`);
                }
                break;
              case 'starts_with':
                query = query.ilike(f.field, `${f.value}%`);
                break;
              case 'gt':
                query = query.gt(f.field, parseFloat(f.value));
                break;
              case 'lt':
                query = query.lt(f.field, parseFloat(f.value));
                break;
              case 'is_set':
                query = query.not(f.field, 'is', null);
                break;
              case 'is_not_set':
                query = query.is(f.field, null);
                break;
              case 'any_of':
                if (f.field === 'tags') {
                  const tags = f.value.split(',').filter(t => t.trim());
                  if (tags.length > 0) {
                    query = query.overlaps('tags', tags);
                  }
                }
                break;
              case 'not_any_of':
                // For NOT overlaps, we need to filter client-side or use raw SQL
                // Skip for now - will be handled client-side
                break;
            }
          }
        }
      }

      const { data: properties, error: propError } = await query;
      if (propError) throw propError;
      if (!properties?.length) return [];

      const propertyIds = properties.map(p => p.id);

      // Batch fetch owners and activities to avoid URL length limits
      // Supabase .in() with 700+ UUIDs exceeds HTTP URL length limits
      const BATCH_SIZE = 100;
      const ownersByProp = new Map<string, DbOwner>();
      const activitiesByProp = new Map<string, DbActivity[]>();

      // Process in batches
      for (let i = 0; i < propertyIds.length; i += BATCH_SIZE) {
        const batch = propertyIds.slice(i, i + BATCH_SIZE);
        
        const [ownersRes, activitiesRes] = await Promise.all([
          supabase
            .from('owners')
            .select('*')
            .in('property_id', batch),
          supabase
            .from('activity_logs')
            .select('*')
            .in('property_id', batch)
            .order('date', { ascending: false }),
        ]);

        // Non-fatal errors - log but continue
        if (ownersRes.error) {
          console.warn('Owner batch fetch error:', ownersRes.error);
        } else {
          (ownersRes.data || []).forEach(o => {
            ownersByProp.set(o.property_id, o as unknown as DbOwner);
          });
        }

        if (activitiesRes.error) {
          console.warn('Activity batch fetch error:', activitiesRes.error);
        } else {
          (activitiesRes.data || []).forEach(a => {
            const list = activitiesByProp.get(a.property_id) || [];
            list.push(a as unknown as DbActivity);
            activitiesByProp.set(a.property_id, list);
          });
        }
      }

      return properties.map(p =>
        toProperty(
          p as unknown as DbProperty,
          ownersByProp.get(p.id) || null,
          activitiesByProp.get(p.id) || []
        )
      );
    },
    enabled: !!companyId && rules.length > 0 && enabled,
    staleTime: 30000,
  });
};
