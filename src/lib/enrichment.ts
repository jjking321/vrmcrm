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
  streetViewUrl?: string; // Google Street View URL that needs capture
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
  // Extended fields from listing endpoint
  listing_name?: string;
  cover_photo_url?: string;
  host_name?: string;
  superhost?: boolean;
  ttm_revpar?: number;
  l90d_revenue?: number;
  l90d_avg_rate?: number;
  l90d_occupancy?: number;
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

export async function captureStreetView(
  streetViewUrl: string, 
  propertyId: string
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  try {
    console.log('Capturing Street View for property:', propertyId);
    
    const { data, error } = await supabase.functions.invoke('capture-street-view', {
      body: { streetViewUrl, propertyId },
    });

    if (error) {
      console.error('Street View capture error:', error);
      return { success: false, error: error.message };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    if (data?.imageUrl) {
      return { success: true, imageUrl: data.imageUrl };
    }

    return { success: false, error: 'No image URL returned' };
  } catch (err) {
    console.error('Error capturing Street View:', err);
    return { success: false, error: 'Failed to capture Street View image' };
  }
}

export async function fetchAirbnbEstimate(property: Property): Promise<{ success: boolean; data?: AirROIData; error?: string }> {
  try {
    // If property has Airbnb listing ID, use the listing endpoint
    if (property.airbnbListingId) {
      console.log('Using listing endpoint for property:', property.id, 'listingId:', property.airbnbListingId);
      
      const { data, error } = await supabase.functions.invoke('enrich-airroi', {
        body: {
          airbnbListingId: property.airbnbListingId,
        },
      });

      if (error) {
        console.error('AirROI listing enrichment error:', error);
        return { success: false, error: error.message };
      }

      if (data?.error) {
        return { success: false, error: data.error };
      }

      return { success: true, data };
    }

    // Fallback: Validate that we have coordinates - required for calculator API
    if (!property.latitude || !property.longitude) {
      return { 
        success: false, 
        error: 'Property must have coordinates (latitude/longitude) or an Airbnb listing ID to fetch revenue estimates.' 
      };
    }

    console.log('Using calculator endpoint for property:', property.id);

    const { data, error } = await supabase.functions.invoke('enrich-airroi', {
      body: {
        lat: property.latitude,
        lng: property.longitude,
        bedrooms: property.bedrooms || 2,
        baths: property.bathrooms || 1,
        guests: property.guests || (property.bedrooms || 2) * 2, // Default: 2 guests per bedroom
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

// Batch enrichment for multiple properties
export async function fetchAirbnbEstimateBatch(
  properties: Property[],
  onProgress?: (progress: number) => void
): Promise<Map<string, { success: boolean; data?: AirROIData; error?: string }>> {
  const resultMap = new Map<string, { success: boolean; data?: AirROIData; error?: string }>();
  
  if (properties.length === 0) return resultMap;

  // Separate properties with and without listing IDs
  const withIds = properties.filter(p => p.airbnbListingId);
  const withoutIds = properties.filter(p => !p.airbnbListingId);
  
  let processed = 0;
  const total = properties.length;

  // Process properties with listing IDs via batch endpoint
  if (withIds.length > 0) {
    const listingIds = withIds.map(p => p.airbnbListingId!);
    const propertyIdToListingId = new Map(withIds.map(p => [p.airbnbListingId!, p.id]));
    
    console.log(`Batch fetching ${listingIds.length} listings via batch endpoint`);
    
    try {
      const { data, error } = await supabase.functions.invoke('enrich-airroi', {
        body: {
          airbnbListingIds: listingIds,
        },
      });

      if (error) {
        console.error('AirROI batch error:', error);
        withIds.forEach(p => {
          resultMap.set(p.id, { success: false, error: error.message });
        });
      } else if (data?.results) {
        // Map results back to property IDs
        withIds.forEach(p => {
          const listingResult = data.results[p.airbnbListingId!];
          if (listingResult && !listingResult.error) {
            resultMap.set(p.id, { success: true, data: listingResult });
          } else {
            resultMap.set(p.id, { 
              success: false, 
              error: listingResult?.error || 'No data returned for listing' 
            });
          }
        });
      } else {
        withIds.forEach(p => {
          resultMap.set(p.id, { success: false, error: 'No results in batch response' });
        });
      }
    } catch (err) {
      console.error('Batch enrichment error:', err);
      withIds.forEach(p => {
        resultMap.set(p.id, { success: false, error: 'Batch request failed' });
      });
    }
    
    processed += withIds.length;
    onProgress?.(Math.round((processed / total) * 100));
  }

  // Process properties without IDs via calculator (parallel with throttling)
  if (withoutIds.length > 0) {
    console.log(`Processing ${withoutIds.length} properties via calculator endpoint`);
    
    // Process in parallel batches of 10 to avoid overwhelming the API
    const PARALLEL_LIMIT = 10;
    for (let i = 0; i < withoutIds.length; i += PARALLEL_LIMIT) {
      const batch = withoutIds.slice(i, i + PARALLEL_LIMIT);
      
      const batchResults = await Promise.all(
        batch.map(async (property) => {
          const result = await fetchAirbnbEstimate(property);
          return { propertyId: property.id, result };
        })
      );
      
      batchResults.forEach(({ propertyId, result }) => {
        resultMap.set(propertyId, result);
      });
      
      processed += batch.length;
      onProgress?.(Math.round((processed / total) * 100));
    }
  }

  return resultMap;
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

export function applyZillowData(property: Property, zillowData: ZillowData): Partial<Property> & { streetViewUrl?: string } {
  const updates: Partial<Property> & { streetViewUrl?: string } = {};
  
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
  
  // Pass along streetViewUrl if no image was found (caller can capture it)
  if (!zillowData.image && zillowData.streetViewUrl) {
    updates.streetViewUrl = zillowData.streetViewUrl;
  }

  return updates;
}

// Helper function to apply Zillow data and capture Street View if needed
export async function applyZillowDataWithStreetView(
  property: Property, 
  zillowData: ZillowData
): Promise<Partial<Property>> {
  const updates = applyZillowData(property, zillowData);
  
  // If we have a streetViewUrl but no image, try to capture it
  if (updates.streetViewUrl && !updates.image) {
    console.log('No property image found, attempting to capture Street View...');
    const captureResult = await captureStreetView(updates.streetViewUrl, property.id);
    
    if (captureResult.success && captureResult.imageUrl) {
      updates.image = captureResult.imageUrl;
      console.log('Street View captured successfully:', captureResult.imageUrl);
    } else {
      console.warn('Failed to capture Street View:', captureResult.error);
    }
    
    // Remove streetViewUrl from updates since we handled it
    delete updates.streetViewUrl;
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
