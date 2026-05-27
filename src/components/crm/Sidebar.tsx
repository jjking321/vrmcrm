import React, { useState } from 'react';
import { ViewMode, SavedList } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Home, Building, Users, LayoutGrid, Settings, LogOut, Inbox,
  Upload, Plus, ChevronRight, ChevronDown, ListFilter, Trash2, BarChart3, Wrench, Ban, Phone, Mail, Building2, LineChart, ShieldAlert, UserX
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  view: ViewMode;
  onViewChange: (view: ViewMode, options?: { preserveFilters?: boolean }) => void;
  onImportClick: () => void;
  onAddPropertyClick: () => void;
  propertyCount: number;
  totalPropertyCount?: number;
  ownerCount?: number;
  realtorCount?: number;
  savedLists: SavedList[];
  onLoadList: (list: SavedList) => void;
  onDeleteList: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  view,
  onViewChange,
  onImportClick,
  onAddPropertyClick,
  propertyCount,
  totalPropertyCount,
  ownerCount,
  realtorCount,
  savedLists,
  onLoadList,
  onDeleteList,
}) => {
  const { user, profile, company, logout } = useAuth();
  const [smartListsOpen, setSmartListsOpen] = useState(true);

  const navItems = [
    { id: 'dashboard' as ViewMode, label: 'Dashboard', icon: BarChart3 },
    { id: 'properties' as ViewMode, label: 'Properties', icon: Building, count: totalPropertyCount || propertyCount },
    { id: 'owners' as ViewMode, label: 'Owners', icon: Users, count: ownerCount },
    { id: 'realtors' as ViewMode, label: 'Realtors', icon: Building2, count: realtorCount },
    { id: 'kanban' as ViewMode, label: 'Pipeline', icon: LayoutGrid },
    { id: 'inbox' as ViewMode, label: 'Inbox', icon: Inbox },
    { id: 'emailAnalytics' as ViewMode, label: 'Email Analytics', icon: LineChart },
    { id: 'callLists' as ViewMode, label: 'Call Lists', icon: Phone },
    { id: 'mailingLists' as ViewMode, label: 'Mailing Lists', icon: Mail },
    { id: 'dataCleanup' as ViewMode, label: 'Data Tools', icon: Wrench },
    { id: 'exclusions' as ViewMode, label: 'Exclusion List', icon: Ban },
    { id: 'dataQuality' as ViewMode, label: 'Data Quality', icon: ShieldAlert },
    { id: 'settings' as ViewMode, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="w-60 bg-sidebar flex flex-col h-screen sticky top-0 border-r border-sidebar-border">
      {/* Logo */}
      <div className="px-4 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
            <Home className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-sidebar-foreground text-base leading-none">AddressFirst</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{company?.name || 'CRM'}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-3 pb-4 flex gap-2">
        <button
          onClick={onAddPropertyClick}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
        <button
          onClick={onImportClick}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-border text-foreground rounded-md font-medium text-sm hover:bg-muted transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          Import
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = view === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all mb-0.5",
                isActive 
                  ? "bg-primary/10 text-primary font-medium" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={cn("w-4 h-4", isActive && "text-primary")} />
                {item.label}
              </div>
              {item.count !== undefined && (
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded",
                  isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {item.count}
                </span>
              )}
            </button>
          );
        })}

        {/* Smart Lists Section */}
        <div className="mt-6">
          <button
            onClick={() => setSmartListsOpen(!smartListsOpen)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <ListFilter className="w-3 h-3" />
              Smart Lists
            </div>
            {smartListsOpen ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>

          {smartListsOpen && (
            <div className="mt-1">
              {savedLists.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground/60 italic">
                  No saved lists yet
                </p>
              ) : (
                savedLists.map(list => (
                  <div
                    key={list.id}
                    className="group flex items-center justify-between px-3 py-1.5 rounded-md hover:bg-muted transition-colors"
                  >
                    <button
                      onClick={() => {
                        onLoadList(list);
                        onViewChange('properties', { preserveFilters: true });
                      }}
                      className="flex-1 text-left text-sm text-muted-foreground hover:text-foreground truncate"
                    >
                      {list.name}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteList(list.id);
                      }}
                      className="p-1 text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </nav>

      {/* User Section */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-xs">
            {profile?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{profile?.name || user?.email}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};