# Comprehensive GitHub Copilot Prompt — Modern Classifieds Marketplace

Use this prompt in VS Code GitHub Copilot Chat (Agent mode) to scaffold and build the project.

---

## 🚀 MASTER PROMPT (Copy and use in Copilot Chat)

```
I need to build a revolutionary AGENT-FIRST classifieds marketplace. This is NOT a traditional classifieds site with AI bolted on — agents ARE the core platform. Users don't fill forms; they tell agents what they want, and agents handle everything autonomously. **English is the primary language for all code, comments, documentation, and variable names.**

## Core Philosophy: AGENT-FIRST
- **Design Principle — ALWAYS enforce:** The platform must be **lightweight, fast, modern, and simple**. Every change, every feature, every component must be validated against these four pillars. If a change adds unnecessary weight, slows the page, looks dated, or complicates the UX — it must be refactored before shipping. This is a non-negotiable checkpoint on every PR.
- **Primary UX**: User says "sell this" or "find me X" → an AI agent handles everything autonomously (listing creation, pricing, monitoring, negotiation, selling/buying)
- **Manual mode exists** only as a legacy fallback for users who prefer traditional forms — but it's secondary, a small link saying "or create manually"
- **Operations are agent-run**: Moderation Agent, Support Agent, Anti-Fraud Agent, Quality Agent, SEO Agent, Engagement Agent — the platform runs itself with minimal human oversight
- **Three user paths**: Agent (recommended, 80%) → Quick/hybrid (15%) → Manual/legacy (5%)

## Business Model — Freemium
- **Free tier**: 10 listings/month, 1 selling agent + 1 buying agent (basic open-source AI), in-app messaging, AI support chat
- **Pro tier (~€4.99/mo)**: 50 listings, 5 selling + 5 buying agents (GPT-4o), auto-negotiation, natural language search, price advisor, timing advice, watchdog
- **Business tier (~€19.99/mo)**: Unlimited everything, liquidation agent, investment scout, analytics, company page, API access
- **A-la-carte boosts**: €0.99-4.99 for listing promotion
- Payment via Stripe (subscriptions + one-time)

## Technology Stack
- **Framework**: Next.js 15 with App Router and TypeScript
- **Styling**: Tailwind CSS v4 + shadcn/ui component library
- **Database**: PostgreSQL with Prisma ORM + pgvector extension for embeddings
- **Authentication**: NextAuth.js v5 (Auth.js) with credentials + Google + GitHub providers
- **Payments**: Stripe (subscriptions, one-time boosts, webhooks)
- **API Layer**: tRPC v11 for type-safe API calls
- **Search**: Meilisearch for full-text search with faceted filtering
- **State Management**: Zustand for client state, TanStack Query v5 for server state
- **File Upload**: Azure Blob Storage (or local filesystem for dev)
- **AI (Dev/Test)**: **GitHub Copilot CLI / GitHub Models API** as primary LLM — free with Copilot subscription, used for agent reasoning, text generation, descriptions, NL search during development
- **AI (Free tier)**: CLIP via Transformers.js for image categorization, all-MiniLM-L6-v2 embeddings, GitHub Models (rate-limited) or Ollama fallback
- **AI (Paid tier production)**: Azure OpenAI GPT-4o for premium agent AI, Azure AI Vision for image analysis
- **Market Data**: SsLvScraper — aggregates public market data from ss.lv (prices, durations, categories) to bootstrap pricing engine. Respects robots.txt, collects statistics only (no personal data, no verbatim text). Phased out once own data is sufficient.
- **Real-time**: Socket.io for messaging
- **Background Jobs**: BullMQ + Redis for agent task orchestration (selling agents, buying agents, price adjustments, scraper CRON)
- **i18n**: next-intl for 5 UI languages: English (primary), Latvian, Russian, Lithuanian, Estonian
- **Forms**: React Hook Form + Zod validation
- **Maps**: Leaflet with OpenStreetMap

## Project Structure
Create the following structure:
```
src/
├── app/
│   ├── [locale]/
│   │   ├── layout.tsx                 # Root layout with providers, navbar, footer
│   │   ├── page.tsx                   # Home page - Concierge prompt + category grid + featured
│   │   ├── sell/
│   │   │   └── page.tsx               # PRIMARY: Selling Agent wizard (upload → agent conversation → done)
│   │   ├── buy/
│   │   │   └── page.tsx               # PRIMARY: Buying Agent wizard (describe → agent monitors 24/7)
│   │   ├── support/
│   │   │   └── page.tsx               # AI Support Agent chat (handles 90%+ of queries)
│   │   ├── auth/
│   │   │   ├── signin/page.tsx        # Sign in page
│   │   │   ├── register/page.tsx      # Registration page
│   │   │   ├── verify-email/page.tsx  # Email verification
│   │   │   └── forgot-password/page.tsx # Password reset
│   │   ├── categories/
│   │   │   └── [slug]/page.tsx        # Category browse page with subcategories
│   │   ├── pricing/
│   │   │   └── page.tsx               # Pricing comparison page (Free vs Pro vs Business)
│   │   ├── listings/
│   │   │   ├── page.tsx               # Search results with filters sidebar (browse/legacy mode)
│   │   │   ├── new/page.tsx           # Manual listing creation (LEGACY — small link "or create manually")
│   │   │   └── [id]/
│   │   │       ├── page.tsx           # Listing detail page
│   │   │       └── edit/page.tsx      # Edit listing
│   │   ├── dashboard/
│   │   │   ├── page.tsx               # Agent-centric dashboard: "Your agents are working"
│   │   │   ├── listings/page.tsx      # My listings (agent-managed + manual)
│   │   │   ├── messages/page.tsx      # Messaging inbox
│   │   │   ├── favorites/page.tsx     # Saved listings
│   │   │   ├── subscription/page.tsx  # Manage plan & billing (Stripe portal)
│   │   │   ├── analytics/page.tsx     # Listing analytics (Pro/Business)
│   │   │   ├── agents/
│   │   │   │   ├── page.tsx           # My AI Agents dashboard
│   │   │   │   ├── sell/
│   │   │   │   │   └── new/page.tsx   # Create Selling Agent wizard
│   │   │   │   ├── buy/
│   │   │   │   │   └── new/page.tsx   # Create Buying Agent wizard
│   │   │   │   └── [id]/page.tsx      # Agent detail: timeline, actions, controls
│   │   │   └── saved-searches/page.tsx
│   │   ├── settings/
│   │   │   └── page.tsx               # Profile, locale, notifications, data export/delete (GDPR)
│   │   └── admin/
│   │       ├── page.tsx               # Admin dashboard (mostly monitoring agents)
│   │       ├── agents/page.tsx        # Operational agents status panel
│   │       └── moderation/page.tsx    # Escalation queue (agent-flagged items for human review)
│   ├── legal/
│   │   ├── terms/page.tsx             # Terms of Service
│   │   ├── privacy/page.tsx            # Privacy Policy (GDPR)
│   │   └── cookies/page.tsx            # Cookie Policy
│   ├── onboarding/
│   │   └── page.tsx                   # New user welcome flow
│   ├── api/
│   │   ├── trpc/[trpc]/route.ts       # tRPC API handler
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── upload/route.ts            # Image upload endpoint
│   │   ├── webhooks/
│   │   │   └── stripe/route.ts        # Stripe webhook handler
│   │   └── ai/
│   │       ├── generate-description/route.ts
│   │       ├── suggest-price/route.ts
│   │       └── analyze-image/route.ts
│   └── globals.css
├── middleware.ts                      # Next.js middleware: i18n routing, CSP headers, auth redirects, rate limiting
├── components/
│   ├── ui/                            # shadcn/ui components
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   ├── Sidebar.tsx
│   │   └── MobileNav.tsx
│   ├── listings/
│   │   ├── ListingCard.tsx            # Card component for listing previews
│   │   ├── ListingGrid.tsx            # Grid/list view of listings
│   │   ├── ListingDetail.tsx          # Full listing view
│   │   ├── ListingForm.tsx            # Create/edit form
│   │   ├── ImageGallery.tsx           # Image carousel/gallery
│   │   ├── FilterSidebar.tsx          # Search filters
│   │   ├── PriceDisplay.tsx           # Price with currency formatting
│   │   └── CategoryBreadcrumb.tsx
│   ├── categories/
│   │   ├── CategoryGrid.tsx           # Homepage category grid
│   │   ├── CategoryCard.tsx           # Individual category card with icon
│   │   └── SubcategoryList.tsx
│   ├── search/
│   │   ├── SearchBar.tsx              # AI-powered search bar
│   │   ├── SearchResults.tsx
│   │   └── NaturalLanguageSearch.tsx  # AI natural language input
│   ├── ai/
│   │   ├── AiListingAssistant.tsx     # AI helper for creating listings
│   │   ├── PriceAdvisor.tsx           # Price suggestion widget
│   │   ├── ImageAnalyzer.tsx          # Upload image → auto-detect category
│   │   └── TierGate.tsx              # Component that checks user tier before showing premium AI
│   ├── agents/
│   │   ├── AgentDashboard.tsx         # Overview of all active agents
│   │   ├── ConciergeChat.tsx          # Persistent chat bubble on EVERY page — entry point to all agents
│   │   ├── ConciergeChatWindow.tsx    # Full-screen concierge conversation (intent routing)
│   │   ├── SellingAgentWizard.tsx     # Conversational selling flow: photos → goals → agent takes over
│   │   ├── BuyingAgentWizard.tsx      # Conversational buying flow: describe → budget → agent monitors
│   │   ├── AgentTimeline.tsx          # Timeline of agent actions taken
│   │   ├── AgentCard.tsx             # Summary card for an active agent
│   │   ├── AgentStatusBadge.tsx       # Live status indicator (working / waiting / needs attention)
│   │   ├── PriceCurveVisualizer.tsx   # Shows the dynamic pricing curve (urgency-based)
│   │   ├── DealScoreCard.tsx         # Shows deal quality score for buying agent matches
│   │   └── LiquidationWizard.tsx     # Batch upload: identify items, price all, manage sales
│   ├── pricing/
│   │   ├── PricingTable.tsx           # Free/Pro/Business comparison table
│   │   ├── SubscriptionCard.tsx       # Individual plan card
│   │   └── BoostSelector.tsx          # A-la-carte boost purchase UI
│   ├── messaging/
│   │   ├── ChatWindow.tsx
│   │   ├── ConversationList.tsx
│   │   └── MessageBubble.tsx
│   └── maps/
│       └── LocationMap.tsx            # Leaflet map for listing location
├── server/
│   ├── trpc/
│   │   ├── index.ts                   # tRPC initialization
│   │   ├── router.ts                  # Root router
│   │   └── routers/
│   │       ├── listing.ts             # Listing CRUD operations
│   │       ├── category.ts            # Category queries
│   │       ├── user.ts                # User profile operations
│   │       ├── subscription.ts        # Subscription & payment operations
│   │       ├── message.ts             # Messaging operations
│   │       ├── favorite.ts            # Favorites operations
│   │       ├── search.ts              # Search operations
│   │       ├── agent.ts               # Agent CRUD + control operations (start, pause, stop, adjust)
│   │       └── ai.ts                  # AI-related operations (tier-gated)
│   ├── db/
│   │   └── index.ts                   # Prisma client singleton
│   └── services/
│       ├── ai-free.ts                 # Free tier AI (CLIP, embeddings, GitHub Models rate-limited)
│       ├── ai-premium.ts             # Paid tier AI (Azure OpenAI, Vision) — production only
│       ├── ai-dev.ts                  # Dev/test AI provider: GitHub Copilot CLI / GitHub Models API
│       ├── ai.ts                      # AI router: delegates to dev, free, or premium based on env + tier
│       ├── scraper-sslv.ts            # SsLvScraper: aggregates public market data (prices, durations, categories)
│       ├── stripe.ts                  # Stripe service (subscriptions, boosts, webhooks)
│       ├── agent-orchestrator.ts      # CORE: BullMQ job scheduling, agent state machine, lifecycle
│       ├── agent-concierge.ts         # Concierge: intent detection, routing to correct agent
│       ├── agent-selling.ts           # Selling agent logic: pricing strategy, auto-adjust, auto-respond
│       ├── agent-buying.ts            # Buying agent logic: monitor, score deals, auto-negotiate
│       ├── agent-pricing.ts           # Dynamic pricing engine: urgency curves, market analysis
│       ├── agent-moderation.ts        # Operational: auto-review listings, approve/flag/reject
│       ├── agent-support.ts           # Operational: AI customer support, FAQ, escalation
│       ├── agent-antifraud.ts         # Operational: real-time fraud detection on listings + messages
│       ├── agent-quality.ts           # Operational: stale listing cleanup, re-engagement
│       ├── agent-seo.ts               # Operational: meta generation, sitemaps, structured data
│       ├── agent-engagement.ts        # Operational: lifecycle emails, re-engagement, notifications
│       ├── agent-analytics.ts         # Operational: daily reports, anomaly detection, admin alerts
│       ├── search.ts                  # Meilisearch service
│       ├── storage.ts                 # File storage service
│       └── email.ts                   # Email notification service
├── lib/
│   ├── utils.ts                       # Utility functions
│   ├── constants.ts                   # App constants
│   └── validators.ts                  # Zod schemas
├── hooks/
│   ├── useListings.ts
│   ├── useCategories.ts
│   ├── useSearch.ts
│   └── useAi.ts
├── stores/
│   ├── useFilterStore.ts              # Search filters state
│   └── useUiStore.ts                  # UI state (sidebar, modals)
├── types/
│   └── index.ts                       # Shared TypeScript types
├── messages/                          # i18n translation files
│   ├── en.json
│   ├── lv.json
│   ├── ru.json
│   ├── lt.json
│   └── et.json
└── prisma/
    ├── schema.prisma                  # Database schema
    └── seed.ts                        # Seed data with categories
