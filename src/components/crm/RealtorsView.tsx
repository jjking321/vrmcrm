import React, { useState, useMemo } from 'react';
import { Realtor } from '@/types';
import { useRealtors, useAddRealtor, useUpdateRealtor, useDeleteRealtor } from '@/hooks/useRealtors';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePersistedState } from '@/hooks/usePersistedState';
import {
  Building2, Plus, Search, Phone, Mail, Trash2, Pencil, Loader2, X,
  ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react';
import { toast } from 'sonner';

interface RealtorsViewProps {
  onSelectRealtor?: (id: string) => void;
}

export const RealtorsView: React.FC<RealtorsViewProps> = ({ onSelectRealtor }) => {
  const { data: realtors = [], isLoading } = useRealtors();
  const addMutation = useAddRealtor();
  const updateMutation = useUpdateRealtor();
  const deleteMutation = useDeleteRealtor();

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRealtor, setEditingRealtor] = useState<Realtor | null>(null);
  const [sortConfig, setSortConfig] = usePersistedState<{ field: string; direction: 'asc' | 'desc' }>(
    'crm-realtor-sort-config',
    { field: 'name', direction: 'asc' }
  );

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  const filtered = useMemo(() => {
    let list = realtors;
    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter(r =>
        r.name.toLowerCase().includes(term) ||
        r.email?.toLowerCase().includes(term) ||
        r.phone?.includes(term)
      );
    }
    const sorted = [...list].sort((a, b) => {
      const { field, direction } = sortConfig;
      let cmp = 0;
      if (field === 'name') cmp = a.name.localeCompare(b.name);
      else if (field === 'email') cmp = (a.email || '').localeCompare(b.email || '');
      else if (field === 'phone') cmp = (a.phone || '').localeCompare(b.phone || '');
      return direction === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [realtors, search, sortConfig]);

  const handleSort = (field: string) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const getSortIcon = (field: string) => {
    if (sortConfig.field !== field) return <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-60" />;
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="w-3 h-3 text-brand" />
      : <ArrowDown className="w-3 h-3 text-brand" />;
  };

  const openCreate = () => {
    setEditingRealtor(null);
    setName(''); setPhone(''); setEmail(''); setNotes('');
    setIsModalOpen(true);
  };

  const openEdit = (r: Realtor, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingRealtor(r);
    setName(r.name); setPhone(r.phone || ''); setEmail(r.email || ''); setNotes(r.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    if (editingRealtor) {
      updateMutation.mutate(
        { id: editingRealtor.id, updates: { name, phone: phone || undefined, email: email || undefined, notes: notes || undefined } },
        { onSuccess: () => { toast.success('Realtor updated'); setIsModalOpen(false); } }
      );
    } else {
      addMutation.mutate(
        { name, phone: phone || undefined, email: email || undefined, notes: notes || undefined },
        { onSuccess: () => { toast.success('Realtor created'); setIsModalOpen(false); } }
      );
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this realtor? Linked deals will lose their realtor link.')) return;
    deleteMutation.mutate(id, { onSuccess: () => toast.success('Realtor deleted') });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Realtors</h1>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Realtor
        </Button>
      </div>

      <div className="bg-card rounded-xl shadow-soft border border-border overflow-hidden">
        {/* Header with search and count */}
        <div className="p-4 border-b border-border flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading realtors...
                </span>
              ) : search ? (
                <span>{filtered.length.toLocaleString()} of {realtors.length.toLocaleString()} Realtors</span>
              ) : (
                <span>{realtors.length.toLocaleString()} Realtors</span>
              )}
            </h2>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or phone..."
              className="w-full pl-10 pr-10 py-2 border border-input rounded-lg text-sm bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th
                  onClick={() => handleSort('name')}
                  className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-1.5">
                    Realtor
                    {getSortIcon('name')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('phone')}
                  className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-1.5">
                    Phone
                    {getSortIcon('phone')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('email')}
                  className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-1.5">
                    Email
                    {getSortIcon('email')}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => openEdit(r, { stopPropagation: () => {} } as any)}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-600 font-semibold text-sm">
                        {r.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium text-foreground">{r.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {r.phone ? (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Phone className="w-3.5 h-3.5" />
                        {r.phone}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {r.email ? (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Mail className="w-3.5 h-3.5" />
                        {r.email}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-muted-foreground line-clamp-1">{r.notes || '—'}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => openEdit(r, e)} className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={(e) => handleDelete(r.id, e)} className="p-1.5 text-muted-foreground hover:text-destructive rounded transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isLoading && filtered.length === 0 && (
          <div className="p-12 text-center text-muted-foreground">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>{realtors.length === 0 ? 'No realtors yet. Add your first one!' : 'No realtors match your search.'}</p>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => !open && setIsModalOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRealtor ? 'Edit Realtor' : 'Add Realtor'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rName">Name *</Label>
              <Input id="rName" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Realtor" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rPhone">Phone</Label>
                <Input id="rPhone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
              </div>
              <div>
                <Label htmlFor="rEmail">Email</Label>
                <Input id="rEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@realty.com" />
              </div>
            </div>
            <div>
              <Label htmlFor="rNotes">Notes</Label>
              <Textarea id="rNotes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes..." rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!name.trim() || addMutation.isPending || updateMutation.isPending}>
                {(addMutation.isPending || updateMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editingRealtor ? 'Save' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
