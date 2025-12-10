import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { verifyAddressBatch, BatchAddressInput } from '@/lib/enrichment';

export interface UnverifiedProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude: number | null;
  longitude: number | null;
}

export function useUnverifiedAddresses() {
  const { company } = useAuth();

  return useQuery({
    queryKey: ['unverified-addresses', company?.id],
    queryFn: async () => {
      if (!company?.id) return { unverified: [], verified: 0, total: 0 };

      // Fetch all properties
      const { data, error } = await supabase
        .from('properties')
        .select('id, address, city, state, zip, latitude, longitude')
        .eq('company_id', company.id);

      if (error) throw error;

      const properties = data || [];
      const unverified: UnverifiedProperty[] = [];
      let verifiedCount = 0;

      for (const prop of properties) {
        // Properties with valid latitude AND longitude are considered verified
        if (prop.latitude !== null && prop.longitude !== null) {
          verifiedCount++;
        } else {
          unverified.push(prop);
        }
      }

      return {
        unverified,
        verified: verifiedCount,
        total: properties.length,
      };
    },
    enabled: !!company?.id,
  });
}

export function useBulkVerifyAddresses() {
  const { company } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (properties: UnverifiedProperty[]) => {
      if (!company?.id || properties.length === 0) return { verified: 0, failed: 0 };

      const toastId = toast.loading(`Verifying ${properties.length} addresses...`);

      // Build batch input
      const batchInput: BatchAddressInput[] = properties.map((prop, idx) => ({
        address: prop.address,
        city: prop.city,
        state: prop.state,
        zip: prop.zip,
        index: idx,
      }));

      // Call batch verification
      const results = await verifyAddressBatch(batchInput);

      // Check for quota errors first
      const firstResult = results.values().next().value;
      if (firstResult && !firstResult.success && firstResult.error?.includes('quota')) {
        toast.error(firstResult.error, { id: toastId });
        return { verified: 0, failed: properties.length, error: firstResult.error };
      }

      // Process results and update database
      let verified = 0;
      let failed = 0;
      const CHUNK_SIZE = 50;

      // Process updates in chunks
      const propertiesToUpdate: { id: string; latitude: number; longitude: number; address?: string; city?: string; state?: string; zip?: string }[] = [];

      for (let i = 0; i < properties.length; i++) {
        const result = results.get(i);
        if (result?.success && result.latitude && result.longitude) {
          propertiesToUpdate.push({
            id: properties[i].id,
            latitude: result.latitude,
            longitude: result.longitude,
            ...(result.standardized && {
              address: result.standardized.street,
              city: result.standardized.city,
              state: result.standardized.state,
              zip: result.standardized.zip,
            }),
          });
        } else {
          failed++;
        }
      }

      // Update in chunks
      for (let i = 0; i < propertiesToUpdate.length; i += CHUNK_SIZE) {
        const chunk = propertiesToUpdate.slice(i, i + CHUNK_SIZE);
        
        await Promise.all(
          chunk.map(async (update) => {
            const { error } = await supabase
              .from('properties')
              .update({
                latitude: update.latitude,
                longitude: update.longitude,
                ...(update.address && { address: update.address }),
                ...(update.city && { city: update.city }),
                ...(update.state && { state: update.state }),
                ...(update.zip && { zip: update.zip }),
              })
              .eq('id', update.id);

            if (!error) {
              verified++;
            } else {
              failed++;
            }
          })
        );

        toast.loading(`Verified ${Math.min(i + CHUNK_SIZE, propertiesToUpdate.length)} / ${propertiesToUpdate.length}...`, { id: toastId });
      }

      toast.success(`Verified ${verified} addresses${failed > 0 ? `, ${failed} failed` : ''}`, { id: toastId });
      return { verified, failed };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['unverified-addresses'] });
      queryClient.invalidateQueries({ queryKey: ['property-count'] });
    },
  });
}