```

## Database Schema (Prisma)

Create a comprehensive Prisma schema with these models:

### User
- id, email, name, phone, avatar, passwordHash, role (USER/ADMIN/MODERATOR), emailVerified, locale (default 'en'), defaultLocationId
- createdAt, updatedAt, lastLoginAt, gdprConsentAt, marketingOptIn (boolean)
- Relations: listings, favorites, sentMessages, receivedMessages, reviews, subscription, sellingAgents, buyingAgents

### Category
- id, name (JSON for i18n: {en, lv, ru, lt, et}), slug, description, icon, parentId (self-relation for hierarchy), sortOrder, isActive
- Relations: parent, children, listings, attributes

### CategoryAttribute
- id, categoryId, name (JSON i18n), type (TEXT/NUMBER/SELECT/BOOLEAN), options (JSON array for SELECT type), isRequired, sortOrder
- This defines what fields a listing form shows per category (e.g., "Engine Size" for cars, "Rooms" for apartments)

### Listing
- id, title, description, price, currency (EUR default), negotiable (boolean), condition (NEW/USED/REFURBISHED)
- status (DRAFT/ACTIVE/SOLD/EXPIRED/MODERATION/REJECTED), userId, categoryId
- managedByAgent (boolean, default false) — true if a SellingAgent is managing this listing
- locationId, latitude, longitude, viewCount, contactPhone, contactEmail
- aiGeneratedDescription (boolean), aiSuggestedPrice
- createdAt, updatedAt, expiresAt
- Relations: user, category, images, attributes, favorites, messages, sellingAgent, boosts, priceHistory

### ListingImage
- id, listingId, url, thumbnailUrl, alt, sortOrder, isPrimary, aiTags (JSON)
- Relations: listing

### ListingAttribute
- id, listingId, categoryAttributeId, value
- Relations: listing, categoryAttribute

### Location
- id, name (JSON i18n), slug, parentId (for region hierarchy), latitude, longitude, type (COUNTRY/REGION/CITY/DISTRICT), countryCode (LV/LT/EE)
- Relations: parent, children, listings
- Seed with all 3 Baltic countries: Latvia (Riga, Jurmala, Daugavpils, Liepaja, etc.), Lithuania (Vilnius, Kaunas, Klaipeda, etc.), Estonia (Tallinn, Tartu, Parnu, etc.)

### Message
- id, conversationId, senderId, receiverId, listingId, content, isRead, createdAt
- Relations: sender, receiver, listing

### Conversation
- id, listingId, buyerId, sellerId, lastMessageAt, createdAt
- Relations: listing, buyer, seller, messages

### Favorite
- id, userId, listingId, createdAt
- Relations: user, listing

### SavedSearch
- id, userId, name, filters (JSON), notifyEmail (boolean), lastNotifiedAt, createdAt
- Relations: user

### Review
- id, reviewerId, revieweeId, listingId, rating (1-5), comment, createdAt
- Relations: reviewer, reviewee, listing

### PriceHistory
- id, listingId, price, changedAt
- Relations: listing

### Plan
- id, name (FREE/PRO/BUSINESS), price, currency, interval (MONTHLY/YEARLY)
- maxListings, maxPhotosPerListing, listingDurationDays, maxSavedSearches
- maxSellingAgents, maxBuyingAgents
- hasAiPremium (boolean), hasAnalytics (boolean), hasAutoTranslate (boolean), hasAutoNegotiate (boolean)
- stripePriceId, isActive
- Relations: subscriptions

### Subscription
- id, userId, planId, status (ACTIVE/CANCELLED/PAST_DUE/TRIALING)
- stripeSubscriptionId, stripeCustomerId
- currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd
- createdAt, updatedAt
- Relations: user, plan

### ListingBoost
- id, listingId, type (FEATURED/HIGHLIGHTED/TOP), startAt, endAt, stripePaymentId
- Relations: listing

### SellingAgent
- id, userId, listingId, status (ACTIVE/PAUSED/COMPLETED/CANCELLED)
- urgency (ONE_DAY/THREE_DAYS/ONE_WEEK/TWO_WEEKS/ONE_MONTH/NO_RUSH)
- startingPrice, minimumPrice, currentPrice, maxDiscountPercent
- autoRespond (boolean), autoNegotiate (boolean), autoBoost (boolean)
- autoAcceptAbove (float, nullable — "accept any offer above this")
- strategy (JSON — pricing curve parameters)
- deadline (datetime, nullable), priceAdjustSchedule (JSON — when to drop and by how much)
- totalViews, totalInquiries, totalOffers, bestOfferPrice
- createdAt, updatedAt, completedAt
- Relations: user, listing, actions, logs

### BuyingAgent
- id, userId, status (ACTIVE/PAUSED/COMPLETED/CANCELLED)
- searchCriteria (JSON — category, attributes, location, price range, condition)
- maxBudget, targetPrice (ideal price user wants)
- autoNegotiate (boolean), maxAutoOfferPrice
- notifyPush (boolean), notifyEmail (boolean)
- matchCount, bestMatchScore
- createdAt, updatedAt
- Relations: user, matches, logs

### AgentAction
- id, agentId, agentType (SELLING/BUYING), actionType (PRICE_ADJUST/AUTO_RESPOND/AUTO_NEGOTIATE/BOOST/ALERT/OFFER_SENT/OFFER_RECEIVED)
- description, metadata (JSON — old price, new price, message content, etc.)
- requiresApproval (boolean), approvedAt, rejectedAt
- createdAt
- Relations: sellingAgent or buyingAgent

### AgentMatch (for BuyingAgent)
- id, buyingAgentId, listingId, dealScore (0-100), analysis (JSON — score breakdown)
- status (NEW/VIEWED/CONTACTED/NEGOTIATING/PURCHASED/DISMISSED)
- autoOfferSent (boolean), offerPrice, counterOfferPrice
- createdAt
- Relations: buyingAgent, listing

### MarketSnapshot (for pricing engine)
- id, categoryId, locationId, date
- medianPrice, avgPrice, minPrice, maxPrice, listingCount, avgDaysToSell
- demandScore (search volume / listing count ratio)
- Relations: category, location

## Core Categories to Seed
Create seed data with these main categories and their subcategories:
1. **Transport** → Cars (by make), Motorcycles, Bicycles, Car Parts, Car Rental
2. **Real Estate** → Apartments, Houses, Land, Commercial, Offices (by region)
3. **Jobs** → Vacancies, Job Seekers, Courses, Business Contacts
4. **Electronics** → Phones, Computers, TV, Audio/Video, Appliances
5. **Clothing** → Women's, Men's, Children's, Shoes, Accessories
6. **Home & Garden** → Furniture, Décor, Plants, Tools
7. **Construction** → Materials, Services, Tools & Equipment
8. **Children** → Clothing, Toys, Strollers, Furniture
9. **Animals** → Dogs, Cats, Birds, Fish, Farm Animals
10. **Agriculture** → Livestock, Machinery, Seeds, Produce
11. **Entertainment** → Hobbies, Sports, Books, Music, Travel, Tickets
12. **Services** → Legal, Financial, Translation, Internet, Other

## Key Feature Requirements

### 1. Homepage (Agent-First)
- **Hero section**: Large Concierge prompt — "I want to sell something" / "I’m looking for something" — two big buttons + free-text input
- Persistent Concierge chat bubble (bottom-right, available on ALL pages)
- Category grid with icons and listing counts (for browse-mode users)
- Featured/promoted listings carousel (paid boosts shown here)
- Recent agent success stories: "Agent sold a bike for €850 in 3 days" (social proof)
- Quick stats (total listings, active agents working, items sold today)
- Country/region selector (Latvia, Lithuania, Estonia)
- Small "or browse manually" link for legacy users

### 2. Category Browse
- Breadcrumb navigation
- Subcategory grid with counts
- Quick filter bar at top
- Option to view all listings in category

### 3. Listing Search & Results
- Left sidebar with dynamic filters (change based on category)
- Grid/List view toggle
- Sort by: newest, price low-high, price high-low, most viewed
- Pagination with infinite scroll option
- Map view for location-based categories (real estate)
- Save search functionality

### 4. Listing Detail Page
- Image gallery with lightbox (swipeable on mobile)
- All attributes displayed in structured format
- Price with "Price Advisor" AI widget showing market comparison
- Seller info with rating
- Location map
- Contact buttons (message, phone, email)
- "Similar listings" section (AI-powered)
- Share buttons
- Report listing button

### 5. Sell Flow — Agent-First (PRIMARY: /sell)
A conversational experience, NOT a form:
1. User uploads photos (drag-and-drop)
2. Agent analyzes photos and says: "I see a [item]. Is this correct?"
3. Agent asks about urgency: "How quickly do you want to sell? (1 day to no rush)"
4. Agent proposes optimal price with explanation: "Based on 47 similar items, I recommend €850"
5. Agent asks for minimum acceptable price and negotiation rules
6. Agent confirms: "I’ll post Sunday 7 PM, manage everything, and send you daily updates. Sound good?"
7. Done. Agent handles everything from here.
- **Quick path**: Photo upload → 3 questions → agent takes over (under 60 seconds)
- Shows remaining agent slots: "2 of 5 selling agents available"

### 5b. Manual Listing Creation (LEGACY: /listings/new)
- Traditional step-by-step wizard: Category → Photos → Details → Price → Review
- Still has AI assistance (auto-fill from photos, price suggestions)
- But user manages the listing themselves
- Link from /sell page: "Prefer to do it yourself? Create manually"

### 6. User Dashboard (Agent-Centric)
- **Hero section**: "Your agents are working" with live agent status cards
- Active selling agents with real-time stats (views, messages, current price, last action)
- Active buying agents with latest matches and deal scores
- Agent action feed: chronological log of what agents did today
- Quick actions: pause agent, adjust price, approve negotiation
- Below: My Listings (with badge: "Agent-managed" / "Manual")
- Messages: conversation inbox (agent-handled messages shown with 🤖 badge)
- Favorites: saved listings with price change notifications
- Saved Searches: manage search alerts

### 7. Real-time Messaging
- In-app chat between buyer and seller (free for all users)
- Linked to specific listing
- Read receipts
- AI-powered auto-translate between LV/RU/EN/LT/ET (paid tier only, show upgrade prompt)

### 8. Pricing Page
- Side-by-side comparison of Free vs Pro vs Business
- Feature checkmarks and limits clearly shown
- Stripe Checkout integration for subscription
- Annual discount option (save 20%)
- A-la-carte boost purchase cards below

### 9. Subscription Dashboard
- Current plan with usage stats (listings used/remaining, photos, saved searches)
- Upgrade/downgrade buttons
- Billing history
- Stripe Customer Portal link for payment method management
- Cancel subscription flow

### 10. Admin Panel (Agent-Monitored)
- **Operational agents status panel**: live view of all operational agents (Moderation, Support, Anti-Fraud, Quality, SEO, Engagement, Analytics)
- Each agent shows: items processed today, auto-approved/flagged/rejected counts, error rate
- **Escalation queue**: only items that agents couldn’t handle confidently (human review)
- User management (rarely needed — Anti-Fraud Agent handles most)
- Category management (CRUD with drag-and-drop ordering)
- Revenue dashboard (MRR, subscriptions, boost revenue, churn)
- Analytics dashboard (mostly generated by Analytics Agent)

### 11. Agentic AI Experiences (Pro/Business — KEY DIFFERENTIATOR)

#### 11a. Selling Agent — "Sell It For Me"
Setup wizard where user provides:
1. Item photos + details (or selects existing listing)
2. **Urgency**: How fast to sell (1 day / 3 days / 1 week / 2 weeks / 1 month / no rush)
3. **Minimum price**: Lowest acceptable price
4. **Auto-negotiation rules**: max discount %, auto-accept threshold
5. **Auto-respond**: Toggle for common questions ("Is this available?")
6. **Auto-boost**: Allow agent to boost listing if engagement is low

The agent then autonomously:
- Calculates optimal starting price based on: urgency, market supply/demand, seasonality, location, competition freshness, item condition, seller reputation, day/time of posting
- Posts listing at optimal time (e.g., Sunday evening for max views)
- Monitors engagement (views, favorites, messages)
- Adjusts price on schedule (steeper curve for urgent, flat for no rush)
- Auto-responds to FAQs
- Negotiates within boundaries
- Sends daily summary to user: views, messages, price changes, recommendations
- Shows visual pricing curve with current position

Price factors the agent considers:
| Factor | Description |
|--------|-------------|
| Time urgency | Shorter deadline = start lower, decline faster |
| Market supply | More similar active listings = more competitive pricing |
| Market demand | High search volume for category = can price higher |
| Seasonality | Historical price pattern by month (winter tires peak Oct) |
| Item condition | How condition ranks vs similar listings |
| Location demand | Urban vs rural price variance |
| Posting timing | Best day/time for this category |
| Competition age | Older competing listings = less threat |
| Price elasticity | Category sensitivity to price changes |
| Seller reputation | Higher rating supports higher prices |

#### 11b. Buying Agent — "Find It For Me"
Setup wizard where user provides:
1. What they want (category, attributes, keywords)
2. Location preferences
3. Budget range (max budget + target/ideal price)
4. Auto-negotiation: on/off + max offer price
5. Notification preferences (push, email, frequency)

The agent then autonomously:
- Monitors all new listings 24/7
- Scores each match with a Deal Score (0-100) based on: price vs market, time on market, seller urgency signals, listing quality, seller reputation, location convenience, condition vs price
- Instantly alerts for high-scoring matches
- Auto-sends first message/offer if enabled
- Negotiates within budget boundaries
- Predicts price trends: "Wait 2 weeks, prices drop 8% in March" or "Buy now, 12% below market"

#### 11c. Liquidation Agent — "Sell Everything"
User uploads batch photos (e.g., apartment walkthrough) and sets a deadline:
- AI identifies and separates individual items
- Creates individual listings for each with optimal pricing
- Manages all simultaneously with deadline-based pricing
- Daily dashboard: "Sold 5/12 items, total €840, remaining value ~€600"

#### 11d. Timing Agent
- Analyzes historical data to advise: "Best time to sell winter tires: October (23% above average)"
- Category-specific seasonal calendars
- Optimal posting day/time recommendations

#### 11e. Watchdog Agent
- Alerts if someone copies your listing
- Scam pattern detection in incoming messages
- "This buyer contacted 50 sellers today with same lowball offer"

## Design Requirements
- **CORE PRINCIPLE: Lightweight, Fast, Modern, Simple** — validate every component against these four words. No bloated libraries, no unnecessary animations, no complex layouts. When in doubt, simplify.
- Modern, clean design with lots of white space
- Responsive (mobile-first approach)
- Dark mode support (next-themes)
- Smooth animations and transitions (Framer Motion)
- Accessible (WCAG 2.1 AA) — keyboard navigation, screen reader labels, focus indicators, color contrast
- Loading skeletons for all data-fetching states
- Empty states with helpful CTAs ("No listings yet? Let an agent sell your first item!")
- Toast notifications for actions (sonner)
- Color scheme: Primary blue (#2563EB), with warm accents
- Cookie consent banner on first visit (GDPR)
- Onboarding flow for new users (choose: sell / buy / browse)
- Image sizes: thumbnails 150x150 WebP, cards 400x300 WebP, detail 800x600 WebP, srcset for responsive
- PWA manifest for add-to-homescreen on mobile

## Security Requirements (CRITICAL — implement from day 1)
- All API inputs validated with Zod schemas server-side
- CSRF protection on all state-changing POST/PUT/DELETE operations
- Content Security Policy (CSP) headers via Next.js middleware
- XSS prevention: sanitize all user-generated content with DOMPurify
- File upload: whitelist JPEG/PNG/WebP only, max 10MB, strip EXIF metadata with Sharp, generate thumbnails
- Password: min 8 chars, hashed with bcrypt (12 rounds)
- Rate limiting: auth 5/min, API 100/min, uploads 20/min, agent 50/min
- HTTPS enforced, HSTS headers
- Stripe webhooks verified with signing secret
- Admin routes protected with role-based tRPC middleware
- Agent actions logged for audit trail
- GDPR: cookie consent, data export, data deletion, marketing opt-in

## Testing Strategy
- Vitest for unit tests (agent logic, pricing engine, AI router, Zod validators)
- tRPC integration tests with test PostgreSQL database
- Playwright E2E tests for: sell flow, buy flow, auth, payment, agent dashboard
- Coverage: 80%+ agent services, 60%+ overall
- GitHub Actions CI: lint + type-check + test on every PR
- Pre-commit: Husky + lint-staged (ESLint + Prettier)

## Docker Compose (Local Dev)
Provide a docker-compose.yml that starts:
- PostgreSQL 16 with pgvector extension
- Redis 7
- Meilisearch
- Ollama with llama3.1:8b model (optional, for free-tier AI testing)
- Mailpit (local email testing)

## Implementation Priority (AGENT-FIRST)
Start with Phase 1 — build the agent infrastructure FIRST, then everything else. **All code, comments, and documentation in English.**
1. Initialize Next.js project with TypeScript, Tailwind, shadcn/ui
2. Set up Prisma with PostgreSQL schema (ALL models: agents, operational agents, listings, plans)
3. **Set up BullMQ + Redis agent orchestration framework** — the CORE of the platform
4. **Implement agent state machine** (ACTIVE/PAUSED/COMPLETED/CANCELLED)
5. **Set up GitHub Copilot CLI / GitHub Models as the dev/test LLM provider** (server/services/ai-dev.ts)
6. **Build SsLvScraper service** (server/services/scraper-sslv.ts) to bootstrap MarketSnapshot data from ss.lv public listings
7. Implement authentication with NextAuth.js
8. Set up tRPC with routers (including agent.ts router)
9. Create the database seed script with all categories + Baltic locations (LV, LT, EE)
10. Set up next-intl with all 5 languages (EN primary, + LV, RU, LT, ET)
11. **Build the Concierge Chat component** (persistent bubble on every page)
12. **Build the /sell page with Selling Agent wizard** (conversational, not a form)
13. **Build the /buy page with Buying Agent wizard**
14. Build the agent-centric dashboard
15. Build manual listing creation as legacy fallback
16. Build the pricing page

Please start by scaffolding the project and implementing steps 1-12.
```

