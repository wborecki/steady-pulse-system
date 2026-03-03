import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Server, Bell, Settings, ChevronLeft, ChevronRight, Shield, BarChart3, LogOut, Menu, X, Sun, Moon, Book, KeyRound } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from 'next-themes';

interface NavSection {
  label?: string;
  items: { path: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
}

const navSections: NavSection[] = [
  {
    label: 'Principal',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/services', label: 'Serviços', icon: Server },
      { path: '/alerts', label: 'Alertas', icon: Bell },
    ],
  },
  {
    label: 'Análise',
    items: [
      { path: '/reports', label: 'Relatórios', icon: BarChart3 },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { path: '/settings', label: 'Configurações', icon: Settings },
      { path: '/connections', label: 'Conexões', icon: KeyRound },
      { path: '/docs', label: 'Documentação', icon: Book },
    ],
  },
];

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  const sidebarContent = (
    <>
      <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
        <div className="p-1.5 rounded-lg bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <h1 className="font-heading font-bold text-sm text-foreground">MonitorHub</h1>
            <p className="text-[10px] font-mono text-muted-foreground">Sistema de Monitoramento</p>
          </div>
        )}
        {/* Desktop collapse toggle in header */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors ml-auto"
          title={collapsed ? 'Expandir' : 'Recolher'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
        {/* Mobile close */}
        <button onClick={() => setMobileOpen(false)} className="ml-auto md:hidden text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 p-2 space-y-4 overflow-y-auto">
        {navSections.map((section, si) => (
          <div key={si}>
            {/* Section label */}
            {!collapsed && section.label && (
              <p className="px-3 mb-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">{section.label}</p>
            )}
            {collapsed && si > 0 && (
              <div className="mx-3 mb-2 border-t border-sidebar-border" />
            )}
            <div className="space-y-0.5">
              {section.items.map(item => {
                const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                      isActive
                        ? 'bg-sidebar-accent text-primary font-semibold'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground'
                    } ${collapsed ? 'justify-center' : ''}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <div className={`flex items-center ${collapsed ? 'flex-col gap-1' : 'gap-1 justify-between'}`}>
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
            title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Sign out */}
          <button
            onClick={signOut}
            className="flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
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
