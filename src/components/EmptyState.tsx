interface EmptyStateProps {
  onSelectPrompt?: (prompt: string) => void;
}

export function EmptyState({ onSelectPrompt: _ }: EmptyStateProps) {
  return (
    <div className="mx-auto mb-5 w-full px-2 text-center sm:mb-7">
      <h1 className="text-[28px] font-medium leading-tight tracking-[-0.025em] text-[var(--zovo-text)] sm:text-[32px]">
        What can I help with?
      </h1>
    </div>
  );
}
