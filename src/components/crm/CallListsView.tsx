import React from 'react';
import { useCallLists, useDeleteCallList } from '@/hooks/useCallLists';
import { Button } from '@/components/ui/button';
import { Phone, Trash2, Play, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CallListsViewProps {
  onOpenDialer: (listId: string) => void;
}

export const CallListsView: React.FC<CallListsViewProps> = ({ onOpenDialer }) => {
  const { data: callLists = [], isLoading } = useCallLists();
  const deleteListMutation = useDeleteCallList();
  
  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) {
      deleteListMutation.mutate(id);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Call Lists</h1>
        <p className="text-sm text-muted-foreground">
          Create call lists from the Properties table using bulk selection
        </p>
      </div>
      
      {callLists.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <Phone className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No call lists yet</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Select properties in the Properties table, then click "Call List" in the bulk actions bar to create your first call list.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {callLists.map((list: any) => {
            const progress = list.totalCount > 0 
              ? Math.round((list.completedCount / list.totalCount) * 100) 
              : 0;
            
            return (
              <div
                key={list.id}
                className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-medium text-foreground">{list.name}</h3>
                  <button
                    onClick={() => handleDelete(list.id, list.name)}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{list.completedCount} / {list.totalCount} completed</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full transition-all",
                        progress === 100 ? "bg-green-500" : "bg-primary"
                      )}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                
                {/* Stats */}
                <div className="flex gap-4 text-sm mb-4">
                  <div>
                    <span className="text-muted-foreground">Pending: </span>
                    <span className="font-medium text-foreground">{list.pendingCount}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Completed: </span>
                    <span className="font-medium text-green-600">{list.completedCount}</span>
                  </div>
                </div>
                
                {/* Action button */}
                <Button
                  onClick={() => onOpenDialer(list.id)}
                  className="w-full"
                  disabled={list.pendingCount === 0}
                >
                  <Play className="w-4 h-4 mr-2" />
                  {list.pendingCount === 0 ? 'All Completed' : 'Start Calling'}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
