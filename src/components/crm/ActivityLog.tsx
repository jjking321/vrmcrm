import React, { useState } from 'react';
import { Activity, ActivityType } from '@/types';
import { Phone, Mail, MessageSquare, Calendar, FileText, Plus, MapPin, Pencil, Trash2, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
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

interface ActivityLogProps {
  activities: Activity[];
  onAddActivity: (activity: Omit<Activity, 'id'>) => void;
  onEditActivity?: (id: string, updates: { type?: string; content?: string; outcome?: string }) => void;
  onDeleteActivity?: (id: string) => void;
  showPropertyContext?: boolean;
  currentPropertyId?: string;
}

const ActivityLog: React.FC<ActivityLogProps> = ({ 
  activities, 
  onAddActivity,
  onEditActivity,
  onDeleteActivity,
  showPropertyContext = false,
  currentPropertyId,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newType, setNewType] = useState<ActivityType>('note');
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<ActivityType>('note');
  const [editContent, setEditContent] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const icons: Record<ActivityType, React.ReactNode> = {
    call: <Phone className="w-4 h-4" />,
    email: <Mail className="w-4 h-4" />,
    mail: <FileText className="w-4 h-4" />,
    meeting: <Calendar className="w-4 h-4" />,
    note: <MessageSquare className="w-4 h-4" />,
  };

  const typeColors: Record<ActivityType, string> = {
    call: 'bg-blue-100 text-blue-700 border-blue-200',
    email: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    mail: 'bg-amber-100 text-amber-700 border-amber-200',
    meeting: 'bg-violet-100 text-violet-700 border-violet-200',
    note: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newContent.trim()) {
      onAddActivity({
        type: newType,
        date: new Date().toISOString(),
        content: newContent.trim(),
      });
      setNewContent('');
      setIsAdding(false);
    }
  };

  const sortedActivities = [...activities].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="bg-card rounded-xl shadow-soft border border-border">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Activity Timeline</h3>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-brand hover:bg-brand-50 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Activity
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="p-4 bg-muted/30 border-b border-border">
          <div className="flex flex-wrap gap-2 mb-3">
            {(Object.keys(icons) as ActivityType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setNewType(type)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all",
                  newType === type
                    ? 'ring-2 ring-brand ring-offset-1 ' + typeColors[type]
                    : 'bg-card border-border text-muted-foreground hover:border-brand'
                )}
              >
                {icons[type]}
                <span className="capitalize">{type}</span>
              </button>
            ))}
          </div>
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="What happened?"
            className="w-full p-3 border border-input rounded-lg text-sm resize-none focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none bg-card"
            rows={3}
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-3">
            <button
              type="button"
              onClick={() => { setIsAdding(false); setNewContent(''); }}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newContent.trim()}
              className="px-4 py-2 bg-brand text-brand-foreground rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              Save Activity
            </button>
          </div>
        </form>
      )}

      <div className="divide-y divide-border">
        {sortedActivities.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No activities yet. Start logging interactions!
          </div>
        ) : (
          sortedActivities.map((activity) => {
            const showPropertyRef = showPropertyContext && 
              activity.propertyAddress && 
              (!currentPropertyId || activity.propertyId !== currentPropertyId);
            
            const isEditing = editingId === activity.id;

            if (isEditing) {
              return (
                <div key={activity.id} className="p-4 bg-muted/30">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(Object.keys(icons) as ActivityType[]).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setEditType(type)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all",
                          editType === type
                            ? 'ring-2 ring-brand ring-offset-1 ' + typeColors[type]
                            : 'bg-card border-border text-muted-foreground hover:border-brand'
                        )}
                      >
                        {icons[type]}
                        <span className="capitalize">{type}</span>
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full p-3 border border-input rounded-lg text-sm resize-none focus:ring-2 focus:ring-brand-100 focus:border-brand outline-none bg-card"
                    rows={3}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (onEditActivity && editContent.trim()) {
                          onEditActivity(activity.id, { type: editType, content: editContent.trim() });
                          setEditingId(null);
                        }
                      }}
                      disabled={!editContent.trim()}
                      className="px-3 py-1.5 bg-brand text-brand-foreground rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors flex items-center gap-1"
                    >
                      <Check className="w-4 h-4" />
                      Save
                    </button>
                  </div>
                </div>
              );
            }
            
            return (
              <div key={activity.id} className="p-4 hover:bg-muted/30 transition-colors group">
                <div className="flex items-start gap-3">
                  <div className={cn("p-2 rounded-lg border", typeColors[activity.type])}>
                    {icons[activity.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground capitalize">{activity.type}</span>
                        {activity.ownerName && (
                          <span className="text-xs text-muted-foreground">with {activity.ownerName}</span>
                        )}
                        {activity.createdByName && (
                          <span className="text-xs text-muted-foreground">by {activity.createdByName}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {(onEditActivity || onDeleteActivity) && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {onEditActivity && (
                              <button
                                onClick={() => {
                                  setEditingId(activity.id);
                                  setEditType(activity.type);
                                  setEditContent(activity.content);
                                }}
                                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                                title="Edit activity"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {onDeleteActivity && (
                              <button
                                onClick={() => setDeleteId(activity.id)}
                                className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                                title="Delete activity"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                        <span className="text-xs text-muted-foreground">{formatDate(activity.date)}</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{activity.content}</p>
                    {showPropertyRef && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        Re: {activity.propertyAddress}
                      </p>
                    )}
                    {activity.outcome && (
                      <p className="text-xs text-brand mt-1 font-medium">Outcome: {activity.outcome}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Activity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this activity? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId && onDeleteActivity) {
                  onDeleteActivity(deleteId);
                  setDeleteId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ActivityLog;
