import { supabase } from '@/integrations/supabase/client';
import { Property, MarketData } from '@/types';

export interface ZillowData {
  zpid?: string;
  zestimate?: number;
  rentZestimate?: number;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  livingArea?: number;
  yearBuilt?: number;
  lotSize?: number;
  propertyType?: string;
  image?: string;
  zillowUrl?: string;
  lastSoldPrice?: number;
  lastSoldDate?: string;
  taxAssessedValue?: number;
}

export interface AirROIData {
  average_daily_rate: number;
  occupancy: number;
  estimated_annual_revenue: number;
  monthly_revenue_distributions?: number[];
  airbnb_rating?: number;
  review_count?: number;
  data_source: string;
}

export interface AddressVerification {
  isValid: boolean;
  accuracy?: number;
  formattedAddress?: string;
  standardized?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    county?: string;
  };
  latitude?: number;
  longitude?: number;
  message: string;
}

export async function fetchZillowData(property: Property): Promise<{ success: boolean; data?: ZillowData; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('enrich-zillow', {
      body: {
        address: property.address,
        city: property.city,
        state: property.state,
        zip: property.zip,
      },
    });

    if (error) {
      console.error('Zillow enrichment error:', error);
      return { success: false, error: error.message };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return { success: true, data };
  } catch (err) {
    console.error('Error fetching Zillow data:', err);
    return { success: false, error: 'Failed to fetch Zillow data' };
  }
}

export async function fetchAirbnbEstimate(property: Property): Promise<{ success: boolean; data?: AirROIData; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('enrich-airroi', {
      body: {
        address: property.address,
        city: property.city,
        state: property.state,
        zip: property.zip,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
      },
    });

    if (error) {
      console.error('AirROI enrichment error:', error);
      return { success: false, error: error.message };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return { success: true, data };
  } catch (err) {
    console.error('Error fetching AirROI data:', err);
    return { success: false, error: 'Failed to fetch revenue estimates' };
  }
}

export async function verifyAddress(
  address: string,
  city: string,
  state: string,
  zip: string
): Promise<{ success: boolean; data?: AddressVerification; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('verify-address', {
      body: { address, city, state, zip },
    });

    if (error) {
      console.error('Address verification error:', error);
      return { success: false, error: error.message };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return { success: true, data };
  } catch (err) {
    console.error('Error verifying address:', err);
    return { success: false, error: 'Failed to verify address' };
  }
}

export interface BatchAddressInput {
  address: string;
  city: string;
  state: string;
  zip: string;
  index: number;
}

export interface BatchAddressResult {
  index: number;
  success: boolean;
  standardized?: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  error?: string;
}

const BATCH_CHUNK_SIZE = 1000; // Geocodio supports 10k but we chunk for reliability

export async function verifyAddressBatch(
  addresses: BatchAddressInput[]
): Promise<Map<number, BatchAddressResult>> {
  const resultMap = new Map<number, BatchAddressResult>();
  
  if (addresses.length === 0) return resultMap;

  // Process in chunks to avoid timeout issues
  const chunks: BatchAddressInput[][] = [];
  for (let i = 0; i < addresses.length; i += BATCH_CHUNK_SIZE) {
    chunks.push(addresses.slice(i, i + BATCH_CHUNK_SIZE));
  }

  console.log(`Batch verifying ${addresses.length} addresses in ${chunks.length} chunk(s)`);

  for (const chunk of chunks) {
    try {
      const { data, error } = await supabase.functions.invoke('verify-address-batch', {
        body: { addresses: chunk },
      });

      if (error) {
        console.error('Batch address verification error:', error);
        
        // Check for quota exceeded or similar known errors
        let userMessage = error.message || 'Address verification failed';
        if (error.message?.includes('exceeded the free tier')) {
          userMessage = 'Address verification quota exceeded. Please disable address standardization or upgrade your Geocodio API plan.';
        } else if (error.message?.includes('QUOTA_EXCEEDED')) {
          userMessage = 'Address verification quota exceeded. Please disable address standardization or upgrade your Geocodio API plan.';
        }
        
        // Mark all addresses in this chunk as failed
        chunk.forEach(addr => {
          resultMap.set(addr.index, {
            index: addr.index,
            success: false,
            error: userMessage,
          });
        });
        continue;
      }

      // Check for error in response data (edge function returned error in body)
      if (data?.error) {
        console.error('Batch address verification returned error:', data.error);
        
        let userMessage = data.error;
        if (data.code === 'QUOTA_EXCEEDED' || data.error.includes('exceeded the free tier')) {
          userMessage = 'Address verification quota exceeded. Please disable address standardization or upgrade your Geocodio API plan.';
        }
        
        chunk.forEach(addr => {
          resultMap.set(addr.index, {
            index: addr.index,
            success: false,
            error: userMessage,
          });
        });
        continue;
      }

      if (data?.results && Array.isArray(data.results)) {
        data.results.forEach((result: BatchAddressResult) => {
          resultMap.set(result.index, result);
        });
      }
    } catch (err) {
      console.error('Error in batch verification chunk:', err);
      chunk.forEach(addr => {
        resultMap.set(addr.index, {
          index: addr.index,
          success: false,
          error: 'Batch verification failed',
        });
      });
    }
  }

  return resultMap;
}

export function applyZillowData(property: Property, zillowData: ZillowData): Partial<Property> {
  const updates: Partial<Property> = {};
  
  if (zillowData.bedrooms && zillowData.bedrooms > 0) {
    updates.bedrooms = zillowData.bedrooms;
  }
  if (zillowData.bathrooms && zillowData.bathrooms > 0) {
    updates.bathrooms = zillowData.bathrooms;
  }
  if (zillowData.livingArea) {
    updates.squareFeet = zillowData.livingArea;
  }
  if (zillowData.yearBuilt) {
    updates.yearBuilt = zillowData.yearBuilt;
  }
  if (zillowData.lotSize) {
    updates.lotSize = zillowData.lotSize;
  }
  if (zillowData.propertyType) {
    updates.propertyType = zillowData.propertyType;
  }
  if (zillowData.image) {
    updates.image = zillowData.image;
  }
  if (zillowData.zillowUrl) {
    updates.zillowUrl = zillowData.zillowUrl;
  }
  if (zillowData.zestimate) {
    updates.marketData = {
      ...property.marketData,
      propertyValue: zillowData.zestimate,
    };
  }

  return updates;
}

export function applyAirROIData(property: Property, airroiData: AirROIData): Partial<Property> {
  const updates: Partial<Property> = {
    marketData: {
      ...property.marketData,
      adr: Math.round(airroiData.average_daily_rate),
      occupancyRate: Math.round(airroiData.occupancy * 100),
      projectedRevenue: Math.round(airroiData.estimated_annual_revenue),
      monthlyRevenueDistribution: airroiData.monthly_revenue_distributions,
      airbnbRating: airroiData.airbnb_rating,
      reviewCount: airroiData.review_count,
    },
  };

  return updates;
}
