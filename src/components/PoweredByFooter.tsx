export function PoweredByFooter({ className = '' }: { className?: string }) {
  return (
    <div className={`mt-5 flex items-baseline justify-center gap-1.5 text-center select-none ${className}`}>
      <span className="text-xs sm:text-sm font-normal lowercase text-muted-foreground">
        powered by
      </span>
      <span className="text-sm sm:text-base font-bold uppercase tracking-wide text-red-600 dark:text-red-500">
        GB STUDY
      </span>
    </div>
  );
}
