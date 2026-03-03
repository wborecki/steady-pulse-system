import { Shield } from 'lucide-react';

export function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 animate-in fade-in duration-300 bg-background">
      {/* Pulse ring + icon */}
      <div className="relative flex items-center justify-center">
        {/* Outer pulse ring */}
        <span className="absolute h-16 w-16 rounded-full bg-primary/20 animate-ping" />
        {/* Inner steady ring */}
        <span className="absolute h-16 w-16 rounded-full bg-primary/10" />
        {/* Icon */}
        <div className="relative z-10 p-3 rounded-full bg-primary/15 border border-primary/20">
          <Shield className="h-6 w-6 text-primary animate-pulse" />
        </div>
      </div>

      {/* Text */}
      <div className="text-center space-y-1 mt-2">
        <p className="text-sm font-medium text-muted-foreground">Carregando...</p>
      </div>

      {/* Animated dots bar */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-primary/60"
            style={{
              animation: 'bounce 1.4s infinite ease-in-out',
              animationDelay: `${i * 0.16}s`,
            }}
          />
        ))}
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.4); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
