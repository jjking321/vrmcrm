import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FieldDefinition, CustomFieldType } from '@/types';
import { toast } from 'sonner';
import { SYSTEM_FIELDS } from '@/data/mockData';

interface DbFieldDefinition {
  id: string;
  company_id: string;
  field_key: string;
  label: string;
  type: string;
  options: string[] | null;
  is_system: boolean;
  is_hidden: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Transform DB row to FieldDefinition
const transformField = (row: DbFieldDefinition): FieldDefinition & { isHidden: boolean; fieldKey: string } => ({
  id: row.id,
  label: row.label,
  type: row.type as CustomFieldType,
  options: row.options || undefined,
  isSystem: row.is_system,
  isHidden: row.is_hidden,
  fieldKey: row.field_key,
});

export function useFieldDefinitions() {
  const { company } = useAuth();
  const companyId = company?.id;

  return useQuery({
    queryKey: ['field-definitions', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('field_definitions')
        .select('*')
        .eq('company_id', companyId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return (data || []).map(transformField);
    },
    enabled: !!companyId,
  });
}

export function useInitializeFieldDefinitions() {
  const { company } = useAuth();
  const companyId = company?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company');

      // Get existing field definitions
      const { data: existing } = await supabase
        .from('field_definitions')
        .select('field_key')
        .eq('company_id', companyId);

      const existingKeys = new Set((existing || []).map(f => f.field_key));

      // Find missing system fields
      const missingFields = SYSTEM_FIELDS.filter(field => !existingKeys.has(field.id));

      if (missingFields.length === 0) {
        return; // All fields present
      }

      // Get max sort_order for new fields
      const startOrder = existingKeys.size;

      // Insert missing system fields
      const fieldsToInsert = missingFields.map((field, index) => ({
        company_id: companyId,
        field_key: field.id,
        label: field.label,
        type: field.type,
        options: field.options || null,
        is_system: true,
        is_hidden: false,
        sort_order: startOrder + index,
      }));

      const { error } = await supabase
        .from('field_definitions')
        .insert(fieldsToInsert);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-definitions', companyId] });
    },
  });
}

export function useAddFieldDefinition() {
  const { company } = useAuth();
  const companyId = company?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (field: { label: string; type: CustomFieldType; options?: string[] }) => {
      if (!companyId) throw new Error('No company');

      const fieldKey = `custom_${Date.now()}`;

      const { error } = await supabase
        .from('field_definitions')
        .insert({
          company_id: companyId,
          field_key: fieldKey,
          label: field.label,
          type: field.type,
          options: field.options || null,
          is_system: false,
          is_hidden: false,
          sort_order: 1000, // New fields go at the end
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-definitions', companyId] });
      toast.success('Field added');
    },
    onError: (error) => {
      toast.error('Failed to add field');
      console.error(error);
    },
  });
}

export function useUpdateFieldDefinition() {
  const { company } = useAuth();
  const companyId = company?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { label?: string; is_hidden?: boolean; sort_order?: number } }) => {
      if (!companyId) throw new Error('No company');

      const { error } = await supabase
        .from('field_definitions')
        .update(updates)
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-definitions', companyId] });
    },
    onError: (error) => {
      toast.error('Failed to update field');
      console.error(error);
    },
  });
}

export function useDeleteFieldDefinition() {
  const { company } = useAuth();
  const companyId = company?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!companyId) throw new Error('No company');

      const { error } = await supabase
        .from('field_definitions')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-definitions', companyId] });
      toast.success('Field deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete field');
      console.error(error);
    },
  });
}
