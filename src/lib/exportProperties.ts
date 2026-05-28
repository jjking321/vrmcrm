import { Property, PipelineStage, FieldDefinition } from '@/types';
import { getPrimaryOwnerName, formatMailingAddress } from '@/lib/ownerUtils';

const escapeCsv = (val: unknown): string => {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

const getColumnLabel = (colId: string, fields: FieldDefinition[]): string => {
  const field = fields.find(f => f.id === colId || (f as any).fieldKey === colId);
  if (field) return field.label;
  if (colId === 'estimatedRevenue') return 'Est. Revenue';
  if (colId === 'ownerName') return 'Owner';
  if (colId === 'mailingAddress') return 'Mailing Address';
  return colId.charAt(0).toUpperCase() + colId.slice(1);
};

const getCellValue = (
  property: Property,
  colId: string,
  stages: PipelineStage[]
): string => {
  switch (colId) {
    case 'address':
      return property.address || '';
    case 'stageId': {
      const stage = stages.find(s => s.id === property.stageId);
      return stage?.name || '';
    }
    case 'estimatedRevenue':
      return String(property.marketData?.projectedRevenue ?? 0);
    case 'tags':
      return (property.tags || [])
        .filter(t => !t.startsWith('list-'))
        .join('; ');
    case 'ownerName': {
      const primary = getPrimaryOwnerName(property.owner);
      const owners = property.owner?.owners || [];
      const names = [primary];
      for (let i = 1; i < owners.length; i++) {
        const o = owners[i];
        const n = `${o.firstName || ''} ${o.lastName || ''}`.trim();
        if (n) names.push(n);
      }
      const phones = (property.owner?.phones || []).map(p => p.number).filter(Boolean);
      const emails = (property.owner?.emails || []).map(e => e.address).filter(Boolean);
      const parts = [names.join(' & ')];
      if (phones.length) parts.push(phones.join('; '));
      if (emails.length) parts.push(emails.join('; '));
      return parts.join(' | ');
    }
    case 'mailingAddress':
      return formatMailingAddress(property.owner) || '';
    default: {
      const value = (property as any)[colId] ?? property.customFields?.[colId];
      if (value === null || value === undefined) return '';
      if (Array.isArray(value)) return value.join('; ');
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    }
  }
};

export function exportPropertiesToCsv(
  properties: Property[],
  visibleColumns: string[],
  fields: FieldDefinition[],
  stages: PipelineStage[]
): void {
  const header = visibleColumns.map(c => escapeCsv(getColumnLabel(c, fields))).join(',');
  const rows = properties.map(p =>
    visibleColumns.map(c => escapeCsv(getCellValue(p, c, stages))).join(',')
  );
  const csv = [header, ...rows].join('\n');

  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `properties-${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}