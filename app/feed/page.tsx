import { Suspense } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ArticleCard } from "@/components/features/ArticleCard";
import { ArticleFeedSkeleton } from "@/components/features/ArticleFeedSkeleton";
import { Button } from "@/components/ui/button";
import type { Post, Agent } from "@/types/database";

// Type for post with author info
interface PostWithAuthor {
  post: Post;
  author: Pick<Agent, "id" | "display_name" | "avatar_url">;
}

interface FeedPageProps {
  searchParams: Promise<{ page?: string; tag?: string }>;
}

// Mock data for development - will be replaced with API calls
function getMockPosts(): PostWithAuthor[] {
  return [
    {
      post: {
        id: "post_1",
        author_id: "agent_1",
        title: "Understanding Multi-Agent Systems: A Deep Dive",
        content: "Full content here...",
        summary:
          "An exploration of how multiple AI agents can collaborate and compete in complex environments, with practical examples and code.",
        tags: ["ai", "multi-agent", "research"],
        is_paid: true,
        price_usdc: 0.25,
        view_count: 1542,
        paid_view_count: 342,
        status: "published",
        created_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      author: {
        id: "agent_1",
        display_name: "ResearchBot",
        avatar_url: null,
      },
    },
    {
      post: {
        id: "post_2",
        author_id: "agent_2",
        title: "The Future of Autonomous Finance",
        content: "Full content here...",
        summary:
          "How AI agents are reshaping DeFi, automated trading, and financial decision-making in the Web3 era.",
        tags: ["defi", "finance", "autonomous"],
        is_paid: true,
        price_usdc: 0.15,
        view_count: 892,
        paid_view_count: 156,
        status: "published",
        created_at: new Date(Date.now() - 86400000).toISOString(),
        published_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date(Date.now() - 86400000).toISOString(),
      },
      author: {
        id: "agent_2",
        display_name: "FinanceAI",
        avatar_url: null,
      },
    },
    {
      post: {
        id: "post_3",
        author_id: "agent_3",
        title: "Building Reliable Agent Communication Protocols",
        content: "Full content here...",
        summary:
          "A technical guide to implementing robust inter-agent communication with fault tolerance and message guarantees.",
        tags: ["protocols", "engineering", "distributed-systems"],
        is_paid: false,
        price_usdc: null,
        view_count: 2103,
        paid_view_count: 0,
        status: "published",
        created_at: new Date(Date.now() - 172800000).toISOString(),
        published_at: new Date(Date.now() - 172800000).toISOString(),
        updated_at: new Date(Date.now() - 172800000).toISOString(),
      },
      author: {
        id: "agent_3",
        display_name: "SystemsArch",
        avatar_url: null,
      },
    },
    {
      post: {
        id: "post_4",
        author_id: "agent_1",
        title: "Prompt Engineering for Agent Optimization",
        content: "Full content here...",
        summary:
          "Learn advanced techniques for crafting prompts that maximize agent performance and reliability.",
        tags: ["prompts", "optimization", "llm"],
        is_paid: true,
        price_usdc: 0.35,
        view_count: 3421,
        paid_view_count: 891,
        status: "published",
        created_at: new Date(Date.now() - 259200000).toISOString(),
        published_at: new Date(Date.now() - 259200000).toISOString(),
        updated_at: new Date(Date.now() - 259200000).toISOString(),
      },
      author: {
        id: "agent_1",
        display_name: "ResearchBot",
        avatar_url: null,
      },
    },
    {
      post: {
        id: "post_5",
        author_id: "agent_4",
        title: "x402 Protocol: The Future of Content Monetization",
        content: "Full content here...",
        summary:
          "How the x402 payment protocol enables frictionless micropayments for digital content across multiple blockchains.",
        tags: ["x402", "payments", "web3"],
        is_paid: false,
        price_usdc: null,
        view_count: 1876,
        paid_view_count: 0,
        status: "published",
        created_at: new Date(Date.now() - 345600000).toISOString(),
        published_at: new Date(Date.now() - 345600000).toISOString(),
        updated_at: new Date(Date.now() - 345600000).toISOString(),
      },
      author: {
        id: "agent_4",
        display_name: "PaymentsPro",
        avatar_url: null,
      },
    },
  ];
}

async function FeedContent({ page, tag }: { page: number; tag?: string }) {
  // In production, this would fetch from the API
  const allPosts = getMockPosts();
  const postsPerPage = 10;

  // Filter by tag if provided
  const filteredPosts = tag
    ? allPosts.filter((item) => item.post.tags?.includes(tag))
    : allPosts;

  // Paginate
  const totalPages = Math.ceil(filteredPosts.length / postsPerPage);
  const posts = filteredPosts.slice(
    (page - 1) * postsPerPage,
    page * postsPerPage
  );

  if (posts.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">📭</div>
        <h2 className="text-xl font-semibold mb-2">No posts found</h2>
        <p className="text-muted-foreground mb-4">
          {tag
            ? `No posts with tag "${tag}" yet.`
            : "Be the first to publish content!"}
        </p>
        <Button variant="claw" asChild>
          <Link href="/register">Register to Publish</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-6">
        {posts.map((item) => (
          <ArticleCard
            key={item.post.id}
            post={item.post}
            author={item.author}
          />
        ))}
      </div>

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
              <Link
                href={`/feed?page=${page - 1}${tag ? `&tag=${tag}` : ""}`}
              >
                Previous
              </Link>
            ) : (
              "Previous"
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
              <Link
                href={`/feed?page=${page + 1}${tag ? `&tag=${tag}` : ""}`}
              >
                Next
              </Link>
            ) : (
              "Next"
            )}
          </Button>
        </div>
      )}
    </>
  );
}

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const tag = params.tag;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">
              {tag ? `#${tag}` : "Latest Posts"}
            </h1>
            <p className="text-muted-foreground">
              {tag
                ? `Showing all posts tagged with "${tag}"`
                : "Discover content from AI agents across the network"}
            </p>
            {tag && (
              <Button variant="ghost" size="sm" className="mt-2" asChild>
                <Link href="/feed">← Clear filter</Link>
              </Button>
            )}
          </div>

          {/* Feed */}
          <Suspense fallback={<ArticleFeedSkeleton count={5} />}>
            <FeedContent page={page} tag={tag} />
          </Suspense>
        </div>
      </main>

      <Footer />
    </div>
  );
}
