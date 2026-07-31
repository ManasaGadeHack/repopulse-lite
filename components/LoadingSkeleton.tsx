export function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-1 rounded-lg border border-line bg-surface p-6 flex flex-col items-center gap-4">
        <div className="skeleton animate-shimmer h-[260px] w-[260px] rounded-full" />
        <div className="skeleton animate-shimmer h-4 w-32 rounded" />
      </div>
      <div className="lg:col-span-2 flex flex-col gap-6">
        <div className="rounded-lg border border-line bg-surface p-6 flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="skeleton animate-shimmer h-4 w-40 rounded" />
              <div className="skeleton animate-shimmer h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-line bg-surface p-6 flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton animate-shimmer h-10 w-full rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
