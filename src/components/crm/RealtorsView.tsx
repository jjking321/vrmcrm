import React, { useState } from 'react';
import { Realtor } from '@/types';
import { useRealtors, useAddRealtor, useUpdateRealtor, useDeleteRealtor } from '@/hooks/useRealtors';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Building2, Plus, Search, Phone, Mail, Trash2, Pencil, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export const RealtorsView: React.FC = () => {
  const { data: realtors = [], isLoading } = useRealtors();
  const addMutation = useAddRealtor();
  const updateMutation = useUpdateRealtor();
  const deleteMutation = useDeleteRealtor();

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRealtor, setEditingRealtor] = useState<Realtor | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  const filtered = realtors.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.email?.toLowerCase().includes(search.toLowerCase()) ||
    r.phone?.includes(search)
  );

  const openCreate = () => {
    setEditingRealtor(null);
    setName('');
    setPhone('');
    setEmail('');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEdit = (r: Realtor) => {
    setEditingRealtor(r);
    setName(r.name);
    setPhone(r.phone || '');
    setEmail(r.email || '');
    setNotes(r.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
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

  const handleDelete = (id: string) => {
    if (!confirm('Delete this realtor? Any linked deals will keep their data but lose the realtor link.')) return;
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success('Realtor deleted'),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Realtors</h1>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Realtor
        </Button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search realtors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>{realtors.length === 0 ? 'No realtors yet. Add your first one!' : 'No realtors match your search.'}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="bg-card border border-border rounded-lg p-4 hover:shadow-medium transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-600 font-medium text-sm">
                    {r.name.charAt(0).toUpperCase()}
                  </div>
                  <h3 className="font-semibold text-foreground">{r.name}</h3>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(r)} className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(r.id)} className="p-1.5 text-muted-foreground hover:text-destructive rounded transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                {r.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-3.5 h-3.5" />
                    <a href={`tel:${r.phone}`} className="hover:text-foreground">{r.phone}</a>
                  </div>
                )}
                {r.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-3.5 h-3.5" />
                    <a href={`mailto:${r.email}`} className="hover:text-foreground truncate">{r.email}</a>
                  </div>
                )}
                {r.notes && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{r.notes}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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
