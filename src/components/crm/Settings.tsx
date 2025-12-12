import React, { useState } from 'react';
import { FieldDefinition, CustomFieldType } from '@/types';
import { Plus, Trash2, Database, Zap, CheckCircle, Eye, EyeOff, Users, Loader2, Key } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { format } from 'date-fns';
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
  const [activeTab, setActiveTab] = useState<'fields' | 'integrations' | 'team'>('fields');
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newField, setNewField] = useState({ label: '', type: 'text' as CustomFieldType });
  const [newMember, setNewMember] = useState({ name: '', email: '', password: '' });
  const [passwordResetModal, setPasswordResetModal] = useState<{ open: boolean; userId: string; userName: string }>({ open: false, userId: '', userName: '' });
  const [newPassword, setNewPassword] = useState('');

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
      name: 'AirROI',
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
  ];

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
                  integration.color === 'amber' && "bg-amber-100"
                )}>
                  <CheckCircle className={cn(
                    "w-5 h-5",
                    integration.color === 'emerald' && "text-emerald-600",
                    integration.color === 'blue' && "text-blue-600",
                    integration.color === 'violet' && "text-violet-600",
                    integration.color === 'amber' && "text-amber-600"
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
        </div>
      )}
    </div>
  );
};
