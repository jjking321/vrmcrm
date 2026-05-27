import { useState, useMemo, useCallback } from 'react';
import { MailingListItem, FilterRule, FilterOperator } from '@/types';
import { deriveMailingFields } from '@/lib/mailingAddress';
import { getBestMailingName } from '@/lib/ownerUtils';
import { useBadDataIndex } from './useBadContactData';
import { useOptOutIndex } from './useMarketingOptOuts';
import { normalizeAddressForMatch } from '@/lib/exclusionUtils';

export interface DerivedMailingItem {
  item: MailingListItem;
  contactName: string;
  mailingAddress: string;
  mailingCity: string;
  mailingState: string;
  mailingZip: string;
  propertyAddress: string;
  isCanadian: boolean;
  ownerId?: string;
}

/**
 * Hook for filtering and searching mailing list items
 */
export function useMailingListFiltering(items: MailingListItem[]) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRules, setFilterRules] = useState<FilterRule[]>([]);
  const [matchType, setMatchType] = useState<'and' | 'or'>('and');
  const [excludeBadAddresses, setExcludeBadAddresses] = useState(true);
  const badData = useBadDataIndex();
  const optOuts = useOptOutIndex();

  // Derive mailing fields for each item once
  const derivedItems = useMemo((): DerivedMailingItem[] => {
    return items
      .filter(item => item.property)
      .map(item => {
        const property = item.property!;
        const owner = property.owner;
        const derived = deriveMailingFields(owner, property);
        const contactName = getBestMailingName(owner);
        const propertyAddress = `${property.address}, ${property.city}, ${property.state} ${property.zip}`;

        return {
          item,
          contactName,
          mailingAddress: derived.mailingAddress,
          mailingCity: derived.mailingCity,
          mailingState: derived.mailingState,
          mailingZip: derived.mailingZip,
          propertyAddress,
          isCanadian: derived.isCanadian,
          ownerId: (item as any).ownerId,
        };
      });
  }, [items]);

  // Auto-exclude addresses flagged as bad (returned-to-sender, etc.)
  const badExcludedItems = useMemo(() => {
    if (!excludeBadAddresses || (badData.addresses.size === 0 && optOuts.mail.size === 0)) return derivedItems;
    return derivedItems.filter(d => {
      const norm = normalizeAddressForMatch(d.mailingAddress, d.mailingCity, d.mailingState);
      return !badData.addresses.has(norm) && !optOuts.mail.has(norm);
    });
  }, [derivedItems, badData.addresses, optOuts.mail, excludeBadAddresses]);
  const badExcludedCount = derivedItems.length - badExcludedItems.length;

  // Apply search filter
  const searchFiltered = useMemo(() => {
    if (!searchTerm.trim()) return badExcludedItems;

    const term = searchTerm.toLowerCase().trim();
    return badExcludedItems.filter(d => {
      return (
        d.contactName.toLowerCase().includes(term) ||
        d.mailingAddress.toLowerCase().includes(term) ||
        d.mailingCity.toLowerCase().includes(term) ||
        d.mailingState.toLowerCase().includes(term) ||
        d.mailingZip.toLowerCase().includes(term) ||
        d.propertyAddress.toLowerCase().includes(term)
      );
    });
  }, [badExcludedItems, searchTerm]);

  // Apply filter rules
  const filteredItems = useMemo(() => {
    if (filterRules.length === 0) return searchFiltered;

    return searchFiltered.filter(d => {
      const results = filterRules.map(rule => evaluateRule(d, rule));
      return matchType === 'and' 
        ? results.every(Boolean) 
        : results.some(Boolean);
    });
  }, [searchFiltered, filterRules, matchType]);

  // Add a new filter rule
  const addFilterRule = useCallback(() => {
    const newRule: FilterRule = {
      id: crypto.randomUUID(),
      field: 'state',
      operator: 'equals',
      value: '',
    };
    setFilterRules(prev => [...prev, newRule]);
  }, []);

  // Update a filter rule
  const updateFilterRule = useCallback((updatedRule: FilterRule) => {
    setFilterRules(prev => 
      prev.map(r => r.id === updatedRule.id ? updatedRule : r)
    );
  }, []);

  // Remove a filter rule
  const removeFilterRule = useCallback((ruleId: string) => {
    setFilterRules(prev => prev.filter(r => r.id !== ruleId));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setFilterRules([]);
  }, []);

  const hasActiveFilters = searchTerm.trim() !== '' || filterRules.length > 0;

  return {
    searchTerm,
    setSearchTerm,
    filterRules,
    setFilterRules,
    matchType,
    setMatchType,
    filteredItems,
    totalCount: derivedItems.length,
    filteredCount: filteredItems.length,
    addFilterRule,
    updateFilterRule,
    removeFilterRule,
    clearFilters,
    hasActiveFilters,
    excludeBadAddresses,
    setExcludeBadAddresses,
    badExcludedCount,
  };
}

/**
 * Evaluate a single filter rule against a derived mailing item
 */
function evaluateRule(item: DerivedMailingItem, rule: FilterRule): boolean {
  const { field, operator, value } = rule;

  // Get the field value
  let fieldValue: string | boolean = '';
  switch (field) {
    case 'state':
      fieldValue = item.mailingState;
      break;
    case 'city':
      fieldValue = item.mailingCity;
      break;
    case 'zip':
      fieldValue = item.mailingZip;
      break;
    case 'contactName':
      fieldValue = item.contactName;
      break;
    case 'isCanadian':
      fieldValue = item.isCanadian;
      break;
    default:
      return true;
  }

  // For boolean fields
  if (field === 'isCanadian') {
    const boolValue = fieldValue as boolean;
    if (operator === 'is_true') return boolValue === true;
    if (operator === 'is_false') return boolValue === false;
    return true;
  }

  // For string fields
  const strValue = (fieldValue as string).toLowerCase();
  const compareValue = String(value).toLowerCase();

  switch (operator) {
    case 'equals':
      return strValue === compareValue;
    case 'not_equals':
      return strValue !== compareValue;
    case 'contains':
      return strValue.includes(compareValue);
    case 'starts_with':
      return strValue.startsWith(compareValue);
    case 'is_set':
      return strValue.length > 0;
    case 'is_not_set':
      return strValue.length === 0;
    case 'any_of':
      const anyOfValues = compareValue.split(',').map(v => v.trim());
      return anyOfValues.some(v => strValue === v);
    case 'not_any_of':
      const notAnyOfValues = compareValue.split(',').map(v => v.trim());
      return !notAnyOfValues.some(v => strValue === v);
    default:
      return true;
  }
}
