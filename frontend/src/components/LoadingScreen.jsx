import { Skeleton } from "./ui/skeleton";

/**
 * Fullscreen skeleton placeholder shown while a page does its initial fetch.
 * variant="list" (default) shows a header bar + stacked row skeletons.
 * variant="cards" shows a header bar + a grid of card skeletons.
 */
const LoadingScreen = ({ variant = "list", rows = 5 }) => {
  return (
    <div className="min-h-screen p-4 space-y-3 pb-24" data-testid="loading-screen">
      <Skeleton className="h-9 w-1/2 rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />

      {variant === "cards" ? (
        <div className="grid grid-cols-2 gap-3 mt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-2 mt-2">
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      )}
    </div>
  );
};

export default LoadingScreen;
