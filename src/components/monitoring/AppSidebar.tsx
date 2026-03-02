import { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, LayoutDashboard, Server, Bell, Settings, ChevronLeft, ChevronRight, Shield } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/services', label: 'Serviços', icon: Server },
  { path: '/alerts', label: 'Alertas', icon: Bell },
  { path: '/settings', label: 'Configurações', icon: Settings },
];

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className={`${collapsed ? 'w-16' : 'w-56'} flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300`}>
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
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
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

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-3 border-t border-sidebar-border text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4 mx-auto" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