---

## 🧩 FOLLOW-UP PROMPTS (Use these after the initial scaffold)

### Prompt 2: Selling & Buying Agents (Core Flow)
```
Build the core agent experiences — this is what makes our platform unique:

**Concierge Agent (server/services/agent-concierge.ts):**
1. Build the ConciergeChat component — persistent floating chat bubble on EVERY page
2. Implement intent detection: classify user input into sell/buy/support/browse/other
3. Route to the appropriate agent wizard based on intent
4. Maintain conversation memory within session
5. Support all 5 languages (detect user language automatically)

**Selling Agent (/sell page + server/services/agent-selling.ts):**
1. Build conversational SellingAgentWizard — NOT a form, a chat-like flow:
   - User uploads photos → AI identifies item, confirms with user
   - Agent proposes category, title, description (user can adjust via chat)
   - Agent asks about urgency (1 day to no rush) and minimum price
   - Agent explains pricing strategy and starts autonomous management
2. Dynamic pricing engine (server/services/agent-pricing.ts):
   - Calculate optimal price from 10 factors: urgency, supply, demand, seasonality, condition, location, posting time, competition, price elasticity, seller reputation
   - Generate urgency-based pricing curves
   - Schedule automatic price adjustments via BullMQ recurring jobs
3. Auto-respond: detect common buyer questions, reply with AI responses
4. Auto-negotiate: handle offers, counter within seller's rules, accept above threshold
5. Auto-boost: suggest or auto-purchase boosts when engagement is low
6. Daily summary notifications: views, messages, price changes, recommendations
7. PriceCurveVisualizer component showing price trajectory with current position

**Buying Agent (/buy page + server/services/agent-buying.ts):**
1. Build conversational BuyingAgentWizard:
   - User describes what they want in natural language
   - Agent clarifies criteria, budget range, location preferences
   - Agent confirms and starts monitoring
2. Continuous listing monitor (BullMQ recurring job every 5 minutes):
   - Query Meilisearch for new matches
   - Score each with Deal Score (0-100): price vs market (30%), time on market (15%), seller urgency (15%), quality (10%), reputation (10%), location (10%), condition (10%)
3. DealScoreCard component with visual breakdown
4. Auto-offer: send initial message/offer based on market data
5. Auto-negotiate: counter within budget boundaries
6. Real-time push + email notifications for high-scoring matches
7. Price prediction: "Wait 2 weeks" or "Buy now" based on MarketSnapshot trends

**Agent Dashboard:**
1. /dashboard → Agent-centric overview: "Your agents are working" with live status cards
2. /dashboard/agents → all active agents with controls
3. /dashboard/agents/[id] → agent detail with AgentTimeline, stats, pause/resume/stop
```

