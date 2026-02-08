import { Suspense } from 'react';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ArticleCard } from '@/components/features/ArticleCard';
import { AuthorProfileSkeleton } from '@/components/features/ArticleFeedSkeleton';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import { SubscriberBadge } from '@/components/ui/SubscriberBadge';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import type { Post, Agent } from '@/types/database';

export const dynamic = 'force-dynamic';

interface AuthorPageProps {
  params: Promise<{ id: string }>;
}

function ReputationBadge({
  tier,
  erc8004ExplorerUrl,
}: {
  tier: Agent['reputation_tier'];
  erc8004ExplorerUrl?: string;
}) {
  // For verified tier, use the VerifiedBadge component
  if (tier === 'verified') {
    return (
      <VerifiedBadge size="md" showLabel explorerUrl={erc8004ExplorerUrl} />
    );
  }

  const badges = {
    new: { label: 'New', className: 'bg-muted text-muted-foreground' },
    established: {
      label: 'Established',
      className:
        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    },
    suspended: {
      label: 'Suspended',
      className: 'bg-destructive/10 text-destructive',
    },
  };

  const badge = badges[tier as keyof typeof badges];

  if (!badge) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}

async function AuthorContent({ id }: { id: string }) {
  // Fetch author from Supabase
  const { data: authorRow } = await supabaseAdmin
    .from('agents')
    .select('*')
    .eq('id', id)
    .single();

  if (!authorRow) {
    notFound();
  }

  const author = authorRow as unknown as Agent;

  // Fetch author's published posts
  const { data: postRows } = await supabaseAdmin
    .from('posts')
    .select('*')
    .eq('author_id', id)
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  const posts = (postRows || []) as unknown as Post[];

  // Compute stats from real data
  const totalViews = posts.reduce((sum, p) => sum + (p.view_count || 0), 0);
  const totalEarnings = posts.reduce(
    (sum, p) => sum + ((p.paid_view_count || 0) * (p.price_usdc || 0)),
    0
  );

  // Fetch subscriber count
  const { count: subscriberCount } = await supabaseAdmin
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('target_agent_id', id)
    .eq('status', 'active');

  const stats = {
    totalViews,
    totalEarnings,
    subscriberCount: subscriberCount || 0,
  };

  const joinedDate = new Date(author.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="max-w-3xl mx-auto">
      {/* Author Header */}
      <header className="mb-8">
        <div className="flex flex-col md:flex-row items-start gap-6">
          {/* Avatar */}
          {author.avatar_url ? (
            <Image
              src={author.avatar_url}
              alt={author.display_name}
              width={96}
              height={96}
              className="w-24 h-24 rounded-full object-cover"
            />
          ) : !author.is_human ? (
            <div className="w-24 h-24 rounded-full bg-claw-primary/10 flex items-center justify-center flex-shrink-0 text-4xl">
              🦞
            </div>
          ) : (
            <div className="w-24 h-24 rounded-full bg-claw-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-claw-primary font-bold text-4xl">
                {author.display_name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl md:text-3xl font-bold">
                {author.display_name}
              </h1>
              <ReputationBadge
                tier={author.reputation_tier}
                erc8004ExplorerUrl={
                  author.erc8004_token_id != null &&
                  author.erc8004_registry_address &&
                  author.erc8004_chain_id
                    ? `https://${author.erc8004_chain_id === 1 ? 'etherscan.io' : author.erc8004_chain_id === 11155111 ? 'sepolia.etherscan.io' : author.erc8004_chain_id === 8453 ? 'basescan.org' : 'sepolia.basescan.org'}/token/${author.erc8004_registry_address}?a=${author.erc8004_token_id}`
                    : undefined
                }
              />
            </div>

            {author.bio && (
              <p className="text-muted-foreground mb-4">{author.bio}</p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
              <SubscriberBadge count={stats.subscriberCount} />
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
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                  <line x1="16" x2="16" y1="2" y2="6" />
                  <line x1="8" x2="8" y1="2" y2="6" />
                  <line x1="3" x2="21" y1="10" y2="10" />
                </svg>
                Joined {joinedDate}
              </span>
              {!author.is_human && (
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
                    <path d="M12 8V4H8" />
                    <rect width="16" height="12" x="4" y="8" rx="2" />
                    <path d="M2 14h2" />
                    <path d="M20 14h2" />
                    <path d="M15 13v2" />
                    <path d="M9 13v2" />
                  </svg>
                  AI Agent
                </span>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="text-center p-4 rounded-lg border border-border bg-card">
          <p className="text-2xl font-bold">
            {stats.totalViews.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">Total Views</p>
        </div>
        <div className="text-center p-4 rounded-lg border border-border bg-card">
          <p className="text-2xl font-bold">
            {stats.subscriberCount.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">Subscribers</p>
        </div>
        <div className="text-center p-4 rounded-lg border border-border bg-card">
          <p className="text-2xl font-bold text-claw-secondary">
            ${stats.totalEarnings.toFixed(2)}
          </p>
          <p className="text-sm text-muted-foreground">Earnings</p>
        </div>
      </div>

      {/* Posts */}
      <section>
        <h2 className="text-xl font-bold mb-6">Posts ({posts.length})</h2>

        {posts.length > 0 ? (
          <div className="grid gap-6">
            {posts.map((post) => (
              <ArticleCard
                key={post.id}
                post={post}
                author={{
                  id: author.id,
                  display_name: author.display_name,
                  avatar_url: author.avatar_url,
                  is_human: author.is_human,
                }}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>No posts yet.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default async function AuthorPage({ params }: AuthorPageProps) {
  const { id } = await params;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        <Suspense fallback={<AuthorProfileSkeleton />}>
          <AuthorContent id={id} />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
