import { useMemo, useCallback } from 'react';
import { Property, FilterRule, SortConfig } from '@/types';
import { usePersistedState } from './usePersistedState';

export const usePropertyFiltering = (
  allProperties: Property[], 
  searchResults?: Property[] | null, 
  debouncedSearchTerm?: string
) => {
  // Persisted state using sessionStorage
  const [filterRules, setFilterRules] = usePersistedState<FilterRule[]>('crm-filter-rules', []);
  const [matchType, setMatchType] = usePersistedState<'and' | 'or'>('crm-match-type', 'and');
  const [sortConfig, setSortConfig] = usePersistedState<SortConfig>('crm-sort-config', { field: 'address', direction: 'asc' });
  const [deduplicateByOwner, setDeduplicateByOwner] = usePersistedState<boolean>('crm-deduplicate', false);

  // Determine which properties to use as base
  // When searching with 2+ chars and have results, use search results from DB
  // Otherwise use loaded properties
  const baseProperties = useMemo(() => {
    if (debouncedSearchTerm && debouncedSearchTerm.length >= 2 && searchResults) {
      return searchResults;
    }
    return allProperties;
  }, [debouncedSearchTerm, searchResults, allProperties]);

  // Apply filter rules to a property
  const applyFilterRules = useCallback((property: Property, rules: FilterRule[], match: 'and' | 'or'): boolean => {
    if (rules.length === 0) return true;

    const evaluateRule = (rule: FilterRule): boolean => {
      let value: any;

      switch (rule.field) {
        case 'stageId':
          value = property.stageId;
          break;
        case 'bedrooms':
          value = property.bedrooms;
          break;
        case 'bathrooms':
          value = property.bathrooms;
          break;
        case 'estimatedRevenue':
          value = property.marketData.projectedRevenue || 0;
          break;
        case 'city':
          value = property.city;
          break;
        case 'state':
          value = property.state;
          break;
        case 'ownerName':
          value = property.owner.name;
          break;
        case 'tags':
          value = property.tags.join(' ');
          break;
        case 'address':
          value = property.address;
          break;
        case 'host':
          value = property.host || '';
          break;
        default:
          value = property.customFields?.[rule.field] ?? '';
      }

      switch (rule.operator) {
        case 'equals':
          return String(value).toLowerCase() === String(rule.value).toLowerCase();
        case 'not_equals':
          return String(value).toLowerCase() !== String(rule.value).toLowerCase();
        case 'contains':
          return String(value).toLowerCase().includes(String(rule.value).toLowerCase());
        case 'starts_with':
          return String(value).toLowerCase().startsWith(String(rule.value).toLowerCase());
        case 'gt':
          return Number(value) > Number(rule.value);
        case 'lt':
          return Number(value) < Number(rule.value);
        case 'any_of': {
          // For tags, check if any selected tag is in the property's tags
          const selectedTags = String(rule.value).split(',').filter(t => t.trim()).map(t => t.toLowerCase());
          if (rule.field === 'tags') {
            const propertyTags = property.tags.map(t => t.toLowerCase());
            return selectedTags.some(tag => propertyTags.includes(tag));
          }
          return selectedTags.includes(String(value).toLowerCase());
        }
        case 'not_any_of': {
          // For tags, check if none of the selected tags are in the property's tags
          const selectedTags = String(rule.value).split(',').filter(t => t.trim()).map(t => t.toLowerCase());
          if (rule.field === 'tags') {
            const propertyTags = property.tags.map(t => t.toLowerCase());
            return !selectedTags.some(tag => propertyTags.includes(tag));
          }
          return !selectedTags.includes(String(value).toLowerCase());
        }
        case 'is_set':
          return value !== undefined && value !== null && value !== '';
        case 'is_not_set':
          return value === undefined || value === null || value === '';
        default:
          return true;
      }
    };

    if (match === 'and') {
      return rules.every(evaluateRule);
    } else {
      return rules.some(evaluateRule);
    }
  }, []);

  // Filtered properties
  const filteredProperties = useMemo(() => {
    let result = baseProperties;

    // Filter rules only (no client-side search - that's handled by server)
    result = result.filter(p => applyFilterRules(p, filterRules, matchType));

    if (deduplicateByOwner) {
      const seen = new Set<string>();
      result = result.filter(p => {
        if (seen.has(p.owner.name)) return false;
        seen.add(p.owner.name);
        return true;
      });
    }

    return result;
  }, [baseProperties, filterRules, matchType, deduplicateByOwner, applyFilterRules]);

  // Sorted properties
  const sortedProperties = useMemo(() => {
    return [...filteredProperties].sort((a, b) => {
      const { field, direction } = sortConfig;
      let aVal: any, bVal: any;

      if (field === 'estimatedRevenue') {
        aVal = a.marketData.projectedRevenue || 0;
        bVal = b.marketData.projectedRevenue || 0;
      } else if (field === 'ownerName') {
        aVal = a.owner.name;
        bVal = b.owner.name;
      } else {
        aVal = (a as any)[field];
        bVal = (b as any)[field];
      }

      if (typeof aVal === 'string') {
        return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [filteredProperties, sortConfig]);

  // Sort handler
  const handleSort = useCallback((field: string) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  return {
    // State & setters
    filterRules,
    setFilterRules,
    matchType,
    setMatchType,
    sortConfig,
    handleSort,
    deduplicateByOwner,
    setDeduplicateByOwner,
    // Computed
    filteredProperties,
    sortedProperties,
    isServerSearch: debouncedSearchTerm ? debouncedSearchTerm.length >= 2 : false,
  };
};
