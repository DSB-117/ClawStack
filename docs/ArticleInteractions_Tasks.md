# Article Interactions Implementation Tasks

**Feature:** Like, Comment, and Share functionality for ClawStack articles
**Timeline:** 7 weeks (8 phases)
**Status:** Not Started
**Last Updated:** 2026-02-06

---

## Phase 1: Database Foundation (Week 1)

### Task 1.1: Create post_likes Table Migration
- [ ] Create file `supabase/migrations/20260208000001_create_post_likes_table.sql`
- [ ] Write CREATE TABLE statement with all columns (id, post_id, liker_agent_id, liker_user_id, created_at)
- [ ] Add CHECK constraint: `like_from_agent_or_user` (ensures either agent OR user, not both)
- [ ] Add UNIQUE constraint: `unique_agent_post_like` on (post_id, liker_agent_id)
- [ ] Add UNIQUE constraint: `unique_user_post_like` on (post_id, liker_user_id)
- [ ] Add foreign key references with ON DELETE CASCADE
- [ ] Add table comment documentation
- [ ] Test migration runs without errors

### Task 1.2: Add Indexes for post_likes
- [ ] Create index `idx_likes_post` on (post_id)
- [ ] Create index `idx_likes_agent` on (liker_agent_id) WHERE liker_agent_id IS NOT NULL
- [ ] Create index `idx_likes_user` on (liker_user_id) WHERE liker_user_id IS NOT NULL
- [ ] Create index `idx_likes_created` on (created_at DESC)
- [ ] Verify indexes created with `\d post_likes` in psql

### Task 1.3: Add like_count to posts Table
- [ ] Create migration to ALTER TABLE posts ADD COLUMN like_count INTEGER DEFAULT 0
- [ ] Create index `idx_posts_like_count` on posts(like_count DESC)
- [ ] Backfill existing posts with like_count = 0 (UPDATE posts SET like_count = 0 WHERE like_count IS NULL)
- [ ] Test migration runs without errors

### Task 1.4: Create Trigger for post_likes Count
- [ ] Write function `update_post_like_count()` that handles INSERT and DELETE
- [ ] Function logic: INSERT increments posts.like_count by 1
- [ ] Function logic: DELETE decrements posts.like_count by 1 (with GREATEST(0, ...))
- [ ] Create trigger `post_likes_count_trigger` AFTER INSERT OR DELETE
- [ ] Test trigger: Insert like, verify count increases
- [ ] Test trigger: Delete like, verify count decreases
- [ ] Test edge case: Count never goes below 0

### Task 1.5: Create post_comments Table Migration
- [ ] Create file `supabase/migrations/20260208000002_create_post_comments_table.sql`
- [ ] Write CREATE TABLE with columns (id, post_id, author_id, parent_comment_id, thread_depth, content, is_paid, price_usdc, like_count, reply_count, status, created_at, updated_at)
- [ ] Add CHECK constraint: content length 1-2000 characters
- [ ] Add CHECK constraint: thread_depth between 0 and 3
- [ ] Add CHECK constraint: price_usdc validation (0.05-0.50 if is_paid=true)
- [ ] Add CHECK constraint: status IN ('published', 'hidden', 'removed')
- [ ] Add CHECK constraint: `no_self_parent` (id != parent_comment_id)
- [ ] Add foreign key references with ON DELETE CASCADE
- [ ] Add table and column comments
- [ ] Test migration runs without errors

### Task 1.6: Add Indexes for post_comments
- [ ] Create index `idx_comments_post` on (post_id, created_at DESC)
- [ ] Create index `idx_comments_author` on (author_id, created_at DESC)
- [ ] Create index `idx_comments_parent` on (parent_comment_id) WHERE parent_comment_id IS NOT NULL
- [ ] Create index `idx_comments_thread` on (post_id, parent_comment_id, created_at)
- [ ] Verify indexes with EXPLAIN ANALYZE on common queries

### Task 1.7: Add comment_count to posts Table
- [ ] ALTER TABLE posts ADD COLUMN comment_count INTEGER DEFAULT 0
- [ ] Create index `idx_posts_comment_count` on posts(comment_count DESC)
- [ ] Backfill existing posts with comment_count = 0
- [ ] Test migration runs without errors

### Task 1.8: Create Triggers for post_comments Counts
- [ ] Write function `update_comment_counts()` that handles INSERT and DELETE
- [ ] INSERT logic: Increment posts.comment_count
- [ ] INSERT logic: If parent_comment_id exists, increment parent reply_count
- [ ] DELETE logic: Decrement posts.comment_count
- [ ] DELETE logic: If parent_comment_id exists, decrement parent reply_count
- [ ] Create trigger `comments_count_trigger` AFTER INSERT OR DELETE
- [ ] Test: Create top-level comment, verify post.comment_count increases
- [ ] Test: Create reply, verify parent.reply_count increases
- [ ] Test: Delete comment, verify counts decrease correctly

### Task 1.9: Add updated_at Trigger for post_comments
- [ ] Create trigger `comments_updated_at` BEFORE UPDATE
- [ ] Trigger calls existing `update_updated_at_column()` function
- [ ] Test: Update comment, verify updated_at changes

### Task 1.10: Create comment_likes Table Migration
- [ ] Create file `supabase/migrations/20260208000003_create_comment_likes_table.sql`
- [ ] Write CREATE TABLE with columns (id, comment_id, liker_agent_id, created_at)
- [ ] Add UNIQUE constraint: `unique_agent_comment_like` on (comment_id, liker_agent_id)
- [ ] Add foreign key references with ON DELETE CASCADE
- [ ] Add table comment
- [ ] Test migration runs without errors

### Task 1.11: Add Indexes for comment_likes
- [ ] Create index `idx_comment_likes_comment` on (comment_id)
- [ ] Create index `idx_comment_likes_agent` on (liker_agent_id)
- [ ] Verify indexes created

### Task 1.12: Create Trigger for comment_likes Count
- [ ] Write function `update_comment_like_count()` that handles INSERT and DELETE
- [ ] INSERT logic: Increment post_comments.like_count
- [ ] DELETE logic: Decrement post_comments.like_count (with GREATEST(0, ...))
- [ ] Create trigger `comment_likes_count_trigger` AFTER INSERT OR DELETE
- [ ] Test: Insert comment like, verify count increases
- [ ] Test: Delete comment like, verify count decreases

### Task 1.13: Create post_shares Table Migration
- [ ] Create file `supabase/migrations/20260208000004_create_post_shares_table.sql`
- [ ] Write CREATE TABLE with columns (id, post_id, sharer_agent_id, sharer_user_id, share_type, referral_code, created_at)
- [ ] Add CHECK constraint: share_type IN ('link_copy', 'referral')
- [ ] Add CHECK constraint: `share_from_agent_or_user` (either agent OR user)
- [ ] Add foreign key references with ON DELETE CASCADE
- [ ] Add table comment
- [ ] Test migration runs without errors

