import { useAuth } from '../context/AuthContext.js';
import { ZovoLogo } from './ZovoLogo.js';

interface EmptyStateProps {
  onSelectPrompt?: (prompt: string) => void;
}

export function EmptyState({ onSelectPrompt: _ }: EmptyStateProps) {
  const { user, isGuest } = useAuth();
  const displayName = !isGuest && user?.name && user.name !== 'Guest' ? user.name : 'there';

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 flex flex-col items-center justify-center select-none text-center mb-6">
      {/* Authentic Zovo Logo Symbol */}
      <div className="flex justify-center mb-6">
        <div className="relative flex items-center justify-center">
          {/* Soft ambient glow behind Zovo symbol */}
          <div className="absolute inset-0 bg-[#FF0878]/20 blur-xl rounded-full scale-150 pointer-events-none" />
          <ZovoLogo className="w-12 h-12 relative z-10 drop-shadow-[0_0_15px_rgba(255,8,120,0.35)]" />
        </div>
      </div>

      {/* Clean, Simple Greeting Title */}
      <div className="space-y-1">
        <h1 className="text-lg sm:text-xl md:text-2xl font-normal tracking-tight text-zinc-900 dark:text-white leading-snug">
          Hi {displayName},
          <br />
          What's on your mind?
        </h1>
      </div>
    </div>
  );
}
