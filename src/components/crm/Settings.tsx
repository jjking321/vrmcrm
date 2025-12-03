import React, { useState } from 'react';
import { FieldDefinition, CustomFieldType } from '@/types';
import { Plus, Trash2, Key, Database, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SettingsProps {
  fields: FieldDefinition[];
  onAddField: (field: FieldDefinition) => void;
  onDeleteField: (fieldId: string) => void;
  geocodioApiKey: string;
  onGeocodioApiKeyChange: (key: string) => void;
  rapidApiKey: string;
  onRapidApiKeyChange: (key: string) => void;
  airRoiApiKey: string;
  onAirRoiApiKeyChange: (key: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({
  fields,
  onAddField,
  onDeleteField,
  geocodioApiKey,
  onGeocodioApiKeyChange,
  rapidApiKey,
  onRapidApiKeyChange,
  airRoiApiKey,
  onAirRoiApiKeyChange,
}) => {
  const [activeTab, setActiveTab] = useState<'fields' | 'integrations'>('fields');
  const [isAdding, setIsAdding] = useState(false);
  const [newField, setNewField] = useState({ label: '', type: 'text' as CustomFieldType });

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

  const customFields = fields.filter(f => !f.isSystem);

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
                  <th className="px-4 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {fields.map((field) => (
                  <tr key={field.id} className="hover:bg-muted/20 transition-colors">
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

      {activeTab === 'integrations' && (
        <div className="space-y-4">
          {/* Geocodio */}
          <div className="bg-card rounded-xl shadow-soft border border-border p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Key className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Geocodio</h3>
                <p className="text-sm text-muted-foreground mb-3">Address verification and standardization</p>
                <input
                  type="password"
                  value={geocodioApiKey}
                  onChange={(e) => onGeocodioApiKeyChange(e.target.value)}
                  className="w-full p-2.5 border border-input rounded-lg text-sm bg-background focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none"
                  placeholder="Enter your Geocodio API key"
                />
              </div>
            </div>
          </div>

          {/* RapidAPI (Zillow) */}
          <div className="bg-card rounded-xl shadow-soft border border-border p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Key className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">RapidAPI (Zillow)</h3>
                <p className="text-sm text-muted-foreground mb-3">Property valuations and market data</p>
                <input
                  type="password"
                  value={rapidApiKey}
                  onChange={(e) => onRapidApiKeyChange(e.target.value)}
                  className="w-full p-2.5 border border-input rounded-lg text-sm bg-background focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none"
                  placeholder="Enter your RapidAPI key"
                />
              </div>
            </div>
          </div>

          {/* AirROI */}
          <div className="bg-card rounded-xl shadow-soft border border-border p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
                <Key className="w-5 h-5 text-violet-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">AirROI</h3>
                <p className="text-sm text-muted-foreground mb-3">Airbnb revenue estimates and analytics</p>
                <input
                  type="password"
                  value={airRoiApiKey}
                  onChange={(e) => onAirRoiApiKeyChange(e.target.value)}
                  className="w-full p-2.5 border border-input rounded-lg text-sm bg-background focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none"
                  placeholder="Enter your AirROI API key"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
