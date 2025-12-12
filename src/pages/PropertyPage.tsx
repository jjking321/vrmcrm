import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import PropertyDetail from '@/components/crm/PropertyDetail';
import { Property, Owner, PipelineStage, FieldDefinition } from '@/types';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Login } from '@/components/crm/Login';
import { usePipelineStages } from '@/hooks/usePipelineStages';
import { useFieldDefinitions } from '@/hooks/useFieldDefinitions';
import { toast } from 'sonner';

const PropertyPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading, company } = useAuth();
  const { data: stages = [] } = usePipelineStages();
  const { data: fields = [] } = useFieldDefinitions();

  const { data: property, isLoading, error } = useQuery({
    queryKey: ['property', id],
    queryFn: async () => {
      if (!id) throw new Error('No property ID');
      
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) throw new Error('Property not found');
      
      // Fetch owner
      const { data: ownerData } = await supabase
        .from('owners')
        .select('*')
        .eq('property_id', id)
        .maybeSingle();
      
      const owner: Owner = ownerData ? {
        name: ownerData.name,
        email: ownerData.email || '',
        phone: ownerData.phone || '',
        mailingAddress: ownerData.mailing_address || undefined,
        mailingCity: ownerData.mailing_city || undefined,
        mailingState: ownerData.mailing_state || undefined,
        mailingZip: ownerData.mailing_zip || undefined,
        ownerType: ownerData.owner_type || undefined,
        ownershipLengthMonths: ownerData.ownership_length_months || undefined,
        ownerOccupied: ownerData.owner_occupied || undefined,
        litigator: ownerData.litigator || false,
        phones: (ownerData.phones as any[]) || [],
        emails: (ownerData.emails as any[]) || [],
        owners: (ownerData.owners as any[]) || [],
        notes: ownerData.notes || undefined,
      } : {
        name: '',
        email: '',
        phone: '',
      };
      
      const property: Property = {
        id: data.id,
        companyId: data.company_id,
        address: data.address,
        city: data.city,
        state: data.state,
        zip: data.zip,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        guests: data.guests || undefined,
        squareFeet: data.square_feet || undefined,
        yearBuilt: data.year_built || undefined,
        propertyType: data.property_type || undefined,
        image: data.image || '',
        stageId: data.stage_id || '',
        tags: data.tags || [],
        airbnbUrl: data.airbnb_url || undefined,
        zillowUrl: data.zillow_url || undefined,
        propertyUrl: data.property_url || undefined,
        bookingLink: data.booking_link || undefined,
        listingTitle: data.listing_title || undefined,
        roomType: data.room_type || undefined,
        propertyManager: data.property_manager || undefined,
        host: data.host || undefined,
        latitude: data.latitude || undefined,
        longitude: data.longitude || undefined,
        marketData: (data.market_data as any) || {},
        customFields: (data.custom_fields as any) || {},
        owner,
        activities: [],
      };
      
      return property;
    },
    enabled: isAuthenticated && !!id,
  });

  const updatePropertyMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Property> }) => {
      const { error } = await supabase
        .from('properties')
        .update({
          address: updates.address,
          city: updates.city,
          state: updates.state,
          zip: updates.zip,
          bedrooms: updates.bedrooms,
          bathrooms: updates.bathrooms,
          guests: updates.guests,
          square_feet: updates.squareFeet,
          year_built: updates.yearBuilt,
          property_type: updates.propertyType,
          image: updates.image,
          stage_id: updates.stageId || null,
          tags: updates.tags,
          airbnb_url: updates.airbnbUrl,
          zillow_url: updates.zillowUrl,
          property_url: updates.propertyUrl,
          booking_link: updates.bookingLink,
          market_data: updates.marketData as any,
          custom_fields: updates.customFields as any,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property', id] });
      toast.success('Property updated');
    },
    onError: () => {
      toast.error('Failed to update property');
    },
  });

  const handleUpdateProperty = (propertyId: string, updates: Partial<Property>) => {
    updatePropertyMutation.mutate({ id: propertyId, updates });
  };

  const handleDeleteProperty = async (propertyId: string) => {
    const { error } = await supabase.from('properties').delete().eq('id', propertyId);
    if (error) {
      toast.error('Failed to delete property');
    } else {
      toast.success('Property deleted');
      navigate('/');
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <p className="text-destructive mb-4">Property not found</p>
        <button 
          onClick={() => navigate('/')}
          className="text-primary hover:underline"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <PropertyDetail
        property={property}
        stages={stages}
        fields={fields}
        onBack={() => navigate('/')}
        onUpdateProperty={handleUpdateProperty}
        onDeleteProperty={handleDeleteProperty}
      />
    </div>
  );
};

export default PropertyPage;