### Prompt 3: Operational Agents (Platform Runs Itself)
```
Build the operational agents that keep the platform running autonomously:

**Moderation Agent (server/services/agent-moderation.ts):**
1. Register a BullMQ job that triggers on every new listing creation
2. Auto-review pipeline: text quality check → image appropriateness (Azure Content Safety or pHash-based) → pricing anomaly detection → duplicate detection → scam pattern matching
3. Three outcomes: APPROVE (instantly publish), FLAG (send to admin escalation queue with agent analysis), REJECT (auto-reject with explanation to user)
4. Learn from admin overrides: store corrections, adjust confidence thresholds
5. Handle reported listings: analyze report + listing + user history → recommend action

**Support Agent (server/services/agent-support.ts):**
1. Build persistent support chat accessible from /support and from any page
2. Train on: platform docs, FAQ, policies, billing info, common issues
3. Handle: account recovery, billing questions, "how do I...?", feature explanations, listing help, basic dispute mediation
4. Escalation logic: if confidence < 70% or topic is payment-dispute/legal/complex-fraud → create ticket for human admin
5. Auto-detect user language (LV/RU/EN/LT/ET) and respond accordingly
6. Goal: 90%+ resolution rate without human intervention

**Anti-Fraud Agent (server/services/agent-antifraud.ts):**
1. Real-time checks on every new listing: impossible price detection (statistical outlier), image reverse search (pHash cross-listing), velocity check (too many listings too fast), known scam template matching in descriptions
2. Real-time checks on messages: scam phrase detection, deposit/wire transfer requests, external link pushing
3. Behavioral analysis: new account + high-value listing = higher scrutiny score
4. Auto-block confirmed fraud, flag suspicious for human review

**Quality Agent (server/services/agent-quality.ts):**
1. Daily BullMQ job: find stale listings (no views in 14 days, expired, outdated)
2. Auto-contact sellers: "Your listing hasn’t had views. Want me to adjust price by 15% and relist?"
3. Auto-archive abandoned listings (no login + no views for 30 days)
4. Detect low-quality listings (no photos, <20 chars description) → send improvement suggestions
5. Find miscategorized listings using embeddings similarity → suggest category moves

**SEO Agent (server/services/agent-seo.ts):**
1. Auto-generate optimized meta titles + descriptions for every listing and category page
2. Generate and update XML sitemaps daily
3. Create landing pages for trending searches ("cheap apartments Riga 2026")
4. Add JSON-LD structured data to all listing pages
5. Monitor hreflang tags for all 5 languages

**Engagement Agent (server/services/agent-engagement.ts):**
1. Lifecycle email sequences: welcome (day 1), first sell prompt (day 3), re-engagement (2 weeks inactive)
2. Real-time triggers: "Your saved search has 3 new matches", "Your listing views dropped — shall I adjust?"
3. Seasonal prompts: "Items like yours sell 30% faster this month"
4. Smart frequency control: adapt email frequency to user engagement level

**Analytics Agent (server/services/agent-analytics.ts):**
1. Daily CRON: generate platform health report (new users, listings, revenue, agent activity, errors)
2. Anomaly detection: alert admin on sudden drops/spikes
3. Weekly executive summary auto-generated
4. Capture MarketSnapshot data daily per category+location for pricing engine

**Admin operational agents dashboard (/admin/agents):**
1. Live status panel for all operational agents: items processed, approve/flag/reject rates, error counts
2. Escalation queue: only items agents couldn’t handle (with agent’s analysis attached)
3. Override interface: admin corrects agent decisions, agent learns from corrections
```

