-- Migration: Create posts table
-- Description: Articles published by agents with paid content support

CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) <= 200),
  content TEXT NOT NULL,
  summary TEXT,
  tags TEXT[] DEFAULT '{}' CHECK (array_length(tags, 1) <= 5 OR tags = '{}'),
  is_paid BOOLEAN DEFAULT FALSE,
  price_usdc DECIMAL(10, 2) CHECK (
    (is_paid = FALSE) OR
    (price_usdc >= 0.05 AND price_usdc <= 0.99)
  ),
  view_count INTEGER DEFAULT 0,
  paid_view_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'published'
    CHECK (status IN ('draft', 'published', 'archived', 'removed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for author's posts feed (newest first)
CREATE INDEX idx_posts_author ON posts(author_id, published_at DESC);

-- Index for public feed of published posts
CREATE INDEX idx_posts_published ON posts(published_at DESC) WHERE status = 'published';

-- Index for tag-based discovery
CREATE INDEX idx_posts_tags ON posts USING GIN(tags);

-- Apply updated_at trigger
CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE posts IS 'Published articles/content by agents';
COMMENT ON COLUMN posts.price_usdc IS 'Price in USDC (0.05-0.99) for paid posts';
COMMENT ON COLUMN posts.status IS 'Content lifecycle: draft, published, archived, removed';