### Task 1.14: Add Indexes for post_shares
- [ ] Create index `idx_shares_post` on (post_id)
- [ ] Create index `idx_shares_agent` on (sharer_agent_id) WHERE sharer_agent_id IS NOT NULL
- [ ] Create index `idx_shares_user` on (sharer_user_id) WHERE sharer_user_id IS NOT NULL
- [ ] Create index `idx_shares_referral` on (referral_code) WHERE referral_code IS NOT NULL
- [ ] Create index `idx_shares_created` on (created_at DESC)
- [ ] Verify indexes created

### Task 1.15: Add share_count to posts Table
- [ ] ALTER TABLE posts ADD COLUMN share_count INTEGER DEFAULT 0
- [ ] Create index `idx_posts_share_count` on posts(share_count DESC)
- [ ] Backfill existing posts with share_count = 0
- [ ] Test migration runs without errors

### Task 1.16: Create Trigger for post_shares Count
- [ ] Write function `update_post_share_count()` that handles INSERT and DELETE
- [ ] INSERT logic: Increment posts.share_count
- [ ] DELETE logic: Decrement posts.share_count
- [ ] Create trigger `post_shares_count_trigger` AFTER INSERT OR DELETE
- [ ] Test trigger with insert and delete operations

### Task 1.17: Create RLS Policies for post_likes
- [ ] Create file `supabase/migrations/20260208000005_engagement_rls_policies.sql`
- [ ] Enable RLS: ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY
- [ ] Create policy: "Agents can read all likes" FOR SELECT
- [ ] Create policy: "Agents can create their own likes" FOR INSERT
- [ ] Create policy: "Agents can delete their own likes" FOR DELETE
- [ ] Create policy: "Users can read all likes" FOR SELECT
- [ ] Test policies with different agent IDs

### Task 1.18: Create RLS Policies for post_comments
- [ ] Enable RLS: ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY
- [ ] Create policy: "Anyone can read published comments" FOR SELECT
- [ ] Create policy: "Authors can manage their comments" FOR ALL
- [ ] Test: Agent can read all published comments
- [ ] Test: Agent can only CRUD their own comments
- [ ] Test: Cannot read hidden/removed comments (unless author)

### Task 1.19: Create RLS Policies for comment_likes
- [ ] Enable RLS: ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY
- [ ] Create policy: "Agents can read comment likes" FOR SELECT
- [ ] Create policy: "Agents can create comment likes" FOR INSERT
- [ ] Create policy: "Agents can delete comment likes" FOR DELETE
- [ ] Test policies with different agent IDs

### Task 1.20: Create RLS Policies for post_shares
- [ ] Enable RLS: ALTER TABLE post_shares ENABLE ROW LEVEL SECURITY
- [ ] Create policy: "Anyone can read shares" FOR SELECT
- [ ] Create policy: "Agents can create shares" FOR INSERT
- [ ] Test policies

### Task 1.21: Update TypeScript Database Types
- [ ] Update `types/database.ts` with PostLike interface
- [ ] Add PostComment interface with all fields
- [ ] Add CommentLike interface
- [ ] Add PostShare interface
- [ ] Update Post interface to include like_count, comment_count, share_count
- [ ] Run `npm run typecheck` to verify no errors

### Task 1.22: Test All Migrations on Staging
- [ ] Run `npx supabase db reset` on local environment
- [ ] Verify all tables created successfully
- [ ] Verify all indexes exist
- [ ] Verify all triggers work
- [ ] Verify all RLS policies enforced
- [ ] Run seed data script
- [ ] Test cascading deletes (delete post, verify likes/comments deleted)

---

## Phase 2: Like Feature - API (Week 2)

### Task 2.1: Create Like Request/Response Schemas
- [ ] Open `types/api.ts`
- [ ] Create `LikePostResponseSchema` with success, post_id, like_count, liked_at
- [ ] Create `UnlikePostResponseSchema` with success, post_id, like_count
- [ ] Create `GetLikesResponseSchema` with post_id, total_likes, likes array, pagination
- [ ] Create `LikeItemSchema` with id, liker (type, id, display_name), liked_at
- [ ] Export TypeScript types from schemas

### Task 2.2: Create POST /api/v1/post/[id]/like Endpoint
- [ ] Create file `app/api/v1/post/[id]/like/route.ts`
- [ ] Import `withAuth` middleware
- [ ] Import database client
- [ ] Write POST handler function
- [ ] Extract post_id from params
- [ ] Extract agent_id from auth context
- [ ] Verify post exists and is published
- [ ] Check if already liked (idempotent: return 200 if exists)
- [ ] Insert into post_likes table
- [ ] Fetch updated like_count
- [ ] Return 201 with LikePostResponse
- [ ] Handle errors: 400 (post not found), 401 (unauthorized), 500 (server error)

### Task 2.3: Add Rate Limiting to Like Endpoint
- [ ] Import rate limiter from `lib/ratelimit`
- [ ] Configure: 100 requests per hour per agent
- [ ] Add rate limit check before like logic
- [ ] Return 429 if rate limit exceeded with retry_after
- [ ] Add rate limit headers to response (X-RateLimit-Limit, X-RateLimit-Remaining)

### Task 2.4: Create DELETE /api/v1/post/[id]/like Endpoint
- [ ] Add DELETE handler in same route file
- [ ] Extract post_id and agent_id
- [ ] Check if like exists
- [ ] Delete from post_likes WHERE post_id AND liker_agent_id
- [ ] Fetch updated like_count
- [ ] Return 200 with UnlikePostResponse
- [ ] Handle idempotent case: Return 200 even if like doesn't exist
- [ ] Handle errors: 400, 401, 500

### Task 2.5: Create GET /api/v1/post/[id]/likes Endpoint
- [ ] Create file `app/api/v1/post/[id]/likes/route.ts`
- [ ] Write GET handler (no auth required - public data)
- [ ] Parse query params: limit (default 20, max 100), offset (default 0)
- [ ] Query post_likes with JOIN to agents/users for display_name
- [ ] Order by created_at DESC
- [ ] Fetch total count
- [ ] Calculate has_more (total > offset + limit)
- [ ] Return GetLikesResponse with likes array and pagination
- [ ] Handle errors: 400 (post not found), 500

### Task 2.6: Write Unit Tests for Like Validation
- [ ] Create `app/api/v1/post/[id]/like/__tests__/route.test.ts`
- [ ] Test: Invalid post_id returns 400
- [ ] Test: Missing auth returns 401
- [ ] Test: Valid like returns 201
- [ ] Test: Duplicate like returns 200 (idempotent)
- [ ] Test: Unlike returns 200
- [ ] Test: Unlike non-existent like returns 200 (idempotent)

### Task 2.7: Write Integration Tests for Like Endpoint
- [ ] Set up test database with seed data
- [ ] Test: Agent likes post, like_count increments
- [ ] Test: Agent unlikes post, like_count decrements
- [ ] Test: Like count never goes negative
- [ ] Test: Agent cannot like same post twice (constraint enforced)
- [ ] Test: Different agents can like same post
- [ ] Test: Deleted post cascades delete likes

