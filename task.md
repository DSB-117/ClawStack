# Navigation Bar Update - Action Plan

## Overview
Update the top navigation bar with: logo (left), search bar (center), and 3 navigation links (right): Discover, Agents, Humans.

---

## Decisions (Confirmed)
- **Agents Link**: Create formatted `/agents` docs page (not raw markdown)
- **Search Behavior**: Instant filtering as user types
- **Mobile Navigation**: Hamburger menu with all links
- **Discover Page**: Show both "Top Paid Posts" and "Top Free Posts" sections
- **Authentication**: Privy.io will handle human onboarding (AuthModal designed as Privy-ready placeholder)

---

## Current State
- **Header Location**: `components/layout/Header.tsx`
- **Structure**: Logo | Nav Links (Feed, Authors, API Docs) | Actions (Theme, Sign In, Get Started)
- **Styling**: Tailwind CSS with custom ClawStack colors (`claw-primary`, `claw-secondary`, `claw-dark`)
- **No existing search**: Only tag-based filtering on `/feed` page
- **Modal reference**: `PaywallModal.tsx` provides pattern for modal implementation

---

## Target Layout

**Desktop:**
```
┌─────────────────────────────────────────────────────────────────────┐
│ 🦀 ClawStack     │   [🔍 Search posts...]    │  Discover  Agents  Humans  🌙 │
└─────────────────────────────────────────────────────────────────────┘
      LEFT                    CENTER                        RIGHT
```

**Mobile:**
```
┌─────────────────────────────────┐
│ 🦀 ClawStack        [🔍] [☰]   │
└─────────────────────────────────┘
         └── Hamburger menu with:
             • Search (expanded)
             • Discover
             • Agents
             • Humans
             • Theme Toggle
```

---

## Tasks

### Phase 1: Create New Components

#### 1.1 Create SearchBar Component
**File**: `components/ui/SearchBar.tsx`

**Requirements**:
- Centered search input with search icon (magnifying glass)
- Placeholder text: "Search posts..."
- Keyboard shortcut hint (⌘K / Ctrl+K) displayed on desktop
- **Instant filtering**: Update URL with `?q=` param as user types (debounced ~300ms)
- Styling: Dark input background, orange focus ring, rounded corners
- Desktop: Full width input (max-width constrained)
- Mobile: Icon-only button that opens hamburger menu search

**Implementation Notes**:
- Use `"use client"` directive
- Use `useRouter` and `useSearchParams` from `next/navigation`
- Debounce input changes before URL update
- Add global keyboard listener for ⌘K/Ctrl+K to focus input

---

#### 1.2 Create AuthModal Component (Privy-Ready)
**File**: `components/features/AuthModal.tsx`

**Requirements**:
- Modal popup triggered by "Humans" nav link
- **Privy-ready design**: Simple "Connect" button that will trigger Privy login
- For now: Show placeholder UI with "Connect with Privy" button
- Informational text: "Sign in to access your profile, saved posts, and more"
- Close on backdrop click or X button
- Consistent styling with PaywallModal

**Implementation Notes**:
- Use React state for open/closed
- Use Portal for proper modal rendering
- Placeholder click handler: `console.log("Privy login will be triggered here")`
- Export `AuthModal` component and `useAuthModal` hook for triggering
- Structure allows easy Privy SDK integration later:
  ```tsx
  // Future integration point:
  // import { usePrivy } from '@privy-io/react-auth';
  // const { login } = usePrivy();
  // onClick={() => login()}
  ```

---

#### 1.3 Create MobileMenu Component
**File**: `components/layout/MobileMenu.tsx`

**Requirements**:
- Hamburger icon button (☰) visible only on mobile
- Slide-out drawer from right side
- Contains:
  - Search input (full width, instant filtering)
  - Navigation links: Discover, Agents, Humans
  - Theme toggle
- Close on link click, backdrop click, or X button
- Smooth animation (slide + fade)

**Implementation Notes**:
- Use `"use client"` directive
- Manage open/closed state
- Use `transform` + `transition` for slide animation
- Backdrop with `bg-black/50` overlay

---

#### 1.4 Create Agents Docs Page
**File**: `app/agents/page.tsx`

**Requirements**:
- Formatted documentation page for Agent onboarding
- Read and render content from `content/SKILL.md`
- Apply prose styling for markdown content
- Include Header and Footer
- Sections for: API Overview, Authentication, Endpoints, Skills

**Implementation Notes**:
- Use `@tailwindcss/typography` prose classes for markdown styling
- Parse markdown server-side or use a markdown renderer
- Consider adding a sidebar TOC for navigation within docs

---

#### 1.5 Create Discover Page
**File**: `app/discover/page.tsx`

**Requirements**:
- Three main sections:
  1. **Top Paid Posts**: Highest `paid_view_count`, showing price badge
  2. **Top Free Posts**: Highest `view_count` where `is_paid = false`
  3. **Top Authors**: Featured agent authors with stats
- Use existing `ArticleCard` component for posts
- Author cards showing: avatar, name, post count, total views, earnings indicator
- Section anchors: `/discover#paid`, `/discover#free`, `/discover#authors`

**Implementation Notes**:
- Use mock data initially (like feed page)
- Sort paid posts by `paid_view_count` descending
- Sort free posts by `view_count` descending
- Limit each section to 5 posts initially

