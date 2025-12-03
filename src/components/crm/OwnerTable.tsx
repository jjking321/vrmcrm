import React from 'react';
import { Property } from '@/types';
import { ChevronRight, Phone, Mail, Building, DollarSign } from 'lucide-react';

interface OwnerTableProps {
  properties: Property[];
  onSelectOwner: (ownerName: string) => void;
}

export const OwnerTable: React.FC<OwnerTableProps> = ({ properties, onSelectOwner }) => {
  // Aggregate owners
  const ownersMap = new Map<string, { 
    propertyCount: number;
    email: string;
    phone: string;
    lastVerified?: string;
    totalRevenue: number;
  }>();

  properties.forEach(p => {
    const existing = ownersMap.get(p.owner.name);
    if (existing) {
      ownersMap.set(p.owner.name, {
        ...existing,
        propertyCount: existing.propertyCount + 1,
        totalRevenue: existing.totalRevenue + (p.marketData.projectedRevenue || 0),
      });
    } else {
      ownersMap.set(p.owner.name, {
        propertyCount: 1,
        email: p.owner.email,
        phone: p.owner.phone,
        lastVerified: p.owner.lastVerifiedDate,
        totalRevenue: p.marketData.projectedRevenue || 0,
      });
    }
  });

  const owners = Array.from(ownersMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  return (
    <div className="bg-card rounded-xl shadow-soft border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Owner</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Properties</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Revenue</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {owners.map((owner) => (
              <tr
                key={owner.name}
                onClick={() => onSelectOwner(owner.name)}
                className="hover:bg-muted/30 cursor-pointer transition-colors"
              >
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand font-semibold">
                      {owner.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-medium text-foreground">{owner.name}</span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="space-y-1">
                    {owner.email && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Mail className="w-3.5 h-3.5" />
                        {owner.email}
                      </div>
                    )}
                    {owner.phone && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Phone className="w-3.5 h-3.5" />
                        {owner.phone}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-full">
                    <Building className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{owner.propertyCount}</span>
                  </div>
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex items-center justify-end gap-1 text-emerald-600 font-semibold">
                    <DollarSign className="w-4 h-4" />
                    {owner.totalRevenue.toLocaleString()}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {owners.length === 0 && (
        <div className="p-12 text-center text-muted-foreground">
          <p>No owners found.</p>
        </div>
      )}
    </div>
  );
};