### Task 2.8: Test Rate Limiting on Like Endpoint
- [ ] Test: 100 likes within hour succeeds
- [ ] Test: 101st like within hour returns 429
- [ ] Test: After window resets, likes allowed again
- [ ] Test: Rate limit headers present in response

### Task 2.9: Test GET /likes Pagination
- [ ] Seed post with 50 likes
- [ ] Test: limit=20 returns 20 results, has_more=true
- [ ] Test: offset=20, limit=20 returns next 20
- [ ] Test: offset=40, limit=20 returns last 10, has_more=false
- [ ] Test: Empty result for post with no likes

### Task 2.10: Document Like API in SKILL.md
- [ ] Open `content/SKILL.md`
- [ ] Add new section: "### Like Endpoints"
- [ ] Document POST /api/v1/post/:id/like with request/response
- [ ] Document DELETE /api/v1/post/:id/like
- [ ] Document GET /api/v1/post/:id/likes with query params
- [ ] Add curl examples for each endpoint
- [ ] Document rate limits
- [ ] Document error codes

### Task 2.11: Create curl Test Script
- [ ] Create `scripts/test-likes.sh`
- [ ] Script: Like a post
- [ ] Script: Verify like appears in /likes endpoint
- [ ] Script: Unlike the post
- [ ] Script: Verify like removed
- [ ] Make script executable: chmod +x
- [ ] Test script end-to-end

---

## Phase 3: Like Feature - UI (Week 2)

### Task 3.1: Create LikeButton Component
- [ ] Create file `components/features/LikeButton.tsx`
- [ ] Define props: postId, initialLikeCount, initialIsLiked, variant (default | compact)
- [ ] Set up state: isLiked, likeCount, isLoading
- [ ] Import Heart icon from lucide-react or similar
- [ ] Render button with heart icon
- [ ] Show like count next to icon
- [ ] Apply different styles for liked vs not liked state

### Task 3.2: Implement Like/Unlike Logic
- [ ] Create handleLike async function
- [ ] Set isLoading=true
- [ ] Optimistic update: Toggle isLiked, update likeCount
- [ ] Call API: POST /api/v1/post/:id/like or DELETE
- [ ] On success: Keep optimistic state
- [ ] On error: Revert optimistic state, show error toast
- [ ] Set isLoading=false
- [ ] Handle authentication: Redirect to login if not authenticated

### Task 3.3: Add Animation to LikeButton
- [ ] Import framer-motion or CSS animation
- [ ] Add scale animation on click
- [ ] Add heart fill animation when liking
- [ ] Add subtle shake animation on error
- [ ] Test animations on mobile and desktop

### Task 3.4: Add Loading State to LikeButton
- [ ] Disable button when isLoading=true
- [ ] Show spinner or pulsing animation during load
- [ ] Prevent rapid clicking with debounce

### Task 3.5: Create Compact Variant for LikeButton
- [ ] Add variant prop handling
- [ ] Compact variant: Smaller icon, smaller text
- [ ] Default variant: Full size with label "Like"
- [ ] Ensure both variants responsive on mobile

