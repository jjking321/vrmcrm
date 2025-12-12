import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { normalizeOwnerName } from '@/lib/ownerUtils';

export interface OwnerNameVariation {
  normalizedKey: string;
  variations: { id: string; name: string; propertyId: string }[];
  suggestedName: string;
}

/**
 * Hook to find owner names with case variations (e.g., "John Smith" vs "JOHN SMITH")
 */
export const useOwnerNameVariations = () => {
  const { company } = useAuth();

  return useQuery({
    queryKey: ['owner-name-variations', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];

      // Fetch all owners
      let allOwners: { id: string; name: string; property_id: string }[] = [];
      let hasMore = true;
      let offset = 0;
      const batchSize = 1000;

      while (hasMore) {
        const { data, error } = await supabase
          .from('owners')
          .select('id, name, property_id')
          .eq('company_id', company.id)
          .range(offset, offset + batchSize - 1);

        if (error) throw error;
        if (data) allOwners = [...allOwners, ...data];
        hasMore = data?.length === batchSize;
        offset += batchSize;
      }

      // Group by normalized (lowercase) name
      const groupedByNormalized = new Map<string, { id: string; name: string; propertyId: string }[]>();
      
      for (const owner of allOwners) {
        if (!owner.name?.trim()) continue;
        
        const normalizedKey = owner.name.toLowerCase().trim();
        const existing = groupedByNormalized.get(normalizedKey) || [];
        existing.push({ 
          id: owner.id, 
          name: owner.name, 
          propertyId: owner.property_id 
        });
        groupedByNormalized.set(normalizedKey, existing);
      }

      // Find groups with multiple case variations
      const variationGroups: OwnerNameVariation[] = [];
      
      for (const [normalizedKey, owners] of groupedByNormalized.entries()) {
        // Get unique name variations
        const uniqueVariations = new Set(owners.map(o => o.name));
        
        if (uniqueVariations.size > 1 || !isProperlyFormatted(owners[0].name)) {
          // Multiple variations exist OR single variation that needs normalization
          const suggestedName = normalizeOwnerName(normalizedKey);
          
          // Only include if at least one variation differs from suggested
          const needsFixing = owners.some(o => o.name !== suggestedName);
          
          if (needsFixing) {
            variationGroups.push({
              normalizedKey,
              variations: owners,
              suggestedName,
            });
          }
        }
      }

      // Sort by number of affected records (most first)
      return variationGroups.sort((a, b) => b.variations.length - a.variations.length);
    },
    enabled: !!company?.id,
  });
};

/**
 * Check if a name is properly formatted (Title Case)
 */
function isProperlyFormatted(name: string): boolean {
  if (!name) return false;
  const hasUpper = /[A-Z]/.test(name);
  const hasLower = /[a-z]/.test(name);
  return hasUpper && hasLower;
}

/**
 * Hook to normalize owner names in the database
 */
export const useNormalizeOwnerNames = () => {
  const queryClient = useQueryClient();
  const { company } = useAuth();

  return useMutation({
    mutationFn: async (variations: OwnerNameVariation[]) => {
      if (!company?.id) throw new Error('No company');

      let updatedCount = 0;
      const batchSize = 50;

      // Flatten all owner IDs and their normalized names
      const updates: { id: string; normalizedName: string }[] = [];
      
      for (const group of variations) {
        for (const owner of group.variations) {
          if (owner.name !== group.suggestedName) {
            updates.push({ id: owner.id, normalizedName: group.suggestedName });
          }
        }
      }

      // Process in batches
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async ({ id, normalizedName }) => {
            const { error } = await supabase
              .from('owners')
              .update({ name: normalizedName })
              .eq('id', id);
            
            if (!error) updatedCount++;
          })
        );
      }

      return updatedCount;
    },
    onSuccess: (count) => {
      toast.success(`Normalized ${count} owner names to Title Case`);
      queryClient.invalidateQueries({ queryKey: ['owner-name-variations'] });
      queryClient.invalidateQueries({ queryKey: ['all-owners'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to normalize owner names: ${error.message}`);
    },
  });
};

/**
 * Hook to normalize a single owner name group
 */
export const useNormalizeSingleGroup = () => {
  const queryClient = useQueryClient();
  const { company } = useAuth();

  return useMutation({
    mutationFn: async ({ group, customName }: { group: OwnerNameVariation; customName?: string }) => {
      if (!company?.id) throw new Error('No company');

      const targetName = customName || group.suggestedName;
      let updatedCount = 0;

      for (const owner of group.variations) {
        if (owner.name !== targetName) {
          const { error } = await supabase
            .from('owners')
            .update({ name: targetName })
            .eq('id', owner.id);
          
          if (!error) updatedCount++;
        }
      }

      return updatedCount;
    },
    onSuccess: (count) => {
      toast.success(`Normalized ${count} owner records`);
      queryClient.invalidateQueries({ queryKey: ['owner-name-variations'] });
      queryClient.invalidateQueries({ queryKey: ['all-owners'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to normalize: ${error.message}`);
    },
  });
};
