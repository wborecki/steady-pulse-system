import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Server, Bell, Settings, ChevronLeft, ChevronRight, Shield, BarChart3, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/services', label: 'Serviços', icon: Server },
  { path: '/reports', label: 'Relatórios', icon: BarChart3 },
  { path: '/alerts', label: 'Alertas', icon: Bell },
  { path: '/settings', label: 'Configurações', icon: Settings },
];

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { signOut } = useAuth();

  const sidebarContent = (
    <>
      <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
        <div className="p-1.5 rounded-lg bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        {!collapsed && (
          <div>
            <h1 className="font-heading font-bold text-sm text-foreground">MonitorHub</h1>
            <p className="text-[10px] font-mono text-muted-foreground">Sistema de Monitoramento</p>
          </div>
        )}
        {/* Mobile close */}
        <button onClick={() => setMobileOpen(false)} className="ml-auto md:hidden text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                isActive
                  ? 'bg-sidebar-accent text-primary font-semibold'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground'
              }`}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full p-3 text-muted-foreground hover:text-foreground transition-colors hidden md:block"
        >
          {collapsed ? <ChevronRight className="h-4 w-4 mx-auto" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-50 md:hidden p-2 rounded-lg bg-sidebar border border-sidebar-border text-foreground"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — mobile: slide-in overlay, desktop: static */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-56 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 md:static md:translate-x-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          ${collapsed ? 'md:w-16' : 'md:w-56'}
        `}
      >
        {sidebarContent}
      </aside>

      <main className="flex-1 overflow-auto pt-12 md:pt-0">
        {children}
      </main>
    </div>
  );
}
