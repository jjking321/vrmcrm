import { Property, PipelineStage, FieldDefinition } from '@/types';
import { getPrimaryOwnerName } from '@/lib/ownerUtils';

const escapeCsv = (val: unknown): string => {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

const MAX_OWNERS = 4;
const MAX_PHONES = 4;
const MAX_EMAILS = 4;

type ExportColumn = {
  header: string;
  get: (p: Property) => unknown;
};

const getColumnLabel = (colId: string, fields: FieldDefinition[]): string => {
  const field = fields.find(f => f.id === colId || (f as any).fieldKey === colId);
  if (field) return field.label;
  if (colId === 'estimatedRevenue') return 'Est. Revenue';
  if (colId === 'ownerName') return 'Owner';
  if (colId === 'mailingAddress') return 'Mailing Address';
  return colId.charAt(0).toUpperCase() + colId.slice(1);
};

const expandColumn = (
  colId: string,
  fields: FieldDefinition[],
  stages: PipelineStage[]
): ExportColumn[] => {
  switch (colId) {
    case 'address':
      return [{ header: 'Address', get: p => p.address || '' }];
    case 'stageId':
      return [{
        header: 'Stage',
        get: p => stages.find(s => s.id === p.stageId)?.name || '',
      }];
    case 'estimatedRevenue':
      return [{
        header: 'Est. Revenue',
        get: p => p.marketData?.projectedRevenue ?? 0,
      }];
    case 'tags':
      return [{
        header: 'Tags',
        get: p => (p.tags || []).filter(t => !t.startsWith('list-')).join('; '),
      }];
    case 'ownerName': {
      const cols: ExportColumn[] = [];
      // Primary owner name (normalized)
      cols.push({
        header: 'Owner 1 Name',
        get: p => getPrimaryOwnerName(p.owner),
      });
      // Additional owners
      for (let i = 1; i < MAX_OWNERS; i++) {
        cols.push({
          header: `Owner ${i + 1} Name`,
          get: p => {
            const o = p.owner?.owners?.[i];
            if (!o) return '';
            return `${o.firstName || ''} ${o.lastName || ''}`.trim();
          },
        });
      }
      // Phones
      for (let i = 0; i < MAX_PHONES; i++) {
        cols.push({
          header: `Phone ${i + 1}`,
          get: p => p.owner?.phones?.[i]?.number || '',
        });
        cols.push({
          header: `Phone ${i + 1} DNC`,
          get: p => (p.owner?.phones?.[i]?.doNotCall ? 'Yes' : ''),
        });
      }
      // Emails
      for (let i = 0; i < MAX_EMAILS; i++) {
        cols.push({
          header: `Email ${i + 1}`,
          get: p => p.owner?.emails?.[i]?.address || '',
        });
        cols.push({
          header: `Email ${i + 1} Opted Out`,
          get: p => (p.owner?.emails?.[i]?.optedOut ? 'Yes' : ''),
        });
      }
      return cols;
    }
    case 'mailingAddress':
      return [
        { header: 'Mailing Street', get: p => p.owner?.mailingAddress || '' },
        { header: 'Mailing City', get: p => p.owner?.mailingCity || '' },
        { header: 'Mailing State', get: p => p.owner?.mailingState || '' },
        { header: 'Mailing Zip', get: p => p.owner?.mailingZip || '' },
      ];
    default:
      return [{
        header: getColumnLabel(colId, fields),
        get: p => {
          const value = (p as any)[colId] ?? p.customFields?.[colId];
          if (value === null || value === undefined) return '';
          if (Array.isArray(value)) return value.join('; ');
          if (typeof value === 'object') return JSON.stringify(value);
          return value;
        },
      }];
  }
};

export function exportPropertiesToCsv(
  properties: Property[],
  visibleColumns: string[],
  fields: FieldDefinition[],
  stages: PipelineStage[]
): void {
  const columns: ExportColumn[] = visibleColumns.flatMap(c =>
    expandColumn(c, fields, stages)
  );
  const header = columns.map(c => escapeCsv(c.header)).join(',');
  const rows = properties.map(p =>
    columns.map(c => escapeCsv(c.get(p))).join(',')
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