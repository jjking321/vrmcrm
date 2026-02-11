import React, { useState } from 'react';
import { FieldDefinition, CustomFieldType, PipelineStage } from '@/types';
import { Plus, Trash2, Database, Zap, CheckCircle, Eye, EyeOff, Users, Loader2, Key, Layers, ChevronUp, ChevronDown, Pencil, Copy, Link } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { usePipelineStages, useAddPipelineStage, useUpdatePipelineStage, useDeletePipelineStage, useReorderPipelineStages } from '@/hooks/usePipelineStages';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const STAGE_COLORS = [
  { name: 'Slate', value: 'slate' },
  { name: 'Blue', value: 'blue' },
  { name: 'Cyan', value: 'cyan' },
  { name: 'Teal', value: 'teal' },
  { name: 'Emerald', value: 'emerald' },
  { name: 'Green', value: 'green' },
  { name: 'Amber', value: 'amber' },
  { name: 'Orange', value: 'orange' },
  { name: 'Red', value: 'red' },
  { name: 'Rose', value: 'rose' },
  { name: 'Pink', value: 'pink' },
  { name: 'Violet', value: 'violet' },
  { name: 'Purple', value: 'purple' },
  { name: 'Indigo', value: 'indigo' },
];

const getColorClasses = (color: string) => {
  const colorMap: Record<string, { bg: string; text: string; dot: string }> = {
    slate: { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-500' },
    blue: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
    cyan: { bg: 'bg-cyan-100', text: 'text-cyan-700', dot: 'bg-cyan-500' },
    teal: { bg: 'bg-teal-100', text: 'text-teal-700', dot: 'bg-teal-500' },
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    green: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
    amber: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
    red: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
    rose: { bg: 'bg-rose-100', text: 'text-rose-700', dot: 'bg-rose-500' },
    pink: { bg: 'bg-pink-100', text: 'text-pink-700', dot: 'bg-pink-500' },
    violet: { bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-500' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  };
  return colorMap[color] || colorMap.blue;
};

interface SettingsProps {
  fields: (FieldDefinition & { isHidden?: boolean })[];
  onAddField: (field: FieldDefinition) => void;
  onDeleteField: (fieldId: string) => void;
  onToggleFieldVisibility: (fieldId: string, isHidden: boolean) => void;
}

export const Settings: React.FC<SettingsProps> = ({
  fields,
  onAddField,
  onDeleteField,
  onToggleFieldVisibility,
}) => {
  const { role, profile } = useAuth();
  const { teamMembers, isLoading: isLoadingTeam, createTeamMember, deleteTeamMember, updateMemberRole, resetMemberPassword } = useTeamMembers();
  const { data: stages = [], isLoading: isLoadingStages } = usePipelineStages();
  const addStageMutation = useAddPipelineStage();
  const updateStageMutation = useUpdatePipelineStage();
  const deleteStageMutation = useDeletePipelineStage();
  const reorderMutation = useReorderPipelineStages();
  
  const [activeTab, setActiveTab] = useState<'fields' | 'pipeline' | 'team' | 'integrations'>('fields');
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newField, setNewField] = useState({ label: '', type: 'text' as CustomFieldType });
  const [newMember, setNewMember] = useState({ name: '', email: '', password: '' });
  const [passwordResetModal, setPasswordResetModal] = useState<{ open: boolean; userId: string; userName: string }>({ open: false, userId: '', userName: '' });
  const [newPassword, setNewPassword] = useState('');
  
  // Pipeline stage state
  const [stageModal, setStageModal] = useState<{ open: boolean; stage?: PipelineStage }>({ open: false });
  const [stageName, setStageName] = useState('');
  const [stageColor, setStageColor] = useState('blue');
  const [deleteStageDialog, setDeleteStageDialog] = useState<{ open: boolean; stage?: PipelineStage }>({ open: false });
  const [campaignName, setCampaignName] = useState('');

  const isAdmin = role === 'admin';

  const handleAddField = (e: React.FormEvent) => {
    e.preventDefault();
    if (newField.label.trim()) {
      onAddField({
        id: `custom_${Date.now()}`,
        label: newField.label.trim(),
        type: newField.type,
        isSystem: false,
      });
      setNewField({ label: '', type: 'text' });
      setIsAdding(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMember.name.trim() && newMember.email.trim() && newMember.password) {
      await createTeamMember.mutateAsync({
        name: newMember.name.trim(),
        email: newMember.email.trim(),
        password: newMember.password,
      });
      setNewMember({ name: '', email: '', password: '' });
      setIsAddingMember(false);
    }
  };

  const handlePasswordReset = async () => {
    if (newPassword.length >= 6) {
      await resetMemberPassword.mutateAsync({
        userId: passwordResetModal.userId,
        password: newPassword,
      });
      setPasswordResetModal({ open: false, userId: '', userName: '' });
      setNewPassword('');
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'member') => {
    await updateMemberRole.mutateAsync({ userId, role: newRole });
  };

  // Pipeline stage handlers
  const handleOpenStageModal = (stage?: PipelineStage) => {
    if (stage) {
      setStageName(stage.name);
      setStageColor(stage.color);
    } else {
      setStageName('');
      setStageColor('blue');
    }
    setStageModal({ open: true, stage });
  };

  const handleSaveStage = async () => {
    if (!stageName.trim()) return;
    
    try {
      if (stageModal.stage) {
        await updateStageMutation.mutateAsync({
          id: stageModal.stage.id,
          name: stageName.trim(),
          color: stageColor,
        });
        toast.success('Stage updated');
      } else {
        await addStageMutation.mutateAsync({
          name: stageName.trim(),
          color: stageColor,
        });
        toast.success('Stage added');
      }
      setStageModal({ open: false });
    } catch (error) {
      toast.error('Failed to save stage');
    }
  };

  const handleDeleteStage = async () => {
    if (!deleteStageDialog.stage) return;
    
    try {
      await deleteStageMutation.mutateAsync(deleteStageDialog.stage.id);
      toast.success('Stage deleted');
      setDeleteStageDialog({ open: false });
    } catch (error) {
      toast.error('Failed to delete stage');
    }
  };

  const handleMoveStage = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= stages.length) return;
    
    const reordered = [...stages];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    
    try {
      await reorderMutation.mutateAsync(
        reordered.map((stage, i) => ({ id: stage.id, sort_order: i }))
      );
    } catch (error) {
      toast.error('Failed to reorder stages');
    }
  };

  const integrations = [
    {
      name: 'Geocodio',
      description: 'Address verification and standardization',
      color: 'emerald',
      configured: true,
    },
    {
      name: 'RapidAPI (Zillow)',
      description: 'Property valuations and market data',
      color: 'blue',
      configured: true,
    },
    {
      name: 'Airbnb',
      description: 'Airbnb revenue estimates and analytics',
      color: 'violet',
      configured: true,
    },
    {
      name: 'Lovable AI',
      description: 'AI-powered marketing copy generation',
      color: 'amber',
      configured: true,
    },
    {
      name: 'Postalytics',
      description: 'Direct mail PURL scan tracking',
      color: 'rose',
      configured: true,
    },
  ];



  const webhookBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/postalytics-webhook`;
  const webhookUrl = campaignName.trim()
    ? `${webhookBaseUrl}?campaign=${encodeURIComponent(campaignName.trim())}`
    : webhookBaseUrl;

  const handleCopyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      toast.success('Webhook URL copied!');
    } catch {
      toast.error('Failed to copy URL');
    }
  };

  return (
    <div className="max-w-4xl animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit mb-6">
        <button
          onClick={() => setActiveTab('fields')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
            activeTab === 'fields' ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Database className="w-4 h-4" />
          Custom Fields
        </button>
        <button
          onClick={() => setActiveTab('pipeline')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
            activeTab === 'pipeline' ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Layers className="w-4 h-4" />
          Pipeline Stages
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
            activeTab === 'team' ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Users className="w-4 h-4" />
          Team
        </button>
        <button
          onClick={() => setActiveTab('integrations')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
            activeTab === 'integrations' ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Zap className="w-4 h-4" />
          Integrations
        </button>
      </div>

      {activeTab === 'fields' && (
        <div className="bg-card rounded-xl shadow-soft border border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-semibold text-foreground">Custom Fields</h2>
              <p className="text-sm text-muted-foreground">Add custom fields to track additional property data</p>
            </div>
            {!isAdding && (
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-2 px-4 py-2 bg-brand text-brand-foreground rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Field
              </button>
            )}
          </div>

          {isAdding && (
            <form onSubmit={handleAddField} className="mb-6 p-4 bg-muted/30 rounded-lg border border-border">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">Field Label</label>
                  <input
                    type="text"
                    value={newField.label}
                    onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                    className="w-full p-2.5 border border-input rounded-lg text-sm bg-card focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none"
                    placeholder="e.g. HOA Contact"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">Field Type</label>
                  <select
                    value={newField.type}
                    onChange={(e) => setNewField({ ...newField, type: e.target.value as CustomFieldType })}
                    className="w-full p-2.5 border border-input rounded-lg text-sm bg-card focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none"
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="email">Email</option>
                    <option value="url">URL</option>
                    <option value="checkbox">Checkbox</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setIsAdding(false); setNewField({ label: '', type: 'text' }); }}
                  className="px-4 py-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newField.label.trim()}
                  className="px-4 py-2 bg-brand text-brand-foreground rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
                >
                  Create Field
                </button>
              </div>
            </form>
          )}

          {/* Fields Table */}
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Field Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Visible</th>
                  <th className="px-4 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {fields.map((field) => (
                  <tr key={field.id} className={cn("hover:bg-muted/20 transition-colors", field.isHidden && "opacity-50")}>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{field.label}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground capitalize">{field.type}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        field.isSystem ? "bg-muted text-muted-foreground" : "bg-brand-50 text-brand-700"
                      )}>
                        {field.isSystem ? 'System' : 'Custom'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onToggleFieldVisibility(field.id, !field.isHidden)}
                        className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                        title={field.isHidden ? 'Show field' : 'Hide field'}
                      >
                        {field.isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {!field.isSystem && (
                        <button
                          onClick={() => onDeleteField(field.id)}
                          className="p-1.5 text-muted-foreground hover:text-destructive rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'pipeline' && (
        <div className="bg-card rounded-xl shadow-soft border border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-semibold text-foreground">Pipeline Stages</h2>
              <p className="text-sm text-muted-foreground">Customize stages for tracking property deals</p>
            </div>
            <button
              onClick={() => handleOpenStageModal()}
              className="flex items-center gap-2 px-4 py-2 bg-brand text-brand-foreground rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Stage
            </button>
          </div>

          {/* Stages List */}
          <div className="border border-border rounded-lg overflow-hidden">
            {isLoadingStages ? (
              <div className="p-8 text-center text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              </div>
            ) : stages.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No pipeline stages yet. Add your first stage to get started.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {stages.map((stage, index) => {
                  const colors = getColorClasses(stage.color);
                  return (
                    <div key={stage.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-3 h-3 rounded-full", colors.dot)} />
                        <span className="font-medium text-foreground">{stage.name}</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full", colors.bg, colors.text)}>
                          {stage.color}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleMoveStage(index, 'up')}
                          disabled={index === 0 || reorderMutation.isPending}
                          className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors disabled:opacity-30"
                          title="Move up"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMoveStage(index, 'down')}
                          disabled={index === stages.length - 1 || reorderMutation.isPending}
                          className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors disabled:opacity-30"
                          title="Move down"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenStageModal(stage)}
                          className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                          title="Edit stage"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteStageDialog({ open: true, stage })}
                          className="p-1.5 text-muted-foreground hover:text-destructive rounded transition-colors"
                          title="Delete stage"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}


      {activeTab === 'team' && (
        <div className="bg-card rounded-xl shadow-soft border border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-semibold text-foreground">Team Members</h2>
              <p className="text-sm text-muted-foreground">Manage users who can access your account</p>
            </div>
            {isAdmin && !isAddingMember && (
              <button
                onClick={() => setIsAddingMember(true)}
                className="flex items-center gap-2 px-4 py-2 bg-brand text-brand-foreground rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Team Member
              </button>
            )}
          </div>

          {isAddingMember && (
            <form onSubmit={handleAddMember} className="mb-6 p-4 bg-muted/30 rounded-lg border border-border">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">Name</label>
                  <input
                    type="text"
                    value={newMember.name}
                    onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                    className="w-full p-2.5 border border-input rounded-lg text-sm bg-card focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none"
                    placeholder="John Smith"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">Email</label>
                  <input
                    type="email"
                    value={newMember.email}
                    onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                    className="w-full p-2.5 border border-input rounded-lg text-sm bg-card focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none"
                    placeholder="john@company.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">Password</label>
                  <input
                    type="password"
                    value={newMember.password}
                    onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
                    className="w-full p-2.5 border border-input rounded-lg text-sm bg-card focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none"
                    placeholder="Min 6 characters"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setIsAddingMember(false); setNewMember({ name: '', email: '', password: '' }); }}
                  className="px-4 py-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newMember.name.trim() || !newMember.email.trim() || newMember.password.length < 6 || createTeamMember.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-brand text-brand-foreground rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
                >
                  {createTeamMember.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Add Member
                </button>
              </div>
            </form>
          )}

          {/* Team Members Table */}
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Joined</th>
                  {isAdmin && <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoadingTeam ? (
                  <tr>
                    <td colSpan={isAdmin ? 4 : 3} className="px-4 py-8 text-center text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : teamMembers.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 4 : 3} className="px-4 py-8 text-center text-muted-foreground">
                      No team members yet
                    </td>
                  </tr>
                ) : (
                  teamMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
                            <span className="text-brand-700 text-sm font-medium">
                              {member.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-foreground">
                              {member.name}
                              {member.id === profile?.id && (
                                <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isAdmin && member.id !== profile?.id ? (
                          <Select
                            value={member.role}
                            onValueChange={(value: 'admin' | 'member') => handleRoleChange(member.id, value)}
                            disabled={updateMemberRole.isPending}
                          >
                            <SelectTrigger className="w-28 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="member">Member</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full capitalize",
                            member.role === 'admin' ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"
                          )}>
                            {member.role}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {member.created_at ? format(new Date(member.created_at), 'MMM d, yyyy') : '-'}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setPasswordResetModal({ open: true, userId: member.id, userName: member.name })}
                              className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                              title="Reset password"
                            >
                              <Key className="w-4 h-4" />
                            </button>
                            {member.id !== profile?.id && (
                              <button
                                onClick={() => {
                                  if (confirm(`Remove ${member.name} from your team?`)) {
                                    deleteTeamMember.mutate(member.id);
                                  }
                                }}
                                className="p-1.5 text-muted-foreground hover:text-destructive rounded transition-colors"
                                title="Remove team member"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!isAdmin && (
            <p className="mt-4 text-sm text-muted-foreground">
              Contact your admin to add or remove team members.
            </p>
          )}

          {/* Password Reset Modal */}
          <Dialog open={passwordResetModal.open} onOpenChange={(open) => {
            if (!open) {
              setPasswordResetModal({ open: false, userId: '', userName: '' });
              setNewPassword('');
            }
          }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reset Password for {passwordResetModal.userName}</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-2.5 border border-input rounded-lg text-sm bg-card focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none"
                  placeholder="Min 6 characters"
                  autoFocus
                />
              </div>
              <DialogFooter>
                <button
                  onClick={() => {
                    setPasswordResetModal({ open: false, userId: '', userName: '' });
                    setNewPassword('');
                  }}
                  className="px-4 py-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePasswordReset}
                  disabled={newPassword.length < 6 || resetMemberPassword.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-brand text-brand-foreground rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
                >
                  {resetMemberPassword.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Reset Password
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {activeTab === 'integrations' && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl shadow-soft border border-border p-6 mb-4">
            <p className="text-sm text-muted-foreground">
              API integrations are managed securely as backend secrets. Contact your administrator to update API keys.
            </p>
          </div>

          {integrations.map((integration) => (
            <div key={integration.name} className="bg-card rounded-xl shadow-soft border border-border p-6">
              <div className="flex items-start gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  integration.color === 'emerald' && "bg-emerald-100",
                  integration.color === 'blue' && "bg-blue-100",
                  integration.color === 'violet' && "bg-violet-100",
                  integration.color === 'amber' && "bg-amber-100",
                  integration.color === 'rose' && "bg-rose-100"
                )}>
                  <CheckCircle className={cn(
                    "w-5 h-5",
                    integration.color === 'emerald' && "text-emerald-600",
                    integration.color === 'blue' && "text-blue-600",
                    integration.color === 'violet' && "text-violet-600",
                    integration.color === 'amber' && "text-amber-600",
                    integration.color === 'rose' && "text-rose-600"
                  )} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{integration.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      Configured
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{integration.description}</p>
                </div>
              </div>
            </div>
          ))}

          {/* Postalytics Webhook URL Section */}
          <div className="bg-card rounded-xl shadow-soft border border-border p-6">
            <div className="flex items-center gap-2 mb-3">
              <Link className="w-4 h-4 text-rose-600" />
              <h3 className="font-semibold text-foreground">Postalytics Webhook URL</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Paste this URL into the webhook configuration for each Postalytics campaign.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Campaign Name (optional)</label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g. Spring Mailer 2025"
                  className="w-full p-2.5 border border-input rounded-lg text-sm bg-card focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Webhook URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="flex-1 p-2.5 border border-input rounded-lg text-sm bg-muted/50 text-muted-foreground font-mono truncate"
                  />
                  <button
                    onClick={handleCopyWebhook}
                    className="flex items-center gap-2 px-4 py-2 bg-brand text-brand-foreground rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors whitespace-nowrap"
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stage Edit/Add Modal */}
      <Dialog open={stageModal.open} onOpenChange={(open) => {
        if (!open) setStageModal({ open: false });
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{stageModal.stage ? 'Edit Stage' : 'Add Pipeline Stage'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Stage Name</label>
              <input
                type="text"
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                className="w-full p-2.5 border border-input rounded-lg text-sm bg-card focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none"
                placeholder="e.g. Interested"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Color</label>
              <div className="grid grid-cols-7 gap-2">
                {STAGE_COLORS.map((color) => {
                  const colors = getColorClasses(color.value);
                  return (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setStageColor(color.value)}
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                        colors.dot,
                        stageColor === color.value && "ring-2 ring-offset-2 ring-brand"
                      )}
                      title={color.name}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setStageModal({ open: false })}
              className="px-4 py-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveStage}
              disabled={!stageName.trim() || addStageMutation.isPending || updateStageMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-brand text-brand-foreground rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {(addStageMutation.isPending || updateStageMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
              {stageModal.stage ? 'Save Changes' : 'Add Stage'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Stage Confirmation */}
      <AlertDialog open={deleteStageDialog.open} onOpenChange={(open) => {
        if (!open) setDeleteStageDialog({ open: false });
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pipeline Stage</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteStageDialog.stage?.name}"? Properties in this stage will be set to Unassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStage}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteStageMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