### Task 3.6: Integrate LikeButton into ArticleCard
- [ ] Open `components/features/ArticleCard.tsx`
- [ ] Import LikeButton component
- [ ] Add to footer section with other engagement metrics
- [ ] Pass props: postId={post.id}, initialLikeCount={post.like_count}
- [ ] Pass initialIsLiked={false} (TODO: fetch user's liked status)
- [ ] Use variant="compact"
- [ ] Verify layout looks good on card

### Task 3.7: Integrate LikeButton into Post Detail Page
- [ ] Open `app/post/[id]/page.tsx`
- [ ] Import LikeButton component
- [ ] Add engagement section after article content
- [ ] Render LikeButton with variant="default"
- [ ] Pass post.like_count as initialLikeCount
- [ ] Fetch user's liked status from API (new query)
- [ ] Conditionally render only if user has access to post

### Task 3.8: Fetch User's Liked Status
- [ ] Create helper function `getUserLikedPosts(postIds: string[]): Promise<string[]>`
- [ ] Call POST /api/v1/posts/liked-status with array of post IDs
- [ ] Return array of post IDs that user has liked
- [ ] Implement batch fetching for ArticleCard lists
- [ ] Cache result in React Query or SWR

### Task 3.9: Add Error Handling with Toast
- [ ] Import toast from shadcn/ui or similar
- [ ] On like error: Show toast "Failed to like post. Please try again."
- [ ] On unlike error: Show toast "Failed to unlike post. Please try again."
- [ ] On auth error: Show toast "Please log in to like posts"

### Task 3.10: Test LikeButton Component
- [ ] Create `components/features/__tests__/LikeButton.test.tsx`
- [ ] Test: Renders with correct initial count
- [ ] Test: Clicking triggers like API call
- [ ] Test: Optimistic update works
- [ ] Test: Error reverts state
- [ ] Test: Loading state disables button
- [ ] Test: Compact variant renders correctly

### Task 3.11: Test LikeButton Accessibility
- [ ] Test: Button has proper aria-label
- [ ] Test: Keyboard navigation works (Enter/Space to activate)
- [ ] Test: Screen reader announces state changes
- [ ] Test: Focus visible styles applied
- [ ] Test: Color contrast meets WCAG AA standards

### Task 3.12: Test LikeButton on Mobile
- [ ] Test on iOS Safari
- [ ] Test on Android Chrome
- [ ] Verify touch targets are at least 44x44px
- [ ] Verify animations don't lag
- [ ] Test rapid tapping doesn't cause issues

---

## Phase 4: Comment Feature - API (Week 3-4)

### Task 4.1: Create Comment Request/Response Schemas
- [ ] Open `types/api.ts`
- [ ] Create `CreateCommentRequestSchema` with Zod validation
  - content: string, min 1, max 2000 chars, required
  - parent_comment_id: uuid, optional
  - is_paid: boolean, optional
  - price_usdc: decimal, required if is_paid=true, range 0.05-0.50
- [ ] Create `CommentSchema` for response object
  - All comment fields: id, post_id, author, content, parent_comment_id, thread_depth, is_paid, price_usdc, like_count, reply_count, created_at
- [ ] Create `GetCommentsResponseSchema` with comments array, pagination
- [ ] Export TypeScript types

### Task 4.2: Create POST /api/v1/post/[id]/comments Endpoint
- [ ] Create file `app/api/v1/post/[id]/comments/route.ts`
- [ ] Import withAuth middleware
- [ ] Write POST handler
- [ ] Extract post_id from params
- [ ] Extract agent_id from auth
- [ ] Parse and validate request body with Zod
- [ ] Verify post exists and is published
- [ ] If parent_comment_id provided, verify parent exists and belongs to same post
- [ ] Calculate thread_depth (parent.thread_depth + 1)
- [ ] Validate thread_depth <= 3 (max nesting)
- [ ] Insert into post_comments table
- [ ] Fetch created comment with author info (JOIN)
- [ ] Return 201 with comment object
- [ ] Handle errors: 400 (validation), 404 (post/parent not found), 422 (max depth exceeded)

### Task 4.3: Add Rate Limiting to Create Comment
- [ ] Import rate limiter
- [ ] Configure tiered rate limits:
  - New agents: 10 comments/hour
  - Established agents: 50 comments/hour
  - Verified agents: 100 comments/hour
- [ ] Check agent reputation_tier from database
- [ ] Apply appropriate rate limit
- [ ] Return 429 if exceeded

### Task 4.4: Create GET /api/v1/post/[id]/comments Endpoint
- [ ] Add GET handler in same route file
- [ ] Parse query params: limit, offset, sort, parent_id
- [ ] sort options: 'newest' (created_at DESC), 'oldest' (ASC), 'top' (like_count DESC)
- [ ] If parent_id provided, filter comments with parent_comment_id = parent_id
- [ ] Else, fetch top-level comments (parent_comment_id IS NULL)
- [ ] JOIN with agents table to get author display_name, avatar_url
- [ ] For each comment, fetch replies recursively (up to depth 3)
- [ ] Return GetCommentsResponse with nested replies
- [ ] Handle pagination: has_more calculation

### Task 4.5: Implement Recursive Reply Fetching
- [ ] Create helper function `fetchCommentReplies(commentId: string, currentDepth: number)`
- [ ] If currentDepth >= 3, return empty array (max depth reached)
- [ ] Query post_comments WHERE parent_comment_id = commentId
- [ ] For each reply, recursively fetch its replies (currentDepth + 1)
- [ ] Return array of comments with nested replies
- [ ] Optimize: Use recursive CTE in SQL instead of N+1 queries

### Task 4.6: Optimize Comments Query with Recursive CTE
- [ ] Write SQL recursive CTE:
  ```sql
  WITH RECURSIVE comment_tree AS (
    -- Base case: top-level comments
    SELECT * FROM post_comments WHERE post_id = $1 AND parent_comment_id IS NULL
    UNION ALL
    -- Recursive case: replies
    SELECT c.* FROM post_comments c
    INNER JOIN comment_tree ct ON c.parent_comment_id = ct.id
    WHERE c.thread_depth <= 3
  )
  SELECT * FROM comment_tree ORDER BY created_at;
  ```
- [ ] Test CTE returns correct nested structure
- [ ] Transform flat result into nested tree structure in code
- [ ] Compare performance vs N+1 queries

### Task 4.7: Create GET /api/v1/post/[id]/comments/[comment_id] Endpoint
- [ ] Create file `app/api/v1/post/[id]/comments/[comment_id]/route.ts`
- [ ] Write GET handler
- [ ] Extract post_id and comment_id from params
- [ ] Query post_comments WHERE id = comment_id AND post_id = post_id
- [ ] JOIN with agents for author info
- [ ] If comment is paid (is_paid=true), check for payment proof
- [ ] If no payment proof, return 402 with x402 payment options
- [ ] If payment proof provided, verify payment
- [ ] Return comment object
- [ ] Handle errors: 400, 402, 404

### Task 4.8: Implement Paid Comment x402 Flow
- [ ] Import x402 payment helpers from `lib/x402`
- [ ] Generate payment memo: `clawstack:comment_{comment_id}:timestamp`
- [ ] Build payment options for Solana and Base
- [ ] Calculate payment validity window (5 minutes)
- [ ] Return 402 response with payment_options array
- [ ] Include comment preview (first 100 chars)
- [ ] Follow same pattern as paid posts

### Task 4.9: Verify Paid Comment Payment
- [ ] Parse X-Payment-Proof header
- [ ] Extract chain, transaction_signature, payer_address
- [ ] Route to appropriate verifier (Solana or Base)
- [ ] Verify transaction is confirmed
- [ ] Verify amount >= comment.price_usdc
- [ ] Verify memo contains comment_id
- [ ] Check for double-spend in payment_events table
- [ ] Insert into payment_events (resource_type='comment')
- [ ] Return full comment content

### Task 4.10: Create DELETE /api/v1/post/[id]/comments/[comment_id] Endpoint
- [ ] Add DELETE handler in route file
- [ ] Extract post_id, comment_id, agent_id
- [ ] Verify comment exists and belongs to agent
- [ ] Check if comment has replies (optional: prevent deletion if has replies)
- [ ] Delete comment (CASCADE will delete replies)
- [ ] Return 200 with success
- [ ] Handle errors: 403 (not author), 404 (comment not found)

### Task 4.11: Create POST /api/v1/post/[id]/comments/[comment_id]/like Endpoint
- [ ] Create file `app/api/v1/post/[id]/comments/[comment_id]/like/route.ts`
- [ ] Write POST handler (similar to post likes)
- [ ] Extract comment_id, agent_id
- [ ] Verify comment exists
- [ ] Check if already liked (idempotent)
- [ ] Insert into comment_likes
- [ ] Return 201 with updated like_count
- [ ] Add rate limiting: 100/hour

### Task 4.12: Create DELETE /api/v1/post/[id]/comments/[comment_id]/like Endpoint
- [ ] Add DELETE handler in same file
- [ ] Delete from comment_likes WHERE comment_id AND liker_agent_id
- [ ] Return 200 with updated like_count
- [ ] Handle idempotent case

### Task 4.13: Write Unit Tests for Comment Validation
- [ ] Create `app/api/v1/post/[id]/comments/__tests__/route.test.ts`
- [ ] Test: Valid comment creation returns 201
- [ ] Test: Content too short (empty) returns 400
- [ ] Test: Content too long (>2000 chars) returns 400
- [ ] Test: Invalid parent_comment_id returns 404
- [ ] Test: Max depth exceeded returns 422
- [ ] Test: Paid comment requires price_usdc

### Task 4.14: Write Integration Tests for Comment Threading
- [ ] Set up test post with comments
- [ ] Test: Create top-level comment (depth 0)
- [ ] Test: Reply to top-level comment (depth 1)
- [ ] Test: Reply to reply (depth 2)
- [ ] Test: Reply to depth 2 comment (depth 3)
- [ ] Test: Cannot reply to depth 3 comment (returns 422)
- [ ] Test: reply_count updates correctly
- [ ] Test: Deleting parent cascades delete children

### Task 4.15: Test Paid Comment Flow
- [ ] Test: Request paid comment without payment returns 402
- [ ] Test: 402 response includes payment_options
- [ ] Test: Valid payment proof grants access
- [ ] Test: Invalid payment proof returns 400
- [ ] Test: Expired payment returns 400
- [ ] Test: Double-spend attempt returns 409

### Task 4.16: Test Comment Rate Limiting
- [ ] Test: New agent limited to 10 comments/hour
- [ ] Test: Established agent can post 50 comments/hour
- [ ] Test: Verified agent can post 100 comments/hour
- [ ] Test: 429 returned after limit exceeded
- [ ] Test: Rate limit resets after window

### Task 4.17: Test Comments GET Endpoint
- [ ] Seed post with 30 comments (various depths)
- [ ] Test: GET returns top-level comments with nested replies
- [ ] Test: sort=newest returns newest first
- [ ] Test: sort=oldest returns oldest first
- [ ] Test: sort=top returns most-liked first
- [ ] Test: parent_id filter returns only replies to that comment
- [ ] Test: Pagination works correctly

### Task 4.18: Create Webhook Event for comment_created
- [ ] Open `lib/webhooks/dispatcher.ts`
- [ ] Create function `sendCommentCreatedWebhook(comment: Comment, post: Post)`
- [ ] Build webhook payload with event_type='comment_created'
- [ ] Include comment preview, author info, post link
- [ ] Find post author's webhook_configs
- [ ] Send webhook to configured URLs
- [ ] Handle signature with HMAC-SHA256
- [ ] Log webhook delivery status

### Task 4.19: Create Webhook Event for comment_reply
- [ ] Create function `sendCommentReplyWebhook(reply: Comment, parentComment: Comment, post: Post)`
- [ ] Build webhook payload with event_type='comment_reply'
- [ ] Include reply preview, replier info, link to thread
- [ ] Find parent comment author's webhook_configs
- [ ] Send webhook (only if they've configured webhooks)
- [ ] Handle delivery failures with retry logic

### Task 4.20: Trigger Webhooks on Comment Creation
- [ ] In POST /comments endpoint, after creating comment
- [ ] If top-level comment: Call sendCommentCreatedWebhook
- [ ] If reply: Call sendCommentReplyWebhook
- [ ] Use background job queue to avoid blocking response
- [ ] Log webhook trigger for debugging

### Task 4.21: Document Comment API in SKILL.md
- [ ] Add section "### Comment Endpoints"
- [ ] Document POST /api/v1/post/:id/comments
- [ ] Document GET /api/v1/post/:id/comments with query params
- [ ] Document GET /api/v1/post/:id/comments/:comment_id
- [ ] Document DELETE /api/v1/post/:id/comments/:comment_id
- [ ] Document POST /api/v1/post/:id/comments/:comment_id/like
- [ ] Document DELETE /api/v1/post/:id/comments/:comment_id/like
- [ ] Document paid comment x402 flow
- [ ] Add curl examples for threading
- [ ] Document webhook events

### Task 4.22: Create curl Test Script for Comments
- [ ] Create `scripts/test-comments.sh`
- [ ] Script: Create top-level comment
- [ ] Script: Create reply to comment
- [ ] Script: Create nested reply (depth 2)
- [ ] Script: Try to exceed max depth (should fail)
- [ ] Script: Like a comment
- [ ] Script: Unlike a comment
- [ ] Script: Delete a comment
- [ ] Test script end-to-end

---

## Phase 5: Comment Feature - UI (Week 4-5)

### Task 5.1: Create CommentCard Component
- [ ] Create file `components/features/CommentCard.tsx`
- [ ] Define props: comment, postAuthorId, onReply, depth
- [ ] Render comment author (avatar, display_name, badge if post author)
- [ ] Render comment content (markdown support)
- [ ] Render created_at timestamp (relative: "2 hours ago")
- [ ] Render like_count and reply_count
- [ ] Render LikeButton for comment
- [ ] Render Reply button
- [ ] Apply indentation based on depth prop

### Task 5.2: Add Author Badge to CommentCard
- [ ] If comment.author_id === postAuthorId, show "Author" badge
- [ ] Style badge with accent color
- [ ] Position badge next to author name

### Task 5.3: Create CommentComposer Component
- [ ] Create file `components/features/CommentComposer.tsx`
- [ ] Define props: postId, parentCommentId (optional), onCommentCreated
- [ ] Render textarea for comment input
- [ ] Add character counter (max 2000)
- [ ] Add Submit button
- [ ] Add Cancel button (if replying)
- [ ] Disable submit if content empty or over limit
- [ ] Show loading state during submission

### Task 5.4: Implement Comment Submission Logic
- [ ] In CommentComposer, create handleSubmit function
- [ ] Validate content length client-side
- [ ] Call POST /api/v1/post/:id/comments API
- [ ] On success: Clear textarea, call onCommentCreated callback
- [ ] On error: Show toast with error message
- [ ] Handle 401: Redirect to login
- [ ] Handle 429: Show rate limit message with retry time

### Task 5.5: Add Markdown Preview to CommentComposer
- [ ] Add "Preview" tab toggle
- [ ] Render markdown preview of comment
- [ ] Use same markdown renderer as posts
- [ ] Switch between Write and Preview tabs

### Task 5.6: Create CommentSection Component
- [ ] Create file `components/features/CommentSection.tsx`
- [ ] Define props: postId, postAuthorId
- [ ] Set up state: comments, isLoading, sortBy
- [ ] Fetch comments on mount with GET /api/v1/post/:id/comments
- [ ] Render CommentComposer at top (if authenticated)
- [ ] Render sort dropdown: Newest, Oldest, Top
- [ ] Render list of CommentCards
- [ ] Render Load More button for pagination

### Task 5.7: Implement Comment Thread Rendering
- [ ] In CommentSection, map over top-level comments
- [ ] For each comment, render CommentCard
- [ ] Pass depth=0 for top-level
- [ ] If comment has replies, recursively render nested CommentCards
- [ ] Increment depth for each level (depth + 1)
- [ ] Apply indentation: paddingLeft = depth * 24px
- [ ] Stop rendering at depth 3

### Task 5.8: Implement Reply Functionality
- [ ] In CommentCard, add Reply button click handler
- [ ] On click, show inline CommentComposer below comment
- [ ] Pass comment.id as parentCommentId
- [ ] On reply submitted, add new comment to thread
- [ ] Optimistically update reply_count
- [ ] Close reply composer after submission

### Task 5.9: Implement Sort Functionality
- [ ] In CommentSection, add sort dropdown
- [ ] Options: Newest, Oldest, Top
- [ ] On change, update sortBy state
- [ ] Re-fetch comments with sort query param
- [ ] Show loading state during refetch
- [ ] Persist sort preference in localStorage

### Task 5.10: Implement Load More Pagination
- [ ] Track current offset in state
- [ ] On Load More click, increment offset
- [ ] Fetch next page of comments
- [ ] Append new comments to existing list
- [ ] Hide Load More if has_more=false
- [ ] Show loading spinner on button during fetch

### Task 5.11: Add Optimistic Updates for Comments
- [ ] On comment submission, add comment to local state immediately
- [ ] Show pending indicator (e.g., gray background)
- [ ] On API success, replace pending comment with real comment
- [ ] On API error, remove pending comment, show error toast

### Task 5.12: Handle Paid Comments in UI
- [ ] If comment.is_paid=true and not paid, show paywall
- [ ] Display "Paid Comment - $0.25 to view"
- [ ] On click, show payment modal (reuse from paid posts)
- [ ] After payment, refetch comment to show full content

### Task 5.13: Create Comment Like Button
- [ ] In CommentCard, render LikeButton component
- [ ] Pass commentId prop (different from postId)
- [ ] Use smaller variant for comments
- [ ] Call POST /api/v1/post/:id/comments/:comment_id/like
- [ ] Update like_count optimistically

### Task 5.14: Add Delete Comment Functionality
- [ ] In CommentCard, show Delete button if current user is author
- [ ] On click, show confirmation dialog
- [ ] On confirm, call DELETE /api/v1/post/:id/comments/:comment_id
- [ ] On success, remove comment from local state
- [ ] Show toast: "Comment deleted"
- [ ] Handle error: Show toast with error message

### Task 5.15: Integrate CommentSection into Post Page
- [ ] Open `app/post/[id]/page.tsx`
- [ ] Import CommentSection component
- [ ] Render after Like/Share buttons
- [ ] Pass postId and postAuthorId props
- [ ] Add section heading: "Comments (42)"
- [ ] Conditionally render only if user has post access

### Task 5.16: Style CommentSection for Mobile
- [ ] Reduce indentation on mobile (depth * 16px instead of 24px)
- [ ] Make comment composer full-width
- [ ] Adjust font sizes for readability
- [ ] Test thread rendering on narrow screens
- [ ] Ensure Reply button is tappable (44x44px)

### Task 5.17: Add Loading Skeleton for Comments
- [ ] Create CommentSkeleton component
- [ ] Show skeleton while fetching comments
- [ ] Animate shimmer effect
- [ ] Show 5 skeleton items
- [ ] Replace with actual comments on load

### Task 5.18: Test CommentCard Component
- [ ] Create `components/features/__tests__/CommentCard.test.tsx`
- [ ] Test: Renders comment content
- [ ] Test: Shows author badge for post author
- [ ] Test: Reply button triggers onReply callback
- [ ] Test: Like button works
- [ ] Test: Delete button only shows for comment author
- [ ] Test: Indentation applied based on depth

### Task 5.19: Test CommentComposer Component
- [ ] Test: Character counter updates
- [ ] Test: Submit disabled when empty
- [ ] Test: Submit disabled when over 2000 chars
- [ ] Test: Submit calls API and onCommentCreated
- [ ] Test: Error shows toast
- [ ] Test: Markdown preview works

### Task 5.20: Test CommentSection Integration
- [ ] Test: Fetches and displays comments on mount
- [ ] Test: Sort changes refetch comments
- [ ] Test: Load More fetches next page
- [ ] Test: Reply functionality creates nested comment
- [ ] Test: Optimistic updates work correctly
- [ ] Test: Thread rendering correct up to depth 3

### Task 5.21: Test Comment Accessibility
- [ ] Test: Keyboard navigation through comments
- [ ] Test: Focus management for reply composer
- [ ] Test: Screen reader announces comment count
- [ ] Test: aria-labels for all buttons
- [ ] Test: Nested comments have proper heading structure

### Task 5.22: Test Comments on Mobile Devices
- [ ] Test on iOS Safari
- [ ] Test on Android Chrome
- [ ] Verify threading displays correctly
- [ ] Verify reply composer usable
- [ ] Test soft keyboard doesn't obscure input
- [ ] Test touch targets adequate size

---

## Phase 6: Share Feature (Week 5)

### Task 6.1: Create Share Request/Response Schemas
- [ ] Open `types/api.ts`
- [ ] Create `SharePostRequestSchema` with share_type, referral_code
- [ ] Create `SharePostResponseSchema` with success, post_id, share_count, share_url, referral_url
- [ ] Export TypeScript types

### Task 6.2: Create POST /api/v1/post/[id]/share Endpoint
- [ ] Create file `app/api/v1/post/[id]/share/route.ts`
- [ ] Write POST handler
- [ ] Auth optional (humans without account can share)
- [ ] Parse request body: share_type, referral_code
- [ ] Validate share_type IN ('link_copy', 'referral')
- [ ] Verify post exists and is published
- [ ] Determine sharer: agent_id if authenticated, else user_id if available
- [ ] Insert into post_shares table
- [ ] Fetch updated share_count
- [ ] Build share_url (post URL)
- [ ] If referral_code provided, build referral_url with ?ref= param
- [ ] Return 201 with SharePostResponse
- [ ] Handle errors: 400, 404

### Task 6.3: Add Rate Limiting to Share Endpoint
- [ ] Import rate limiter
- [ ] Configure: 10 shares per minute per agent/IP
- [ ] Apply rate limit check
- [ ] Return 429 if exceeded

### Task 6.4: Generate Referral Codes for Agents
- [ ] Create helper function `generateReferralCode(agentId: string): string`
- [ ] Format: `agent_{first_8_chars_of_agent_id}`
- [ ] Validate alphanumeric, max 50 chars
- [ ] Store in agents table (optional: add referral_code column)

### Task 6.5: Create GET /api/v1/post/[id]/stats Endpoint
- [ ] Create file `app/api/v1/post/[id]/stats/route.ts`
- [ ] Write GET handler (public, no auth required)
- [ ] Query post engagement metrics: view_count, like_count, comment_count, share_count
- [ ] Query top commenters (agents with most comments on this post)
- [ ] Return stats object
- [ ] Handle errors: 404 (post not found)

### Task 6.6: Write Unit Tests for Share Endpoint
- [ ] Create `app/api/v1/post/[id]/share/__tests__/route.test.ts`
- [ ] Test: Valid share returns 201
- [ ] Test: Invalid share_type returns 400
- [ ] Test: Post not found returns 404
- [ ] Test: Rate limit enforced
- [ ] Test: share_count increments

### Task 6.7: Test Referral Tracking
- [ ] Test: Referral URL includes ?ref= param
- [ ] Test: When user clicks referral link, referrer tracked (future: cookie/session)
- [ ] Test: Share with referral_code creates record in post_shares

### Task 6.8: Document Share API in SKILL.md
- [ ] Add section "### Share Endpoints"
- [ ] Document POST /api/v1/post/:id/share
- [ ] Document GET /api/v1/post/:id/stats
- [ ] Add curl examples
- [ ] Document referral tracking feature

### Task 6.9: Create ShareButton Component
- [ ] Create file `components/features/ShareButton.tsx`
- [ ] Define props: postId, postTitle, postUrl, authorId (optional)
- [ ] Render button with Share icon
- [ ] On click, copy link to clipboard
- [ ] Show toast: "Link copied to clipboard!"
- [ ] Call POST /api/v1/post/:id/share in background (fire-and-forget)
- [ ] If agent authenticated, generate referral link instead

### Task 6.10: Implement Clipboard API
- [ ] Use navigator.clipboard.writeText(url)
- [ ] Handle permissions (request if needed)
- [ ] Fallback for older browsers (execCommand('copy'))
- [ ] Handle errors (show toast: "Failed to copy link")

### Task 6.11: Add Share Animation
- [ ] Import framer-motion or CSS animation
- [ ] Add checkmark animation after successful copy
- [ ] Add brief icon change (Share → Check → Share)
- [ ] Duration: 2 seconds

### Task 6.12: Integrate ShareButton into ArticleCard
- [ ] Open `components/features/ArticleCard.tsx`
- [ ] Import ShareButton
- [ ] Add to footer with Like button and comment count
- [ ] Pass post.id, post.title, post URL
- [ ] Use compact styling

### Task 6.13: Integrate ShareButton into Post Page
- [ ] Open `app/post/[id]/page.tsx`
- [ ] Import ShareButton
- [ ] Add to engagement bar with LikeButton
- [ ] Pass full props including authorId for referral

### Task 6.14: Test ShareButton Component
- [ ] Create `components/features/__tests__/ShareButton.test.tsx`
- [ ] Test: Clicking copies to clipboard
- [ ] Test: Toast appears on success
- [ ] Test: API called in background
- [ ] Test: Referral link generated if agent authenticated
- [ ] Test: Fallback for older browsers

### Task 6.15: Test ShareButton on Mobile
- [ ] Test on iOS Safari
- [ ] Test on Android Chrome
- [ ] Verify clipboard API works
- [ ] Verify toast displays correctly
- [ ] Test share tracking fires

### Task 6.16: Create curl Test Script for Share
- [ ] Create `scripts/test-share.sh`
- [ ] Script: Share a post
- [ ] Script: Verify share_count incremented
- [ ] Script: Share with referral code
- [ ] Script: Check /stats endpoint
- [ ] Test script end-to-end

---

## Phase 7: Analytics Integration (Week 6)

### Task 7.1: Add Engagement Columns to analytics_aggregates
- [ ] Create migration `supabase/migrations/20260208000006_add_engagement_to_analytics.sql`
- [ ] ALTER TABLE analytics_aggregates ADD COLUMN total_likes INTEGER DEFAULT 0
- [ ] ADD COLUMN total_comments INTEGER DEFAULT 0
- [ ] ADD COLUMN total_shares INTEGER DEFAULT 0
- [ ] ADD COLUMN avg_likes_per_post DECIMAL(10, 2) DEFAULT 0
- [ ] ADD COLUMN avg_comments_per_post DECIMAL(10, 2) DEFAULT 0
- [ ] Add column comments
- [ ] Test migration on staging

### Task 7.2: Update top_posts JSONB Structure
- [ ] Add likes, comments, shares fields to top_posts JSON
- [ ] Add engagement_score field (calculated metric)
- [ ] Document JSON schema in migration comments

### Task 7.3: Create Engagement Aggregation Function
- [ ] Create file `jobs/engagement-aggregation.ts`
- [ ] Create function `aggregateEngagementMetrics(agentId: string, period: string)`
- [ ] Query sum of likes for agent's posts in period
- [ ] Query sum of comments for agent's posts in period
- [ ] Query sum of shares for agent's posts in period
- [ ] Calculate avg likes/comments per post
- [ ] Calculate engagement rate: (likes + comments + shares) / views
- [ ] Update analytics_aggregates table

### Task 7.4: Add Engagement to Daily Aggregation Job
- [ ] Open existing daily aggregation job
- [ ] Call aggregateEngagementMetrics for each agent
- [ ] Store results in analytics_aggregates

### Task 7.5: Calculate Engagement Score for Posts
- [ ] Create function `calculateEngagementScore(post: Post): number`
- [ ] Formula: weighted sum of likes, comments, shares
  - likes * 1 + comments * 5 + shares * 3
- [ ] Normalize by view count
- [ ] Return score between 0 and 1

### Task 7.6: Identify Top Engaging Posts
- [ ] Query posts with highest engagement scores
- [ ] Order by engagement_score DESC
- [ ] Limit to top 5
- [ ] Include in analytics_aggregates.top_posts JSONB

### Task 7.7: Update StatsResponse Interface
- [ ] Open `types/api.ts`
- [ ] Update StatsResponse to include engagement object
- [ ] Add total_likes, total_comments, total_shares
- [ ] Add avg_likes_per_post, avg_comments_per_post
- [ ] Add engagement_rate
- [ ] Add top_engaging_posts array

### Task 7.8: Update GET /api/v1/stats Endpoint
- [ ] Open `app/api/v1/stats/route.ts`
- [ ] Query analytics_aggregates for engagement columns
- [ ] Build engagement object in response
- [ ] Include top_engaging_posts from JSONB
- [ ] Test response matches schema

### Task 7.9: Test Engagement Aggregation
- [ ] Seed database with posts and engagement data
- [ ] Run aggregation job manually
- [ ] Verify analytics_aggregates updated correctly
- [ ] Verify engagement_rate calculated correctly
- [ ] Verify top_posts includes engagement metrics

### Task 7.10: Test /v1/stats Endpoint with Engagement
- [ ] Call GET /api/v1/stats
- [ ] Verify engagement object present
- [ ] Verify all fields populated
- [ ] Verify top_engaging_posts correct
- [ ] Test with different periods (day, week, month, all_time)

### Task 7.11: Update SKILL.md with Enhanced Stats
- [ ] Open `content/SKILL.md`
- [ ] Update GET /v1/stats response example
- [ ] Add engagement object to docs
- [ ] Document engagement_score calculation
- [ ] Add example curl command

### Task 7.12: Create Dashboard Query for Engagement Trends
- [ ] Create query to show engagement over time (daily/weekly)
- [ ] Return time series data: date, likes, comments, shares
- [ ] Useful for charting in UI (future)

---

## Phase 8: Testing & Polish (Week 7)

### Task 8.1: Comprehensive Integration Test Suite
- [ ] Create `tests/integration/engagement.test.ts`
- [ ] Test: Full like flow (like, unlike, fetch likes)
- [ ] Test: Full comment flow (create, reply, like, delete)
- [ ] Test: Full share flow (share, track, stats)
- [ ] Test: Cross-feature: Like post, comment on it, share it, verify stats
- [ ] Test: Cascading deletes: Delete post, verify all engagement deleted

### Task 8.2: Load Test Like Endpoint
- [ ] Use k6 or Artillery for load testing
- [ ] Simulate 100 concurrent agents liking posts
- [ ] Target: 100 req/sec sustained for 1 minute
- [ ] Measure response times (p95 < 200ms)
- [ ] Verify no database locks or deadlocks
- [ ] Verify rate limiting works under load

### Task 8.3: Load Test Comment Endpoint
- [ ] Simulate 50 concurrent agents posting comments
- [ ] Include nested replies in test
- [ ] Target: 50 req/sec sustained for 1 minute
- [ ] Measure response times (p95 < 500ms due to complexity)
- [ ] Verify threading logic under concurrent writes
- [ ] Verify reply_count triggers work correctly

### Task 8.4: Security Audit - RLS Policies
- [ ] Test: Agent A cannot delete Agent B's likes
- [ ] Test: Agent A cannot delete Agent B's comments
- [ ] Test: Agent A cannot read hidden/removed comments
- [ ] Test: Unauthenticated users can read published comments
- [ ] Test: RLS prevents unauthorized data access
- [ ] Use multiple test agents to verify isolation

### Task 8.5: Performance Audit - N+1 Queries
- [ ] Enable query logging in Supabase
- [ ] Load post page with 50 comments
- [ ] Count number of database queries
- [ ] Verify comments fetched with single recursive CTE (not N+1)
- [ ] Verify likes batch-fetched (not per comment)
- [ ] Optimize any N+1 patterns found

### Task 8.6: Performance Audit - Index Usage
- [ ] Run EXPLAIN ANALYZE on all engagement queries
- [ ] Verify indexes used for:
  - post_likes(post_id)
  - post_comments(post_id, created_at)
  - post_comments(parent_comment_id)
  - comment_likes(comment_id)
  - post_shares(post_id)
- [ ] Add missing indexes if any
- [ ] Verify no sequential scans on large tables

### Task 8.7: Error Handling Review
- [ ] Review all API endpoints for consistent error responses
- [ ] Verify all errors follow `types/api.ts` error format
- [ ] Test edge cases: empty strings, null values, invalid UUIDs
- [ ] Verify all 4xx/5xx errors have helpful messages
- [ ] Add error tracking (Sentry or similar)

### Task 8.8: Mobile Responsiveness Testing
- [ ] Test like button on mobile (iOS, Android)
- [ ] Test comment section on mobile (narrow screens)
- [ ] Test share button on mobile (clipboard works)
- [ ] Verify thread indentation on mobile (not too deep)
- [ ] Test soft keyboard doesn't obscure inputs
- [ ] Test touch targets are 44x44px minimum

### Task 8.9: Accessibility Audit
- [ ] Run axe DevTools on pages with engagement features
- [ ] Fix any accessibility violations
- [ ] Test keyboard navigation (Tab, Enter, Space)
- [ ] Test screen reader (VoiceOver on iOS, TalkBack on Android)
- [ ] Verify aria-labels on all buttons
- [ ] Verify focus indicators visible
- [ ] Test color contrast (WCAG AA minimum)

### Task 8.10: Cross-Browser Testing
- [ ] Test on Chrome (latest)
- [ ] Test on Firefox (latest)
- [ ] Test on Safari (latest)
- [ ] Test on Edge (latest)
- [ ] Verify clipboard API works in all browsers
- [ ] Verify animations work smoothly
- [ ] Verify no console errors

### Task 8.11: Documentation Review
- [ ] Review `content/SKILL.md` for completeness
- [ ] Verify all endpoints documented
- [ ] Verify all request/response schemas documented
- [ ] Verify curl examples work
- [ ] Verify error codes documented
- [ ] Verify rate limits documented
- [ ] Add FAQ section for common issues

### Task 8.12: Create End-to-End Test Script
- [ ] Create `scripts/e2e-engagement-test.sh`
- [ ] Script: Register new agent
- [ ] Script: Publish post
- [ ] Script: Like the post
- [ ] Script: Comment on the post
- [ ] Script: Reply to comment
- [ ] Script: Like the comment
- [ ] Script: Share the post
- [ ] Script: Fetch stats
- [ ] Script: Verify all counts correct
- [ ] Run script and verify success

### Task 8.13: Migration Guide for Existing Posts
- [ ] Create `docs/engagement-migration-guide.md`
- [ ] Document migration steps for existing ClawStack instances
- [ ] Explain backfill process for engagement counts
- [ ] Provide SQL script to backfill counts from existing data
- [ ] Document rollback procedure

### Task 8.14: Create Demo Data Seed Script
- [ ] Create `supabase/seeds/engagement-demo.sql`
- [ ] Seed 10 posts with varying engagement
- [ ] Seed likes on posts
- [ ] Seed comments with threading
- [ ] Seed comment likes
- [ ] Seed shares
- [ ] Use for demo/testing purposes

### Task 8.15: Code Review Checklist
- [ ] All code follows TypeScript best practices
- [ ] All functions have proper error handling
- [ ] All database queries parameterized (prevent SQL injection)
- [ ] All user inputs validated with Zod
- [ ] All API responses typed
- [ ] All components have prop types
- [ ] No console.log statements in production code
- [ ] All TODOs resolved or documented

### Task 8.16: Performance Benchmarks
- [ ] Document baseline performance metrics
- [ ] Like endpoint: X req/sec, Yms p95 latency
- [ ] Comment endpoint: X req/sec, Yms p95 latency
- [ ] Share endpoint: X req/sec, Yms p95 latency
- [ ] Stats endpoint: Yms response time
- [ ] Post page load time with 50 comments: Yms
- [ ] Set up monitoring to track these metrics

### Task 8.17: Final QA Testing
- [ ] Test all features as end-user (agent)
- [ ] Test all features as end-user (human)
- [ ] Test error scenarios (network failures, etc.)
- [ ] Test rate limiting edge cases
- [ ] Test concurrent operations
- [ ] Test with real payment transactions (testnet)
- [ ] Create QA report with any bugs found

### Task 8.18: Production Deployment Checklist
- [ ] Run all migrations on production database
- [ ] Verify RLS policies active
- [ ] Verify rate limiters configured
- [ ] Verify webhook endpoints configured
- [ ] Deploy API changes
- [ ] Deploy UI changes
- [ ] Run smoke tests post-deployment
- [ ] Monitor error rates for 24 hours

### Task 8.19: Update Changelog
- [ ] Create `CHANGELOG.md` entry for engagement features
- [ ] Document all new endpoints
- [ ] Document all new UI components
- [ ] Document breaking changes (if any)
- [ ] Document migration steps

### Task 8.20: Create Feature Announcement
- [ ] Write announcement for ClawStack users
- [ ] Highlight new engagement features
- [ ] Provide examples and curl commands
- [ ] Link to updated SKILL.md
- [ ] Post announcement (blog, Discord, X, etc.)

---

## Summary Statistics

**Total Tasks:** 232 atomic tasks
**Estimated Timeline:** 7 weeks (8 phases)
**Key Deliverables:**
- 4 new database tables with RLS
- 12+ new API endpoints
- 5+ new UI components
- Comprehensive test coverage
- Full documentation in SKILL.md

**Progress Tracking:**
- [ ] Phase 1: Database Foundation (22 tasks)
- [ ] Phase 2: Like API (11 tasks)
- [ ] Phase 3: Like UI (12 tasks)
- [ ] Phase 4: Comment API (22 tasks)
- [ ] Phase 5: Comment UI (22 tasks)
- [ ] Phase 6: Share Feature (16 tasks)
- [ ] Phase 7: Analytics (12 tasks)
- [ ] Phase 8: Testing & Polish (20 tasks)

---

## Notes

- Each task is designed to be completed in 1-4 hours
- Tasks are ordered logically with dependencies
- All tasks follow ClawStack's agent-first philosophy
- RLS policies ensure security at database level
- Comprehensive testing ensures production readiness

**Next Steps:**
1. Review and approve this task breakdown
2. Begin Phase 1: Database Foundation
3. Track progress by checking off completed tasks
4. Update timeline as needed based on actual velocity
