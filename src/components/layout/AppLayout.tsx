import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { useAlliance } from '@/contexts/AllianceContext';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  ClipboardList,
  Wrench,
  Table,
  BarChart3,
  Settings,
  LogOut,
  UserCog,
  Zap,
  Radio,
  Menu,
  X,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

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

function AllianceSelector() {
  const { alliance, setAlliance } = useAlliance();
  
  return (
    <div className="px-3 mx-3 mt-3 md:px-4 md:mx-4 md:mt-4">
      <p className="text-xs text-muted-foreground mb-2">Alliance</p>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={() => setAlliance('blue')}
          className={cn(
            "h-10 rounded-lg text-xs font-semibold transition-all",
            alliance === 'blue'
              ? "bg-alliance-blue text-white shadow-[0_0_12px_hsl(210_100%_50%/0.4)]"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          BLUE
        </button>
        <button
          onClick={() => setAlliance('red')}
          className={cn(
            "h-10 rounded-lg text-xs font-semibold transition-all",
            alliance === 'red'
              ? "bg-alliance-red text-white shadow-[0_0_12px_hsl(0_85%_55%/0.4)]"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          RED
        </button>
      </div>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { profile, signOut, isAdmin } = useAuth();
  const { currentEvent } = useEvent();

  const handleSignOut = () => {
    onNavigate?.();
    signOut();
  };

  return (
    <>
      {/* Logo */}
      <div className="p-4 md:p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center bg-glow">
            <Zap className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-sidebar-foreground">DECODE</h1>
            <p className="text-xs text-muted-foreground">Scouting</p>
          </div>
        </div>
      </div>

      {/* Alliance Selector */}
      <AllianceSelector />

      {/* Event Badge */}
      {currentEvent && (
        <div className="px-3 py-2 mx-3 mt-3 md:px-4 md:py-3 md:mx-4 md:mt-4 rounded-lg bg-primary/10 border border-primary/20">
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
      <nav className="flex-1 p-3 md:p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn('nav-item', isActive && 'nav-item-active')
            }
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
        
        <NavLink
          to="/profile"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn('nav-item', isActive && 'nav-item-active')
          }
        >
          <UserCog className="w-5 h-5" />
          <span>Profile</span>
        </NavLink>

        {isAdmin && (
          <NavLink
            to="/admin"
            onClick={onNavigate}
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
      <div className="p-3 md:p-4 border-t border-sidebar-border">
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
            {profile?.teamNumber && (
              <p className="text-xs text-primary font-mono">
                Team {profile.teamNumber}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full nav-item text-destructive hover:bg-destructive/10"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Mobile Header */}
        <header className="sticky top-0 z-40 flex items-center justify-between px-4 h-14 bg-sidebar border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-sidebar-foreground">DECODE</span>
          </div>
          
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-sidebar-foreground">
                <Menu className="w-6 h-6" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0 bg-sidebar border-sidebar-border">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation Menu</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col h-full">
                <SidebarContent onNavigate={() => setOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
        <SidebarContent />
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
