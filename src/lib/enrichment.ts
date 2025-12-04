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