### Prompt 4: Search, Browse & Legacy Mode
```
Build the browse/search experience for users who prefer traditional interaction:
1. Set up Meilisearch integration in server/services/search.ts
2. Create the FilterSidebar component with dynamic category-specific filters
3. Build the listings search page with grid/list toggle, sorting, and pagination
4. Implement the SearchBar component with debounced search and suggestions
5. Add saved search functionality with email notification support
6. Implement map view for real estate listings using Leaflet
7. Build the manual listing creation page (/listings/new) as legacy fallback
8. Add "or create manually" link from /sell page
9. Add "or let an agent find it" prompt on search results page
```

### Prompt 5: Freemium, Payments & AI Provider Router
```
Implement the subscription system and AI provider routing:

**AI Provider Router (server/services/ai.ts):**
1. Create a unified AI service that routes based on AI_PROVIDER env var + user tier:
   - AI_PROVIDER="github" → use GitHub Models API (dev/test, free with Copilot)
   - AI_PROVIDER="azure" + paid user → use Azure OpenAI GPT-4o (production)
   - AI_PROVIDER="ollama" or free user in prod → use Ollama self-hosted fallback
2. Build server/services/ai-dev.ts: GitHub Copilot CLI / GitHub Models integration
   - Use GITHUB_TOKEN and GITHUB_MODELS_ENDPOINT
   - Implement chat completions compatible API (same interface as Azure OpenAI)
   - All agents use this during development — zero Azure costs
3. Build server/services/ai-free.ts: CLIP client-side, all-MiniLM embeddings, Ollama fallback
4. Build server/services/ai-premium.ts: Azure OpenAI GPT-4o, Azure AI Vision
5. Agents automatically use the correct provider — all have the same interface

**SS.lv Market Data Scraper (server/services/scraper-sslv.ts):**
1. Build scraper that collects AGGREGATED statistics only from ss.lv public pages:
   - Price ranges by category + region (median, min, max, count)
   - Average listing duration (date posted vs current date)
   - Category structure and common attributes
   - Listing volume per category/region
2. NEVER collect: personal data, verbatim descriptions, images, user info
3. Respect robots.txt, rate limit to 1 req/sec (SSLV_SCRAPER_RATE_LIMIT_MS)
4. Store as MarketSnapshot records in database
5. Run as BullMQ CRON job (SSLV_SCRAPER_CRON)
6. Feature flag: SSLV_SCRAPER_ENABLED — disable once own data is sufficient

**Stripe Integration:**
1. Create Plan and Subscription models, seed 3 plans (Free, Pro €4.99/mo, Business €19.99/mo)
2. Set up Stripe webhooks, tier enforcement middleware in tRPC
3. Agent tier gating: free agents use ai-free, paid agents use ai-premium
4. Build Pricing page, Subscription dashboard, ListingBoost purchase
```