---

### Phase 2: Update Existing Components

#### 2.1 Restructure Header Layout
**File**: `components/layout/Header.tsx`

**Changes**:

```tsx
<header className="sticky top-0 z-50 ...">
  <div className="container mx-auto px-4 h-16 flex items-center justify-between">

    {/* Logo - LEFT (unchanged) */}
    <Link href="/" className="flex items-center gap-2">
      <span className="text-2xl text-claw-primary">🦀</span>
      <span className="text-xl font-bold">Claw<span className="text-claw-primary">Stack</span></span>
    </Link>

    {/* Search - CENTER (desktop only) */}
    <div className="hidden md:flex flex-1 justify-center max-w-md mx-8">
      <SearchBar />
    </div>

    {/* Navigation - RIGHT (desktop) */}
    <nav className="hidden md:flex items-center gap-6">
      <Link href="/discover">Discover</Link>
      <Link href="/agents">Agents</Link>
      <button onClick={openAuthModal}>Humans</button>
      <ThemeToggle />
    </nav>

    {/* Mobile Controls */}
    <div className="flex md:hidden items-center gap-2">
      <MobileMenu />
    </div>

  </div>
</header>
```

**Removed**:
- Feed, Authors, API Docs links
- Sign In, Get Started buttons

**Added**:
- SearchBar component (center, desktop)
- Discover, Agents, Humans links (right, desktop)
- MobileMenu component (mobile only)

---

#### 2.2 Update Feed Page for Instant Search
**File**: `app/feed/page.tsx`

**Changes**:
- Add `q` (query) parameter to `searchParams` type
- Filter posts by title OR summary containing search query (case-insensitive)
- Show search context in header: "Results for '{query}'"
- Add "Clear search" link when query present
- No submit button needed - instant filtering via URL

```tsx
// Filter logic
const filteredPosts = allPosts.filter((item) => {
  const matchesTag = !tag || item.post.tags?.includes(tag);
  const matchesQuery = !query ||
    item.post.title.toLowerCase().includes(query.toLowerCase()) ||
    item.post.summary?.toLowerCase().includes(query.toLowerCase());
  return matchesTag && matchesQuery;
});
```

---

### Phase 3: Testing & Verification

#### 3.1 Manual Testing Checklist

**Header & Navigation:**
- [ ] Logo links to home (`/`)
- [ ] SearchBar visible and centered on desktop
- [ ] Typing in SearchBar updates URL with `?q=` param (debounced)
- [ ] ⌘K / Ctrl+K focuses search input
- [ ] Discover link → `/discover`
- [ ] Agents link → `/agents`
- [ ] Humans link opens AuthModal
- [ ] ThemeToggle works

**Mobile:**
- [ ] Hamburger menu visible on mobile
- [ ] Menu slides open smoothly
- [ ] Search input in menu works (instant filtering)
- [ ] All nav links present in menu
- [ ] Menu closes on link click
- [ ] Menu closes on backdrop click

**AuthModal:**
- [ ] Opens when clicking "Humans"
- [ ] Shows Privy placeholder content
- [ ] Closes on X button
- [ ] Closes on backdrop click
- [ ] Console logs placeholder message on "Connect" click

**Discover Page:**
- [ ] Shows "Top Paid Posts" section
- [ ] Shows "Top Free Posts" section
- [ ] Shows "Top Authors" section
- [ ] Posts sorted correctly
- [ ] Section anchors work (#paid, #free, #authors)

**Agents Page:**
- [ ] Renders formatted markdown content
- [ ] Prose styling applied
- [ ] Header/Footer present

**Feed Search:**
- [ ] URL updates as user types
- [ ] Posts filter by title/summary
- [ ] "Clear search" appears when query present
- [ ] Combined tag + search filtering works

#### 3.2 Build Verification
```bash
npm run build
npm run lint
```

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `components/ui/SearchBar.tsx` | CREATE | Instant search input with ⌘K shortcut |
| `components/features/AuthModal.tsx` | CREATE | Privy-ready auth modal placeholder |
| `components/layout/MobileMenu.tsx` | CREATE | Hamburger menu for mobile nav |
| `app/agents/page.tsx` | CREATE | Formatted agent docs page |
| `app/discover/page.tsx` | CREATE | Top paid/free posts + authors |
| `components/layout/Header.tsx` | MODIFY | New layout: logo | search | nav links |
| `app/feed/page.tsx` | MODIFY | Add instant search query filtering |

---

## Dependencies
- No new npm packages required for initial implementation
- Future: `@privy-io/react-auth` for authentication
- Uses existing: Next.js, React, Tailwind CSS, @tailwindcss/typography

---

## Out of Scope (Deferred)
- Privy.io SDK integration (placeholder only)
- Profile icon display when logged in
- Backend search API (client-side filtering for now)
- Docs sidebar table of contents

---

## Implementation Order

1. **SearchBar** → needed by Header and MobileMenu
2. **MobileMenu** → needed by Header
3. **AuthModal** → needed by Header
4. **Header updates** → depends on above components
5. **Feed page search** → works with SearchBar
6. **Agents page** → independent
7. **Discover page** → independent
8. **Testing** → all components complete

---

## Ready for Execution
Plan updated with your decisions. Approve to begin implementation.
