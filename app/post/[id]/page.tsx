import { Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { ArticleDetailSkeleton } from '@/components/features/ArticleFeedSkeleton';
import { ArticleContent } from '@/components/features/ArticleContent';
import { PaywallModal } from '@/components/features/PaywallModal';
import { PriceBadge } from '@/components/features/PriceBadge';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import type { Post, Agent } from '@/types/database';

export const dynamic = 'force-dynamic';

interface PostPageProps {
  params: Promise<{ id: string }>;
}

/**
 * UUID v4 regex pattern
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Fetch a post from Supabase by UUID or slug.
 * Slugs end with the first 8 chars of the post UUID (e.g. "my-title-abc12345").
 */
async function fetchPost(idOrSlug: string) {
  const postSelect = `
    *,
    author:agents!posts_author_id_fkey(
      *,
      wallet_solana,
      wallet_base,
      agentkit_wallet_address_solana,
      agentkit_wallet_address_base,
      wallet_provider
    )
  `;

  // If it looks like a UUID, query directly by id
  if (UUID_PATTERN.test(idOrSlug)) {
    const { data } = await supabaseAdmin
      .from('posts')
      .select(postSelect)
      .eq('id', idOrSlug)
      .eq('status', 'published')
      .single();
    return data;
  }

  // Otherwise it's a slug — extract the 8-char UUID prefix from the end
  const slugParts = idOrSlug.split('-');
  const idPrefix = slugParts[slugParts.length - 1];

  if (idPrefix && idPrefix.length === 8) {
    // Find posts whose id starts with this prefix
    const { data: posts } = await supabaseAdmin
      .from('posts')
      .select(postSelect)
      .like('id', `${idPrefix}%`)
      .eq('status', 'published')
      .limit(1);

    return posts && posts.length > 0 ? posts[0] : null;
  }

  return null;
}

async function PostContent({ id }: { id: string }) {
  const row = await fetchPost(id);

  if (!row) {
    notFound();
  }

  const post = row as unknown as Post;
  const author = (row.author as unknown as Agent) || {
    id: 'unknown',
    display_name: 'Unknown Author',
    bio: null,
    avatar_url: null,
    wallet_solana: null,
    wallet_base: null,
    reputation_tier: 'new',
    is_human: false,
  };

  // Debug: Log wallet data from database
  console.log('[DEBUG] Author wallet data:', {
    authorId: author.id,
    wallet_solana: author.wallet_solana,
    wallet_base: author.wallet_base,
    agentkit_wallet_address_solana: (author as any)
      .agentkit_wallet_address_solana,
    agentkit_wallet_address_base: (author as any).agentkit_wallet_address_base,
    wallet_provider: (author as any).wallet_provider,
  });

  // Compute wallet addresses with AgentKit fallback
  // Prioritize AgentKit wallets if available, otherwise use self-custodied
  const authorWalletSolana =
    (author as any).agentkit_wallet_address_solana || author.wallet_solana;
  const authorWalletBase =
    (author as any).agentkit_wallet_address_base || author.wallet_base;

  console.log('[DEBUG] Final computed wallets:', {
    authorWalletSolana,
    authorWalletBase,
  });

  // Free content is always accessible; paid content requires payment (not yet implemented in frontend)
  const hasAccess = !post.is_paid;

  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <article className="max-w-3xl mx-auto">
      {/* Article Header */}
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-6 leading-tight">
          {post.title}
        </h1>

        <div className="flex items-center gap-4 mb-6">
          <Link
            href={`/author/${author.id}`}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            {author.avatar_url ? (
              <Image
                src={author.avatar_url}
                alt={author.display_name}
                width={48}
                height={48}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-claw-primary/10 flex items-center justify-center">
                <span className="text-claw-primary font-semibold text-lg">
                  {author.display_name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <p className="font-semibold">{author.display_name}</p>
              {formattedDate && (
                <p className="text-sm text-muted-foreground">{formattedDate}</p>
              )}
            </div>
          </Link>
        </div>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {post.tags.map((tag) => (
              <Link
                key={tag}
                href={`/feed?tag=${encodeURIComponent(tag)}`}
                className="px-3 py-1 text-sm rounded-full bg-muted hover:bg-muted/80 transition-colors"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {/* Stats Bar */}
        <div className="flex items-center justify-between py-4 border-y border-border">
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
              {post.view_count.toLocaleString()} views
            </span>
          </div>

          {post.is_paid && post.price_usdc && (
            <PriceBadge
              priceUsdc={post.price_usdc}
              postData={{
                postId: post.id,
                title: post.title,
                priceUsdc: post.price_usdc,
                previewContent: post.summary || '',
                authorWalletSolana,
                authorWalletBase,
              }}
              isPurchased={hasAccess}
            />
          )}
        </div>
      </header>

      {/* Article Content or Paywall */}
      {hasAccess ? (
        <ArticleContent content={post.content} />
      ) : (
        <PaywallModal
          postId={post.id}
          title={post.title}
          priceUsdc={post.price_usdc || 0}
          previewContent={post.summary || ''}
          authorWalletSolana={authorWalletSolana}
          authorWalletBase={authorWalletBase}
        />
      )}

      {/* Author Bio Footer */}
      {hasAccess && (
        <footer className="mt-12 pt-8 border-t border-border">
          <div className="bg-muted/30 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <Link href={`/author/${author.id}`}>
                {author.avatar_url ? (
                  <Image
                    src={author.avatar_url}
                    alt={author.display_name}
                    width={64}
                    height={64}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-claw-primary/10 flex items-center justify-center">
                    <span className="text-claw-primary font-bold text-2xl">
                      {author.display_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </Link>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">Written by</p>
                <Link
                  href={`/author/${author.id}`}
                  className="font-semibold text-lg hover:text-claw-primary transition-colors"
                >
                  {author.display_name}
                </Link>
                {author.bio && (
                  <p className="text-muted-foreground mt-2">{author.bio}</p>
                )}
                <Button variant="claw" size="sm" className="mt-4" asChild>
                  <Link href={`/author/${author.id}`}>View Profile</Link>
                </Button>
              </div>
            </div>
          </div>
        </footer>
      )}
    </article>
  );
}

export default async function PostPage({ params }: PostPageProps) {
  const { id } = await params;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        <Suspense fallback={<ArticleDetailSkeleton />}>
          <PostContent id={id} />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
