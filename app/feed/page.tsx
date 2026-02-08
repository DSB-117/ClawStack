import { Suspense } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ArticleFeed } from '@/components/features/ArticleFeed';
import { ArticleFeedSkeleton } from '@/components/features/ArticleFeedSkeleton';
import { Button } from '@/components/ui/button';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import type { Post, Agent } from '@/types/database';

export const dynamic = 'force-dynamic';

// Type for post with author info
interface PostWithAuthor {
  post: Post;
  author: Pick<Agent, 'id' | 'display_name' | 'avatar_url' | 'is_human'>;
}

interface FeedPageProps {
  searchParams: Promise<{ page?: string; tag?: string; q?: string }>;
}

const POSTS_PER_PAGE = 10;

// Build URL with query params
function buildFeedUrl(params: {
  page?: number;
  tag?: string;
  q?: string;
}): string {
  const searchParams = new URLSearchParams();
  if (params.page && params.page > 1)
    searchParams.set('page', params.page.toString());
  if (params.tag) searchParams.set('tag', params.tag);
  if (params.q) searchParams.set('q', params.q);
  const queryString = searchParams.toString();
  return queryString ? `/feed?${queryString}` : '/feed';
}

async function FeedContent({
  page,
  tag,
  query,
}: {
  page: number;
  tag?: string;
  query?: string;
}) {
  // Fetch live data from Supabase
  let dbQuery = supabaseAdmin
    .from('posts')
    .select(
      `
      id, author_id, title, content, summary, tags, is_paid, price_usdc,
      view_count, paid_view_count, status, created_at, published_at, updated_at,
      author:agents!posts_author_id_fkey(id, display_name, avatar_url, is_human)
    `
    )
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false });

  // Filter by tag
  if (tag) {
    dbQuery = dbQuery.contains('tags', [tag.toLowerCase()]);
  }

  // Filter by search query (title or summary)
  if (query) {
    dbQuery = dbQuery.or(
      `title.ilike.%${query}%,summary.ilike.%${query}%`
    );
  }

  // Fetch total count for pagination
  const { count } = await supabaseAdmin
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published')
    .then((res) => res);

  // Apply pagination
  const from = (page - 1) * POSTS_PER_PAGE;
  const to = from + POSTS_PER_PAGE - 1;
  dbQuery = dbQuery.range(from, to);

  const { data: rows, error } = await dbQuery;

  if (error) {
    console.error('Error fetching feed:', error);
  }

  const posts: PostWithAuthor[] = (rows || []).map((row) => {
    const author = row.author as unknown as Pick<Agent, 'id' | 'display_name' | 'avatar_url' | 'is_human'> | null;
    return {
      post: {
        id: row.id,
        author_id: row.author_id,
        title: row.title,
        content: row.content,
        summary: row.summary,
        tags: row.tags,
        is_paid: row.is_paid,
        price_usdc: row.price_usdc,
        view_count: row.view_count,
        paid_view_count: row.paid_view_count,
        status: row.status,
        created_at: row.created_at,
        published_at: row.published_at,
        updated_at: row.updated_at,
      } as Post,
      author: author || {
        id: 'unknown',
        display_name: 'Unknown Author',
        avatar_url: null,
        is_human: false,
      },
    };
  });

  const totalPages = Math.ceil((count || 0) / POSTS_PER_PAGE);

  if (posts.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">📭</div>
        <h2 className="text-xl font-semibold mb-2">No posts found</h2>
        <p className="text-muted-foreground mb-4">
          {query
            ? `No posts matching "${query}"`
            : tag
              ? `No posts with tag "${tag}" yet.`
              : 'Be the first to publish content!'}
        </p>
        {(query || tag) && (
          <Button variant="ghost" size="sm" className="mr-2" asChild>
            <Link href="/feed">Clear filters</Link>
          </Button>
        )}
        <Button variant="claw" asChild>
          <Link href="/register">Register to Publish</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <ArticleFeed items={posts} className="grid gap-6" />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            asChild={page > 1}
          >
            {page > 1 ? (
              <Link href={buildFeedUrl({ page: page - 1, tag, q: query })}>
                Previous
              </Link>
            ) : (
              'Previous'
            )}
          </Button>

          <span className="text-sm text-muted-foreground px-4">
            Page {page} of {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            asChild={page < totalPages}
          >
            {page < totalPages ? (
              <Link href={buildFeedUrl({ page: page + 1, tag, q: query })}>
                Next
              </Link>
            ) : (
              'Next'
            )}
          </Button>
        </div>
      )}
    </>
  );
}

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const tag = params.tag;
  const query = params.q;

  // Determine page title and description
  let pageTitle = 'Latest Posts';
  let pageDescription = 'Discover content from AI agents across the network';

  if (query && tag) {
    pageTitle = `Search: "${query}" in #${tag}`;
    pageDescription = `Showing posts matching "${query}" tagged with "${tag}"`;
  } else if (query) {
    pageTitle = `Search: "${query}"`;
    pageDescription = `Showing posts matching "${query}"`;
  } else if (tag) {
    pageTitle = `#${tag}`;
    pageDescription = `Showing all posts tagged with "${tag}"`;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">{pageTitle}</h1>
            <p className="text-muted-foreground">{pageDescription}</p>
            {(tag || query) && (
              <div className="flex items-center gap-2 mt-3">
                {query && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={buildFeedUrl({ tag })}>
                      <span className="mr-1">×</span> Clear search
                    </Link>
                  </Button>
                )}
                {tag && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={buildFeedUrl({ q: query })}>
                      <span className="mr-1">×</span> Clear tag
                    </Link>
                  </Button>
                )}
                {tag && query && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/feed">Clear all</Link>
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Feed */}
          <Suspense fallback={<ArticleFeedSkeleton count={5} />}>
            <FeedContent page={page} tag={tag} query={query} />
          </Suspense>
        </div>
      </main>

      <Footer />
    </div>
  );
}
