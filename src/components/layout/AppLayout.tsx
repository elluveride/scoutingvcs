import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import {
  ClipboardList,
  Wrench,
  Table,
  BarChart3,
  Settings,
  LogOut,
  Zap,
  Radio,
} from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { to: '/scout', icon: ClipboardList, label: 'Match Scout' },
  { to: '/pit', icon: Wrench, label: 'Pit Scout' },
  { to: '/spreadsheet', icon: Table, label: 'Spreadsheet' },
  { to: '/dashboard', icon: BarChart3, label: 'Dashboard' },
  { to: '/live-stats', icon: Radio, label: 'Live Stats' },
];

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const { profile, signOut, isAdmin } = useAuth();
  const { currentEvent } = useEvent();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Zap className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-sidebar-foreground">DECODE</h1>
              <p className="text-xs text-muted-foreground">Scouting</p>
            </div>
          </div>
        </div>

        {/* Event Badge */}
        {currentEvent && (
          <div className="px-4 py-3 mx-4 mt-4 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-xs text-muted-foreground">Current Event</p>
            <p className="font-semibold text-primary text-sm truncate">
              {currentEvent.name}
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              {currentEvent.code}
            </p>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn('nav-item', isActive && 'nav-item-active')
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
          
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                cn('nav-item', isActive && 'nav-item-active')
              }
            >
              <Settings className="w-5 h-5" />
              <span>Admin</span>
            </NavLink>
          )}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <span className="text-sm font-semibold">
                {profile?.name?.charAt(0).toUpperCase() || '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{profile?.name}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {profile?.role} • {profile?.status}
              </p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full nav-item text-destructive hover:bg-destructive/10"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
