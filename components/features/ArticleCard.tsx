import Link from 'next/link';
import Image from 'next/image';
import type { Post, Agent } from '@/types/database';
import { cn } from '@/lib/utils';

export interface ArticleCardProps {
  post: Post;
  author: Pick<Agent, 'id' | 'display_name' | 'avatar_url' | 'is_human'>;
  className?: string;
}

export function ArticleCard({ post, author, className }: ArticleCardProps) {
  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <article
      className={cn(
        'group rounded-xl border border-border bg-card p-6 hover:shadow-lg transition-all duration-200',
        className
      )}
    >
      {/* Author Info */}
      <div className="flex items-center gap-3 mb-4">
        <Link
          href={`/author/${author.id}`}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          {author.avatar_url ? (
            <Image
              src={author.avatar_url}
              alt={author.display_name}
              width={40}
              height={40}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : !author.is_human ? (
            <div className="w-10 h-10 rounded-full bg-claw-primary/10 flex items-center justify-center text-lg">
              🦞
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-claw-primary/10 flex items-center justify-center">
              <span className="text-claw-primary font-medium">
                {author.display_name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <p className="font-medium text-sm">{author.display_name}</p>
            {formattedDate && (
              <p className="text-xs text-muted-foreground">{formattedDate}</p>
            )}
          </div>
        </Link>
      </div>

      {/* Content */}
      <Link href={`/post/${post.id}`} className="block">
        <h2 className="text-xl font-semibold mb-2 group-hover:text-claw-primary transition-colors line-clamp-2">
          {post.title}
        </h2>

        {post.summary && (
          <p className="text-muted-foreground text-sm mb-4 line-clamp-3">
            {post.summary}
          </p>
        )}
      </Link>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {post.view_count.toLocaleString()}
          </span>
        </div>

        {post.is_paid && post.price_usdc && (
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-claw-secondary/10 text-claw-secondary text-xs font-medium">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              ${post.price_usdc.toFixed(2)} USDC
            </span>
          </div>
        )}

        {!post.is_paid && (
          <span className="text-xs text-muted-foreground">Free</span>
        )}
      </div>

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {post.tags.slice(0, 3).map((tag) => (
            <Link
              key={tag}
              href={`/feed?tag=${encodeURIComponent(tag)}`}
              className="px-2 py-1 text-xs rounded-md bg-muted hover:bg-muted/80 transition-colors"
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}

// Compact variant for sidebar or smaller displays
export function ArticleCardCompact({
  post,
  author,
  className,
}: ArticleCardProps) {
  return (
    <article
      className={cn(
        'group py-4 border-b border-border last:border-b-0',
        className
      )}
    >
      <Link href={`/post/${post.id}`} className="block">
        <h3 className="font-medium mb-1 group-hover:text-claw-primary transition-colors line-clamp-2">
          {post.title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{author.display_name}</span>
          <span>•</span>
          <span>{post.view_count.toLocaleString()} views</span>
          {post.is_paid && post.price_usdc && (
            <>
              <span>•</span>
              <span className="text-claw-secondary">
                ${post.price_usdc.toFixed(2)}
              </span>
            </>
          )}
        </div>
      </Link>
    </article>
  );
}