### Prompt 6: Messaging, Negotiation & Agent Communication
```
Implement communication — tightly integrated with agents:
1. Set up Socket.io server for real-time messaging
2. Build messaging UI: ConversationList, ChatWindow, MessageBubble
3. Agent-message integration: when a selling/buying agent sends a message on behalf of user, show it with 🤖 badge
4. User can see agent's outgoing messages and override/edit before sending (if auto-negotiate requires approval)
5. Implement auto-respond: selling agent detects "Is this available?" and replies instantly
6. Implement auto-negotiate: agent sends counter-offers, shows negotiation flow to user
7. AI message translation for Pro/Business users (LV↔RU↔EN↔LT↔ET)
8. Push notifications for new messages (agent-sent and direct)
9. Email notification service for: agent updates, price drops on favorites, saved search matches
```

### Prompt 7: Additional Agents & Polish
```
Build remaining agents and polish the platform:

**Liquidation Agent:**
1. Build LiquidationWizard: batch photo upload → AI identifies individual items → creates listings for each
2. Set overall deadline → pricing engine manages all items with progressive price drops
3. Dashboard: items sold/remaining, total revenue, projected final amount

**Timing Agent:**
1. Query MarketSnapshot for seasonal price calendars per category
2. API: category + location → best month to sell/buy + best day/time to post
3. Show timing tips in Concierge and sell flows

**Swap Agent:**
1. Find listings where counterparty might want your item
2. Propose swap + cash difference based on market values

**Investment Scout (Business only):**
1. Monitor for underpriced items with high resale margin
2. Alert when opportunities appear

**Watchdog Agent:**
1. Duplicate listing detection (pHash + text similarity)
2. Scam pattern detection in incoming messages
3. Suspicious behavior flagging
```

