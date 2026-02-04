import { cn } from "@/lib/utils";

interface ArticleFeedSkeletonProps {
  count?: number;
  className?: string;
}

export function ArticleFeedSkeleton({
  count = 5,
  className,
}: ArticleFeedSkeletonProps) {
  return (
    <div className={cn("grid gap-6", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <ArticleCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ArticleCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 animate-pulse">
      {/* Author skeleton */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-muted" />
        <div className="space-y-2">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-3 w-16 bg-muted rounded" />
        </div>
      </div>

      {/* Title skeleton */}
      <div className="h-6 w-3/4 bg-muted rounded mb-2" />

      {/* Summary skeleton */}
      <div className="space-y-2 mb-4">
        <div className="h-4 w-full bg-muted rounded" />
        <div className="h-4 w-5/6 bg-muted rounded" />
        <div className="h-4 w-2/3 bg-muted rounded" />
      </div>

      {/* Footer skeleton */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="h-4 w-16 bg-muted rounded" />
        <div className="h-6 w-20 bg-muted rounded" />
      </div>

      {/* Tags skeleton */}
      <div className="flex gap-2 mt-4">
        <div className="h-6 w-12 bg-muted rounded" />
        <div className="h-6 w-16 bg-muted rounded" />
        <div className="h-6 w-14 bg-muted rounded" />
      </div>
    </div>
  );
}

export function ArticleDetailSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="h-10 w-3/4 bg-muted rounded mb-4" />
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-full bg-muted" />
          <div className="space-y-2">
            <div className="h-5 w-32 bg-muted rounded" />
            <div className="h-4 w-24 bg-muted rounded" />
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="space-y-4">
        <div className="h-4 w-full bg-muted rounded" />
        <div className="h-4 w-full bg-muted rounded" />
        <div className="h-4 w-5/6 bg-muted rounded" />
        <div className="h-4 w-full bg-muted rounded" />
        <div className="h-4 w-4/5 bg-muted rounded" />
        <div className="h-24 w-full bg-muted rounded my-6" />
        <div className="h-4 w-full bg-muted rounded" />
        <div className="h-4 w-full bg-muted rounded" />
        <div className="h-4 w-3/4 bg-muted rounded" />
      </div>
    </div>
  );
}

export function AuthorProfileSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Author header skeleton */}
      <div className="flex items-start gap-6 mb-8">
        <div className="w-24 h-24 rounded-full bg-muted" />
        <div className="flex-1 space-y-3">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-4 w-full max-w-md bg-muted rounded" />
          <div className="h-4 w-2/3 max-w-md bg-muted rounded" />
          <div className="flex gap-4 mt-4">
            <div className="h-10 w-24 bg-muted rounded" />
            <div className="h-10 w-24 bg-muted rounded" />
          </div>
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="text-center p-4 rounded-lg border border-border">
            <div className="h-8 w-16 bg-muted rounded mx-auto mb-2" />
            <div className="h-4 w-12 bg-muted rounded mx-auto" />
          </div>
        ))}
      </div>

      {/* Posts skeleton */}
      <ArticleFeedSkeleton count={3} />
    </div>
  );
}
