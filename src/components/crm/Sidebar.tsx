import React from 'react';
import { ViewMode } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Home, Building, Users, LayoutGrid, Settings, LogOut, 
  Upload, Plus, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onImportClick: () => void;
  onAddPropertyClick: () => void;
  propertyCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  view,
  onViewChange,
  onImportClick,
  onAddPropertyClick,
  propertyCount,
}) => {
  const { user, company, logout } = useAuth();

  const navItems = [
    { id: 'properties' as ViewMode, label: 'Properties', icon: Building, count: propertyCount },
    { id: 'owners' as ViewMode, label: 'Owners', icon: Users },
    { id: 'kanban' as ViewMode, label: 'Pipeline', icon: LayoutGrid },
    { id: 'settings' as ViewMode, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="w-64 bg-sidebar flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-sidebar-primary rounded-lg flex items-center justify-center">
            <Home className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-sidebar-foreground text-lg leading-none">AddressFirst</h1>
            <p className="text-xs text-sidebar-foreground/60 mt-0.5">{company?.name || 'CRM'}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-3 space-y-2">
        <button
          onClick={onAddPropertyClick}
          className="w-full flex items-center gap-2 px-3 py-2.5 bg-sidebar-primary text-sidebar-primary-foreground rounded-lg font-medium text-sm hover:bg-sidebar-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Property
        </button>
        <button
          onClick={onImportClick}
          className="w-full flex items-center gap-2 px-3 py-2.5 bg-sidebar-accent text-sidebar-accent-foreground rounded-lg font-medium text-sm hover:bg-sidebar-accent/80 transition-colors"
        >
          <Upload className="w-4 h-4" />
          Import CSV
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
        <p className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">
          Menu
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = view === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all mb-1",
                isActive 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4" />
                {item.label}
              </div>
              {item.count !== undefined && (
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full",
                  isActive ? "bg-sidebar-primary/20 text-sidebar-primary" : "bg-sidebar-accent text-sidebar-foreground/60"
                )}>
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-accent-foreground font-medium text-sm">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name}</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 text-sidebar-foreground/60 hover:text-sidebar-foreground rounded transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