### Prompt 8: Admin, Revenue & Monitoring
```
Build the admin panel with revenue tracking:
1. Create an admin layout with sidebar navigation
2. Build the moderation queue with approve/reject/flag actions
3. Implement category management with CRUD and drag-and-drop ordering
4. Create a revenue dashboard showing:
   - Monthly Recurring Revenue (MRR) from subscriptions
   - Boost revenue (one-time payments)
   - Subscription breakdown (Free vs Pro vs Business user counts)
   - Churn rate and upgrade/downgrade trends
5. Create an analytics dashboard showing:
   - Listings per category and per country (bar chart)
   - New listings over time (line chart)
   - Most popular searches (word cloud)
   - User registration trends by country
6. Add user management with ban/warn capabilities
7. Implement reporting system for flagged listings
8. Location/country management for Baltic expansion
9. **Operational agents monitoring**: live status, items processed, error rates, AI cost tracking
10. **Escalation queue**: only agent-flagged items that need human review
```

### Prompt 9: i18n, GDPR & Polish
```
Add internationalization, legal compliance, and final polish:
1. Set up next-intl with locale routing ([locale] prefix)
2. Create translation files for all 5 languages: EN, LV, RU, LT, ET with all UI strings
3. Add language switcher in the navbar (flag icons for 🇬🇧 🇱🇻 🇷🇺 🇱🇹 🇪🇪)
4. Add country/region selector that influences default language and location filters
5. Implement dark mode with next-themes
6. Add loading skeletons for all pages
7. Add empty states with helpful CTAs for all list views
8. Implement proper SEO with metadata, OpenGraph, and structured data (JSON-LD)
9. Add proper error boundaries and 404/500 pages in all languages
10. Performance optimization: image optimization (WebP, srcset, lazy-load), lazy loading, code splitting
11. Accessibility audit and fixes (keyboard nav, screen reader, focus indicators)
12. Add hreflang tags for multi-language SEO across Baltic countries
13. GDPR compliance: cookie consent banner, /legal/terms, /legal/privacy, /legal/cookies pages
14. User settings: /dashboard/settings with profile, locale, notifications, data export, account deletion
15. Email verification flow (/auth/verify-email)
16. Password reset flow (/auth/forgot-password)
17. Onboarding flow for new users (/onboarding)
18. PWA manifest for mobile add-to-homescreen
19. Health check endpoint: /api/health (DB, Redis, Meilisearch, BullMQ status)
20. docker-compose.yml for local dev (PostgreSQL+pgvector, Redis, Meilisearch, Ollama, Mailpit)
```

---

## 📋 Environment Variables Needed

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/marketplace"

# Auth
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRO_PRICE_ID="price_..."
STRIPE_BUSINESS_PRICE_ID="price_..."

# AI Provider Selection
AI_PROVIDER="github"  # "github" for dev/test, "azure" for production paid tier, "ollama" for self-hosted fallback

# GitHub Copilot / GitHub Models (Dev/Test LLM — free with Copilot subscription)
GITHUB_TOKEN=""  # Your GitHub personal access token with Copilot access
GITHUB_MODELS_ENDPOINT="https://models.inference.ai.azure.com"
GITHUB_MODELS_MODEL="gpt-4o"  # Or other available model via GitHub Models

# Azure OpenAI (Production — Paid tier only)
AZURE_OPENAI_API_KEY=""
AZURE_OPENAI_ENDPOINT=""
AZURE_OPENAI_DEPLOYMENT_NAME="gpt-4o"

# Azure AI Vision (Production — Paid tier)
AZURE_VISION_API_KEY=""
AZURE_VISION_ENDPOINT=""

# Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING=""
AZURE_STORAGE_CONTAINER_NAME="listings"

# Ollama (Self-hosted fallback for free tier in production)
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="llama3.1:8b"

# SS.lv Scraper (Market data bootstrap)
SSLV_SCRAPER_ENABLED="true"  # Set to "false" once own data is sufficient
SSLV_SCRAPER_RATE_LIMIT_MS="1000"  # Min delay between requests (respect their servers)
SSLV_SCRAPER_CRON="0 3 * * *"  # Run daily at 3 AM

# Meilisearch
MEILISEARCH_HOST="http://localhost:7700"
MEILISEARCH_API_KEY=""

# Redis
REDIS_URL="redis://localhost:6379"

# Email (e.g., Resend)
RESEND_API_KEY=""
```
