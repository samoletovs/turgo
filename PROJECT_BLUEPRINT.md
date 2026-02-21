# 🏪 Modern Classifieds Marketplace — Project Blueprint

## 0. Core Philosophy: AGENT-FIRST Architecture

> **"Think agent first. Manual is legacy."**

> **"Lightweight. Fast. Modern. Simple. Always."** — Every change, every feature, every commit must be checked against these four words. If it adds weight, slows the page, looks dated, or complicates the UX — it doesn't ship.

This platform is fundamentally different from every classifieds site that exists. SS.lv and every competitor is built around manual forms — the user does everything. We flip this completely:

### The Paradigm Shift

| | SS.lv (Legacy Model) | **Our Platform (Agent-First)** |
|---|---|---|
| **Selling** | User fills form, sets price, manages listing manually | User tells agent "sell this for the best price in 2 weeks" — **agent does everything** |
| **Buying** | User searches, browses, contacts sellers manually | User tells agent "find me a BMW X5 under €25K" — **agent hunts 24/7** |
| **Pricing** | User guesses a price | **Agent calculates optimal price** from 10+ market factors |
| **Negotiation** | User handles all messages | **Agent auto-negotiates** within user's rules |
| **Listing creation** | User types title, description, picks category | User uploads photo — **agent creates entire listing** |
| **Customer support** | Human support team | **AI Support Agent handles 90%+ of queries** |
| **Moderation** | Human moderators | **AI Moderation Agent auto-reviews** all content |
| **Maintenance** | Manual operations | **Platform runs itself** — agents handle operations |

### Three User Paths

```
┌─────────────────────────────────────────────────────────┐
│                    USER ENTERS PORTAL                    │
│                                                         │
│  ┌─────────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  🤖 AGENT PATH  │  │  ⚡ QUICK    │  │  📝 MANUAL │ │
│  │  (Recommended)  │  │  (Hybrid)    │  │  (Legacy)  │ │
│  │                 │  │              │  │            │ │
│  │ "Sell this for  │  │ Upload photo │  │ Fill form  │ │
│  │  me" / "Find    │  │ → AI fills   │  │ yourself   │ │
│  │  me a deal"     │  │   everything │  │ like ss.lv │ │
│  │                 │  │ → You review │  │            │ │
│  │ Agent handles   │  │ → You post   │  │ You manage │ │
│  │ EVERYTHING      │  │              │  │ everything │ │
│  │ autonomously    │  │ Semi-auto    │  │ manually   │ │
│  └─────────────────┘  └──────────────┘  └────────────┘ │
│       80% users           15% users         5% users    │
└─────────────────────────────────────────────────────────┘
```

### Primary User Experience (Agent Path)

**Selling:** User opens app → "I want to sell something" → uploads photos → agent conversation:
1. Agent: *"I see a Canyon mountain bike, 2022 model, good condition. Correct?"*
2. User: *"Yes, and I want to sell it within 2 weeks"*
3. Agent: *"Based on 47 similar bikes on the market, I recommend starting at €850. The median is €780, but yours is in better condition. Minimum price?"*
4. User: *"Don't go below €650"*
5. Agent: *"Done. I'll post it Sunday 7 PM for maximum visibility, adjust price automatically, respond to buyers, and negotiate above €650. I'll send you a daily summary."*
6. **User does nothing else.** Agent handles everything until sold.

**Buying:** User opens app → "I want to buy something" → describes what they need:
1. Agent: *"Looking for a 2-room apartment in Riga center, €400-600/month. Correct?"*
2. User: *"Yes, must have a balcony and parking"*
3. Agent: *"I found 12 current matches. Best deal: Barona iela, €480/mo, balcony + parking, Deal Score 87/100. 3 more are promising. I'll monitor 24/7 and alert you instantly when better deals appear. Should I auto-contact landlords?"*
4. **Agent watches the market non-stop**, alerts on great deals, negotiates on behalf.

### Operational Agents (The Portal Runs Itself)

| Agent | Role | Replaces |
|-------|------|----------|
| **🛡️ Moderation Agent** | Auto-reviews every listing: text quality, image appropriateness, pricing anomalies, duplicate detection, scam patterns. Only escalates edge cases to human admin. | Human moderators (90% reduction) |
| **💬 Support Agent** | Handles all user support via chat: account issues, billing questions, how-to guides, dispute mediation. Escalates complex cases. | Customer support team |
| **📊 Analytics Agent** | Monitors platform health: detects anomalies, generates reports, suggests category optimizations, identifies trending items. Alerts admin only when intervention needed. | Manual reporting |
| **🧹 Quality Agent** | Finds and flags stale listings, contacts sellers of expired items ("Want to relist? I can update the price."), maintains data hygiene. | Manual cleanup |
| **🌍 SEO Agent** | Generates and updates meta descriptions, monitors search rankings, suggests content improvements, creates landing pages for trending searches. | SEO team |
| **📧 Engagement Agent** | Sends personalized re-engagement: "Your saved search has 3 new matches", "Your listing views dropped — shall I adjust the price?", "Similar items are selling 20% faster this week". | Email marketing |
| **🔒 Anti-Fraud Agent** | Real-time fraud detection: impossible prices, stolen images (reverse image search), velocity checks, known scammer patterns, seller/buyer behavior anomalies. | Risk team |

## 1. SS.lv Analysis & Competitive Strategy

**SS.lv** is Latvia's largest classifieds portal (since 2000). Key observations:

### Current Features
| Feature | Description |
|---------|-------------|
| **Hierarchical Categories** | 12+ top-level categories (Transport, Real Estate, Jobs, Electronics, etc.) with deep sub-categories |
| **Category-specific Filters** | Cars: price, year, engine, transmission, body, color. Real estate: location/region, price, rooms, area |
| **Listing Management** | Submit, edit, manage own listings behind login |
| **Search** | Basic keyword search within categories |
| **Favorites/Memo** | Save listings for later |
| **Multi-language** | Latvian + Russian only |
| **Location/Region** | Region-based browsing (especially real estate) with interactive map |
| **RSS Feeds** | Per-category RSS |
| **Listing Counts** | Shows item count per sub-category |
| **Revenue Model** | **Paid listings** — users must pay to post announcements + paid advertisement/promotion |

### SS.lv Weaknesses (Our Opportunities)
- **Dated UI** — table-based layout, no responsive design, early 2000s aesthetic
- **No AI assistance** — manual listing creation, basic keyword search only
- **No real-time messaging** — relies on phone/email
- **No price intelligence** — no market price suggestions
- **No image recognition** — manual category selection and tagging
- **No personalization** — no recommendation engine
- **Limited mobile experience** — not mobile-first
- **Paid-only model** — barrier to entry for casual sellers
- **Latvia-only** — only LV + RU, missing entire Baltic market (Lithuania, Estonia)
- **No free tier** — every listing costs money, pushing casual users away
- **Slow, heavy pages** — old server-rendered HTML with no modern optimization

---

## 2. How We Beat SS.lv — Competitive Strategy

### 2.1 Freemium Model (Free Listings = Market Disruption)

| | SS.lv (Incumbent) | **Our Platform** |
|---|---|---|
| **Selling experience** | Fill forms manually | **Tell agent "sell this" → it's done** |
| **Buying experience** | Search manually | **Tell agent "find me X" → 24/7 monitoring** |
| **Post a listing** | Paid | **FREE** (up to 10 active/month) |
| **Photos per listing** | Limited | **5 free / 20 paid** |
| **Listing duration** | Short (paid renewal) | **30 days free / 90 days paid** |
| **AI listing assistant** | None | **Agent creates & manages everything** |
| **Price optimization** | User guesses | **Agent calculates from 10+ market factors** |
| **Negotiation** | User handles | **Agent auto-negotiates 24/7** |
| **Search** | Basic keyword | **Full-text free / Natural language AI paid** |
| **Customer support** | None | **AI Support Agent (instant, 24/7)** |
| **Languages** | LV, RU | **LV, RU, EN, LT, ET** |
| **Mobile** | Poor | **Mobile-first responsive** |
| **Messaging** | None (phone/email) | **Built-in real-time chat (agent-assisted)** |
| **Speed** | Slow | **Sub-second loads (SSR + CDN)** |

**Strategy**: Free listings attract the user base. Once users are on the platform, they pay for premium features that give them an edge (AI descriptions, top placement, analytics).

### 2.2 Revenue Streams

| Tier | Price | Features |
|------|-------|----------|
| **Free** | €0 | 10 listings/month, 5 photos each, 30-day duration, basic AI agent (open-source), 1 selling agent + 1 buying agent (basic), in-app messaging, AI support chat |
| **Pro** | ~€4.99/mo | 50 listings/month, 20 photos each, 90-day duration, **full AI agents (GPT-4o)**, 5 selling + 5 buying agents with auto-negotiation, natural language search, price advisor, timing advice, watchdog protection |
| **Business** | ~€19.99/mo | Unlimited listings, **unlimited agents**, bulk liquidation agent, investment scout, analytics dashboard, company profile, verified badge, API access |
| **A-la-carte Boosts** | €0.99-4.99 | Feature listing on top (24h/7d), highlight with color, homepage promotion |

### 2.3 Baltic Expansion (LV + LT + ET + EN + RU)
- **English is the primary development and documentation language**
- **5 UI languages from day one** — English as universal, plus all 3 Baltic languages + Russian
- Locations seeded for all 3 Baltic countries (Latvia, Lithuania, Estonia)
- Currency support: EUR (all three countries use Euro)
- Regional SEO: target `tirgus.lv`, `skelbimai.lt`, `kuulutused.ee` style domains or single unified portal

### 2.4 SS.lv as Market Intelligence Source

SS.lv's publicly available data is our **bootstrap market intelligence** — we use it to seed our pricing engine, train our agents, and understand product categories before we have our own data.

**What we collect (aggregated statistics only):**
| Data | Purpose | Legal Status |
|------|---------|-------------|
| Price ranges by category + region | Seed MarketSnapshot table for agent pricing engine | Public data, aggregated |
| Average listing duration / time-to-sell | Train timing agent, urgency pricing curves | Derived analytics |
| Category structure & attribute patterns | Understand what attributes matter per category | Public taxonomy |
| Description patterns (not verbatim text) | Train agents on what info sellers typically include | Pattern learning, no copying |
| Listing volume per category/region | Understand supply/demand dynamics | Public counts |
| Seasonal price trends | Timing agent recommendations | Historical aggregates |

**What we NEVER collect:**
- Personal data (names, phones, emails) — GDPR violation
- Verbatim listing descriptions — copyright
- User account information — irrelevant and illegal
- Images — copyright owned by uploaders

**Implementation:**
- Build a `SsLvScraper` service that runs as a BullMQ CRON job (daily/weekly)
- Respects robots.txt, rate-limits requests (max 1 req/sec)
- Stores only aggregated `MarketSnapshot` records (median price, count, avg duration per category+location)
- Scraper is a bootstrap tool — once our platform has sufficient data, we phase it out and use our own data
- All code clearly documented: "Market research data from publicly available sources"

### 2.5 Key Differentiators

| Advantage | Impact |
|-----------|--------|
| **Agent-first architecture** | Users don't manage listings — agents do. **Nothing like this exists.** |
| **Zero-effort selling** | Upload photo → agent handles everything → item sold |
| **24/7 buying agent** | Agent watches the market non-stop and strikes when the deal is right |
| **Self-operating platform** | Moderation, support, quality, SEO — all automated by agents |
| **Free listings** | Removes barrier → rapid user growth |
| **Modern UX** | Mobile-first, fast, beautiful → higher engagement |
| **AI for everyone** | Even free tier gets lightweight AI → "wow" factor |
| **Pan-Baltic** | 6M+ combined population vs Latvia's 1.8M |
| **Built-in messaging** | No need to share phone numbers → safer, trackable |
| **Speed** | Next.js SSR + edge caching → 10x faster than ss.lv |
| **SEO** | Modern tech = better Core Web Vitals = higher Google ranking |

---

## 3. AI Strategy — Dev/Test vs Production

### Development & Testing (GitHub Copilot CLI)
| Feature | Technology | Cost |
|---------|-----------|------|
| **Agent reasoning & text generation** | GitHub Copilot CLI / GitHub Models API (GPT-4o via your Copilot subscription) | Free (included in Copilot) |
| **Image categorization** | CLIP (ViT-B/32) via Transformers.js running client-side | Free |
| **Similar listings** | Sentence-Transformers (all-MiniLM-L6-v2) for embeddings + pgvector | Free (compute only) |
| **Price statistics** | SQL aggregation from MarketSnapshot table (seeded from ss.lv data) | Free |
| **Spam/duplicate detection** | Text similarity hashing + image perceptual hashing (pHash) | Free |
| **Market data bootstrap** | SsLvScraper — aggregated price/duration/category data from ss.lv | Free |

### Production — Free Tier
| Feature | Technology | Cost |
|---------|-----------|------|
| **Agent reasoning** | GitHub Models API (rate-limited) or Ollama self-hosted as fallback | Free / compute only |
| **Image categorization** | CLIP client-side | Free |
| **Embeddings** | all-MiniLM-L6-v2 | Free |
| **Price intelligence** | Own MarketSnapshot data (replaces ss.lv bootstrap once sufficient) | Free |

### Production — Paid Tier (Azure OpenAI / Premium)
| Feature | Technology | Why It's Worth Paying |
|---------|-----------|----------------------|
| **Premium Agent AI** | Azure OpenAI GPT-4o — polished descriptions, smart negotiation, complex reasoning | Agents perform 3x better |
| **Natural Language Search** | GPT-4o — "Find me a 2-room apartment in Riga center under €500" → structured query | Effortless discovery |
| **Advanced Price Advisor** | GPT-4o + regression model — price prediction, trend, "your price vs market" analysis | Sell at optimal price |
| **Image Auto-Tagging** | Azure AI Vision — detailed attribute extraction from photos (car model, color, condition) | Zero-effort listing creation |
| **AI Chat Translate** | GPT-4o — real-time message translation between LV/RU/EN/LT/ET | Cross-language commerce |
| **Smart Recommendations** | Embeddings + collaborative filtering — personalized "for you" feed | Higher engagement |
| **Content Moderation** | Azure AI Content Safety — detect fraud, inappropriate content, stolen images | Trust & safety |

---

## 4. Proposed Technology Stack

### Frontend
| Technology | Purpose |
|-----------|---------|
| **Next.js 15** (App Router) | React framework with SSR/SSG for SEO, streaming, server components |
| **TypeScript** | Type safety across the entire codebase |
| **Tailwind CSS v4** | Utility-first styling |
| **shadcn/ui** | High-quality, accessible UI components (built on Radix) |
| **TanStack Query v5** | Server state management, caching, optimistic updates |
| **Zustand** | Lightweight client state management |
| **next-intl** | Internationalization (LV, RU, EN, LT, ET — 5 languages) |
| **Framer Motion** | Smooth animations and transitions |
| **React Hook Form + Zod** | Form management with schema validation |
| **Leaflet / Mapbox GL** | Interactive maps for location-based listings |

### Backend
| Technology | Purpose |
|-----------|---------|
| **Next.js API Routes + tRPC** | Type-safe API layer with end-to-end type inference |
| **PostgreSQL 16** | Primary relational database |
| **Prisma ORM** | Type-safe database access, migrations, schema management |
| **Redis** | Caching, session storage, rate limiting, real-time pub/sub |
| **Meilisearch** | Lightning-fast full-text search with typo tolerance and faceted filtering |
| **Azure Blob Storage** | Image/file storage with CDN |
| **Socket.io / Ably** | Real-time messaging between buyers and sellers |

### AI & Intelligence Layer
| Technology | Purpose | Environment |
|-----------|--------|------------|
| **GitHub Copilot CLI / GitHub Models** | Primary LLM for dev/testing — text generation, agent reasoning, descriptions, NL search | Dev + Test |
| **CLIP (ViT-B/32)** | Free image categorization (client-side via Transformers.js) | All |
| **all-MiniLM-L6-v2** | Free sentence embeddings for similar listings (via pgvector) | All |
| **pHash + SimHash** | Free duplicate/spam detection via perceptual and text hashing | All |
| **Azure OpenAI (GPT-4o)** | Production LLM for paid tier — premium agents, NL search, translation | Production (Paid) |
| **Azure AI Vision** | Production image analysis, auto-tagging, attribute extraction | Production (Paid) |
| **Azure AI Content Safety** | Moderate listings for inappropriate content | Production |
| **Embeddings + pgvector** | Semantic search, personalized recommendations | All |

> **Dev/Test Strategy:** Use **GitHub Copilot CLI** (`gh copilot` / GitHub Models API) as the LLM provider during development and testing. It's free with your GitHub Copilot subscription, supports chat completions, and avoids Azure OpenAI costs during development. Switch to Azure OpenAI for production paid tier.

### Market Intelligence
| Technology | Purpose |
|-----------|--------|
| **SsLvScraper** | Bootstrap market data from ss.lv — prices, durations, category patterns (aggregated only) |
| **MarketSnapshot CRON** | Daily capture of price/demand stats per category+location (own data + ss.lv bootstrap) |

### Auth & Security
| Technology | Purpose |
|-----------|---------|
| **NextAuth.js v5 (Auth.js)** | Authentication (email, social, phone) |
| **Role-based access** | Admin, seller, buyer roles |
| **Subscription tiers** | Free, Pro, Business with Stripe integration |
| **Rate limiting** | Prevent abuse (upstash/ratelimit) |

### DevOps & Infrastructure
| Technology | Purpose |
|-----------|---------|
| **Azure App Service / Vercel** | Hosting and deployment |
| **Docker + Docker Compose** | Local development environment (PostgreSQL, Redis, Meilisearch, Ollama — all containerized) |
| **GitHub Actions** | CI/CD pipelines (lint, test, build, deploy) |
| **Azure Monitor / Sentry** | Error tracking and performance monitoring |
| **Terraform** | Infrastructure as code (optional) |
| **Vitest + Playwright** | Unit/integration testing + E2E testing |
| **Husky + lint-staged** | Pre-commit hooks for code quality |

### Security
| Technology | Purpose |
|-----------|--------|
| **Helmet.js / CSP headers** | Content Security Policy, X-Frame-Options, HSTS |
| **CSRF tokens** | Protect state-changing operations |
| **Zod validation** | Server-side input validation on ALL endpoints |
| **DOMPurify** | HTML sanitization to prevent XSS |
| **Sharp** | Image processing: resize, convert to WebP, strip EXIF metadata |
| **File type validation** | Accept only JPEG/PNG/WebP, max 10MB, virus scan via ClamAV or Azure |
| **bcrypt** | Password hashing (min 12 rounds) |
| **@upstash/ratelimit** | Per-endpoint rate limiting (auth: 5/min, API: 100/min, upload: 20/min) |

### Performance & Caching
| Technology | Purpose |
|-----------|--------|
| **Redis caching** | Cache hot queries: category tree (1h TTL), listing counts (5min), MarketSnapshot (1h), user session |
| **Next.js ISR** | Incremental Static Regeneration for category pages (revalidate: 300s) |
| **CDN (Azure CDN / Vercel Edge)** | Static assets, images served from edge |
| **Image optimization** | Sharp: generate WebP thumbnails (150x150, 400x300, 800x600), lazy-load below fold |
| **Database indexes** | Composite indexes on: (categoryId, status, createdAt), (userId, status), (locationId, categoryId), pgvector IVFFLAT index on embeddings |
| **Connection pooling** | PgBouncer or Prisma Accelerate for database connection pooling |
| **Bundle optimization** | Dynamic imports, tree shaking, route-based code splitting |

---

## 5. AI-Powered Features — Free vs Paid

### 5.1 🤖 AI Listing Assistant
| Capability | Free | Paid (Pro/Business) |
|-----------|------|--------------------|
| Image → category suggestion | CLIP (basic, top-3 categories) | Azure Vision (precise, with attributes) |
| Title & description generation | Llama 3.1 8B (decent quality) | GPT-4o (polished, compelling copy) |
| Attribute auto-fill | None | Yes (car make/model from photo, etc.) |
| Price suggestion | Median + range from DB stats | AI regression + market trend analysis |

### 5.2 🔍 Search
| Capability | Free | Paid |
|-----------|------|------|
| Full-text search | Meilisearch (fast, typo-tolerant) | Same |
| Filters & facets | Full access | Same |
| Natural language search | None | GPT-4o converts "red BMW under 10k" → filters |
| Saved search alerts | 3 saved searches | Unlimited |

### 5.3 💰 Price Advisor
| Capability | Free | Paid |
|-----------|------|------|
| Price range for category | Median, min, max | Full distribution chart |
| "Your price vs market" | None | "15% above average" with chart |
| Price trend over time | None | 6-month trend chart |

### 5.4 🛡️ Trust & Safety
| Capability | Free | Paid |
|-----------|------|------|
| Spam detection | pHash + SimHash (duplicates) | Same |
| Content moderation | Basic keyword filter | Azure AI Content Safety (images + text) |
| Fraud detection | Community reporting | AI-powered anomaly detection |

### 5.5 🎯 Recommendations
| Capability | Free | Paid |
|-----------|------|------|
| Similar listings | Sentence embeddings (all-MiniLM) | GPT-4o enhanced + collaborative filtering |
| Personalized feed | None | "For you" based on history |
| Email digests | Weekly (basic) | Daily smart digest |

### 5.6 💬 Messaging
| Capability | Free | Paid |
|-----------|------|------|
| In-app messaging | Yes | Yes |
| Read receipts | Yes | Yes |
| Auto-translate (LV↔RU↔EN↔LT↔ET) | None | GPT-4o real-time translation |

### 5.7 📊 Analytics (Paid Only)
- How your listing compares to competition
- Price heatmaps by region
- Demand trends per category
- View count analytics and buyer demographics

---

## 5A. Agentic AI — THE CORE PLATFORM EXPERIENCE

> Agents are not a feature — they ARE the platform. Every user interaction starts with "what do you want to achieve?" and an agent makes it happen.

This is our **fundamental differentiator** — no classifieds platform has autonomous AI agents that act on behalf of users. While ss.lv asks users to fill forms, we ask users to set goals.

### 5A.0 🧠 Concierge Agent — "What Do You Need?"

The **entry point** for all users. A conversational AI that greets every user and routes them:

- *"I want to sell something"* → Starts Selling Agent flow
- *"I'm looking for something"* → Starts Buying Agent flow
- *"I want to sell everything before moving"* → Starts Liquidation Agent
- *"When's the best time to sell my car?"* → Timing Agent
- *"I have a problem with my account"* → Support Agent
- *"I want to browse manually"* → Legacy manual mode

The Concierge is available as a persistent chat bubble on every page — the user can always talk to it.

### 5A.1 🤖 Selling Agent — "Sell It For Me"

The user says: *"I want to sell this bicycle for the best possible price within 2 weeks."*
The agent takes over and autonomously:

**Phase 1 — Smart Listing Creation**
- Analyzes photos to generate optimal title, description, and attributes
- Researches the market: scans all similar listings to determine price positioning

**Phase 2 — Dynamic Pricing Strategy**
The agent calculates the best price based on these parameters:

| Parameter | Impact on Price | How It's Calculated |
|-----------|----------------|---------------------|
| **Time urgency** | Shorter deadline = lower starting price | User selects: 1 day / 3 days / 1 week / 2 weeks / 1 month / no rush |
| **Market supply** | Many similar items = more competitive price | Count of active similar listings in same category + region |
| **Market demand** | High demand = higher price possible | Search volume for this category, view-to-inquiry ratio on similar items |
| **Seasonality** | Winter tires worth more in October than April | Historical price data by month for this category |
| **Item condition** | New/Like New commands premium | Compared to condition distribution of similar listings |
| **Location demand** | Riga center vs rural area | Price variance by region from historical data |
| **Day of week** | Listings posted Sunday evening get more views | Historical view data by posting day/time |
| **Competition freshness** | Competing listings are old = opportunity | Average age of competing listings |
| **Price elasticity** | How sensitive is this category to price changes | Historical sold-price vs listed-price ratio |
| **Seller reputation** | Higher rating = can charge more | Seller's review score and history |

**Phase 3 — Autonomous Execution**
1. Posts listing at calculated optimal price and best time of day/week
2. Monitors views, favorites, and inquiries in real-time
3. **Auto-adjusts price** on a schedule:
   - Day 1-3: Premium price (test the market)
   - Day 4-7: If low engagement, reduce by 5-10%
   - Week 2: More aggressive reduction if urgency is high
   - Notifies seller before each adjustment (with option to override)
4. **Auto-boosts** the listing if engagement is low (charges from seller's balance or asks approval)
5. **Auto-responds** to common buyer questions ("Is this still available?" → "Yes, still available!")
6. **Auto-negotiates** within seller's pre-set boundaries:
   - Minimum acceptable price (set by user)
   - Maximum discount percentage
   - "Accept any offer above €X" mode
7. Reports back with daily summary: views, messages, price changes, and recommendations

**Urgency Curves:**
```
Price
  │ ★ Start
  │  ╲
  │   ╲_____ "No rush" (flat, wait for right buyer)
  │    ╲
  │     ╲___ "1 month" (gentle decline)
  │      ╲
  │       ╲_ "1 week" (steeper decline)
  │        ╲
  │         ╲ "1 day" (aggressive pricing to sell fast)
  └──────────────────── Time
```

### 5A.2 🛒 Buying Agent — "Find It For Me"

The user says: *"I want a BMW X5 2018-2022, under €25,000, automatic, in Latvia. Find me the best deal."*
The agent works autonomously:

**Continuous Monitoring**
1. Watches all new listings 24/7 across all relevant categories
2. Scores each match on value-for-money (price vs condition, mileage, features)
3. Instantly alerts user when a great deal appears (push notification + email)

**Smart Deal Scoring**
| Factor | Weight | Description |
|--------|--------|-------------|
| **Price vs market** | 30% | How far below/above median price |
| **Time on market** | 15% | New listing = less competition; old = negotiation room |
| **Seller urgency signals** | 15% | Price drops, "urgent" keywords, short deadline |
| **Listing quality** | 10% | More photos & details = more trustworthy |
| **Seller reputation** | 10% | Rating, response time, history |
| **Location convenience** | 10% | Distance from buyer's location |
| **Condition vs price** | 10% | Condition premium/discount analysis |

**Auto-Negotiation (with user approval)**
1. Agent sends initial message to seller with an offer
2. Uses negotiation strategies based on market data:
   - "Similar items are listed at €X, would you consider €Y?"
   - "This has been listed for 3 weeks, would you take €Z?"
3. Counter-offers within buyer's pre-set budget range
4. Escalates to buyer when a deal is close to closing

**Price Prediction**
- "Wait 2 weeks — prices for this model typically drop 8% in March"
- "Buy now — this is 12% below market and won't last"

### 5A.3 🔄 Swap Agent — "Trade My Item"

*"I have an iPhone 14 and want a Samsung Galaxy S24. Find me a swap."*

1. Finds listings where the other party might want your item
2. Proposes swap + cash difference based on market values
3. Manages the conversation and negotiation for both parties

### 5A.4 📦 Liquidation Agent — "Sell Everything"

*"I'm moving abroad in 1 month. Help me sell all my furniture."*

1. User uploads batch photos (apartment walkthrough or individual items)
2. AI identifies and separates individual items from photos
3. Creates individual listings for each item with optimal pricing
4. Manages all listings simultaneously with urgency-based pricing
5. Progressively lowers prices as the deadline approaches
6. Gives daily dashboard: "Sold 5/12 items, total €840, remaining value ~€600"

### 5A.5 📈 Investment Scout Agent — "Spot Opportunities"

For Business users who buy/resell:
1. Monitors specific categories for underpriced items
2. Calculates potential profit margin (buy price vs likely sell price)
3. Alerts when high-margin opportunities appear
4. Tracks market trends: "Mountain bikes are trending up 15% — good time to stock up"

### 5A.6 🕐 Timing Agent — "When Should I Sell/Buy?"

Analyzes historical data to answer:
- "Best time to sell winter tires: October (prices peak 23% above average)"
- "Best time to buy a car: January (prices are 8% below annual average)"  
- "Post your listing Sunday 7-9 PM for 40% more views in first 24h"
- Category-specific seasonal calendars

### 5A.7 🛡️ Watchdog Agent — "Protect Me"

Runs in background for all users:
- Alerts if someone copies your listing (image + text similarity)
- Detects known scam patterns in messages you receive
- Warns about suspicious buyer/seller behavior
- "This buyer has contacted 50 sellers today with the same lowball offer"

### Agent Tier Access

| Agent | Free | Pro | Business |
|-------|------|-----|----------|
| Concierge Agent | Full | Full | Full |
| Selling Agent | 1 active (basic AI) | 5 active (GPT-4o, auto-negotiate) | Unlimited (full auto) |
| Buying Agent | 1 watch (basic alerts) | 5 watches (auto-negotiate, deal scores) | Unlimited (bulk negotiate) |
| Swap Agent | None | Yes | Yes |
| Liquidation Agent | None | Up to 10 items | Unlimited |
| Investment Scout | None | None | Yes |
| Timing Agent | Basic tips | Full seasonal analysis | Full + custom alerts |
| Watchdog Agent | Basic (stolen listing alert) | Full protection | Full + competitor monitoring |
| Support Agent | Full (AI handles 90%+) | Full + priority escalation | Full + dedicated account manager |

### 5A.8 🏗️ Operational Agents (Platform Runs Itself)

These agents keep the platform running with minimal human intervention:

#### 🛡️ Moderation Agent
- Auto-reviews every new listing within seconds: text quality check, image appropriateness (Azure Content Safety), pricing anomaly detection, duplicate detection (pHash + text similarity), scam pattern matching
- **Approve** (90%+ of listings) → listing goes live instantly
- **Flag** (suspicious) → listing enters review queue with agent's analysis for human admin
- **Reject** (clear violation) → auto-rejection with explanation sent to user
- Learns from admin overrides to improve over time
- Handles reported listings: analyzes report + listing + user history → recommends action

#### 💬 Support Agent
- Embedded chat on every page — the first line of support
- Trained on platform docs, FAQs, policies, and common issues
- Handles: account recovery, billing questions, "how do I...?", feature explanations, listing help, dispute mediation
- Escalates to human admin only for: payment disputes, legal issues, complex fraud cases
- Goal: **90%+ resolution rate without human intervention**
- Multilingual (LV/RU/EN/LT/ET) — auto-detects user language

#### 📊 Analytics Agent
- Runs daily: generates platform health report (new users, listings, revenue, agent activity)
- Detects anomalies: sudden drop in listings, spike in reports, unusual traffic patterns
- Auto-alerts admin Slack/email only when intervention is needed
- Suggests optimizations: "Category 'Electronics > Phones' has 40% stale listings — recommend auto-archive"
- Generates weekly executive summary

#### 🧹 Quality Agent
- Finds stale listings (no views in 14 days, expired, outdated info)
- Auto-contacts sellers: "Your listing has been up for 30 days with no interest. Want me to adjust the price by 15% and relist?"
- Archives clearly abandoned listings
- Identifies low-quality listings (no photos, minimal description) → suggests improvements via notification
- Maintains category hygiene: detects miscategorized listings and suggests moves

#### 🌍 SEO Agent
- Auto-generates optimized meta titles/descriptions for every listing and category page
- Monitors search rankings for key terms in all 5 languages
- Creates landing pages for trending searches ("cheap apartments Riga 2026")
- Suggests content improvements: "Category 'Transport > Cars' is missing structured data for 2,000 listings"
- Generates XML sitemaps, manages canonical URLs, internal linking

#### 📧 Engagement Agent
- Personalized lifecycle emails:
  - "Welcome! Here's how to sell your first item in 30 seconds" (day 1)
  - "Your saved search has 3 new matches" (real-time)
  - "Your listing views dropped 40% — want me to adjust the price?" (proactive)
  - "You haven't visited in 2 weeks — here's what's new in your favorites" (re-engagement)
  - "Items like yours sell 30% faster this month — relist now?" (seasonal)
- Smart frequency control: doesn't spam, adapts to user engagement level
- A/B tests subject lines and content autonomously

#### 🔒 Anti-Fraud Agent
- Real-time checks on every listing and message:
  - Price too good to be true? (Statistical outlier detection)
  - Stolen images? (Reverse image search + cross-platform comparison)
  - Velocity check: user posting 50 listings in 1 hour?
  - Known scam templates in messages ("Send me a deposit via Wire Transfer")
  - Phone number / email blacklist matching
  - New account + high-value listing = higher scrutiny
- Auto-blocks confirmed fraud, flags suspicious for human review
- Learns patterns: "Users from this IP range have 80% fraud rate"

---

## 6. Application Architecture (Agent-First)

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (Next.js)                      │
│  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌───────────────┐ │
│  │ Pages   │ │Components│ │ Hooks  │ │ Concierge     │ │
│  │ (App    │ │(shadcn/  │ │(TanStack│ │ Chat Bubble   │ │
│  │ Router) │ │ ui)      │ │ Query) │ │ (every page)  │ │
│  └────┬────┘ └────┬─────┘ └───┬────┘ └──────┬────────┘ │
│       └───────────┴───────────┴──────────────┘          │
│                        │ tRPC                           │
├────────────────────────┼────────────────────────────────┤
│              AGENT ORCHESTRATION (Core)                  │
│  ┌──────────────────────────────────────────────────┐   │
│  │              BullMQ + Redis Job Queue             │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐         │   │
│  │  │Concierge │ │ Selling  │ │ Buying   │         │   │
│  │  │ Agent    │ │ Agents   │ │ Agents   │         │   │
│  │  └──────────┘ └──────────┘ └──────────┘         │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐         │   │
│  │  │Liquidate │ │ Timing   │ │ Watchdog │         │   │
│  │  │ Agent    │ │ Agent    │ │ Agent    │         │   │
│  │  └──────────┘ └──────────┘ └──────────┘         │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐         │   │
│  │  │Moderation│ │ Support  │ │Anti-Fraud│         │   │
│  │  │ Agent    │ │ Agent    │ │ Agent    │         │   │
│  │  └──────────┘ └──────────┘ └──────────┘         │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐         │   │
│  │  │ Quality  │ │  SEO     │ │Engagement│         │   │
│  │  │ Agent    │ │ Agent    │ │ Agent    │         │   │
│  │  └──────────┘ └──────────┘ └──────────┘         │   │
│  └──────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│                   SERVER (Next.js API)                   │
│  ┌──────────┐ ┌───────────┐ ┌─────────────────────┐    │
│  │ tRPC     │ │ Auth.js   │ │  AI Services        │    │
│  │ Routers  │ │ Sessions  │ │  Azure OpenAI / LLM │    │
│  └────┬─────┘ └─────┬────┘ └─────────┬───────────┘    │
│  ┌────┴──────────────┴───────────────┴───┐             │
│  │            Prisma ORM                  │             │
│  └────┬─────────┬────────────┬───────────┘             │
├───────┼─────────┼────────────┼──────────────────────────┤
│  ┌────┴───┐ ┌───┴────┐ ┌────┴─────┐ ┌───────────┐     │
│  │Postgres│ │ Redis  │ │Meilisearch│ │Azure Blob│     │
│  │+pgvector│ │        │ │          │ │  Storage  │     │
│  └────────┘ └────────┘ └──────────┘ └───────────┘     │
└─────────────────────────────────────────────────────────┘
```

---

## 7. Database Schema (Core Entities)

```
User ──────────── Listing ──────────── Category
 │                  │                     │
 │                  ├── ListingImage      ├── CategoryAttribute
 │                  ├── ListingAttribute  │
 │                  ├── PriceHistory      │
 │                  ├── ListingBoost      │
 │                  │                     │
 ├── Message ───────┘                     │
 ├── Favorite ──────┘                     │
 ├── SavedSearch                          │
 ├── Review                               │
 ├── Subscription ──── Plan               │
 │                                        │
 ├── SellingAgent ──── AgentAction        │
 ├── BuyingAgent ───── AgentMatch         │
 └── AgentLog                             │
                                          │
Country ────────── Location               │
Region   ─────────── Category ────────────┘
```

---

## 8. Page Structure (Agent-First)

```
/                           → Home: Concierge chat prompt ("What do you need?") + category grid + featured
/sell                       → Selling Agent wizard (primary CTA — NOT a form)
/buy                        → Buying Agent wizard ("What are you looking for?")
/categories/[slug]          → Category page with sub-categories (browse mode)
/listings                   → Search results with filters (browse mode)
/listings/[id]              → Listing detail (gallery, attributes, map, similar, agent actions)
/listings/new               → Manual listing creation (legacy mode, link says "or create manually")
/listings/[id]/edit         → Edit listing
/pricing                    → Free vs Pro vs Business comparison page
/support                    → AI Support Agent chat (+ FAQ, escalation)
/onboarding                 → New user welcome flow (choose: sell / buy / browse)
/legal/terms                → Terms of Service
/legal/privacy              → Privacy Policy (GDPR compliant)
/legal/cookies              → Cookie Policy
/dashboard                  → Agent-centric dashboard: "Your agents are working"
/dashboard/agents            → All active agents (selling, buying, watchdog) with live status
/dashboard/agents/sell/new   → Create new Selling Agent
/dashboard/agents/buy/new    → Create new Buying Agent
/dashboard/agents/[id]       → Agent detail (timeline, actions, results, controls)
/dashboard/listings         → My listings (agent-managed + manual)
/dashboard/messages         → Messaging inbox (agent-handled shown with badge)
/dashboard/favorites        → Saved listings
/dashboard/saved-searches   → Saved search alerts
/dashboard/subscription     → Manage plan, billing (Stripe portal)
/dashboard/analytics        → Listing analytics (Pro/Business only)
/dashboard/settings         → Profile, locale, notification preferences, data export/delete (GDPR)
/auth/signin                → Authentication
/auth/register              → Registration
/auth/verify-email          → Email verification
/auth/forgot-password       → Password reset
/admin                      → Admin panel (mostly agent-managed, human oversight)
/admin/agents               → Operational agents status: Moderation, Support, SEO, Quality, Fraud
/[locale]/...               → All routes support LV/RU/EN/LT/ET
```

---

## 9. Development Phases (Agent-First)

### Phase 1: Agent Infrastructure & Foundation (Weeks 1-4)
- Project scaffolding (Next.js, TypeScript, Tailwind, Prisma) — **all code and docs in English**
- Database schema & migrations (ALL models including Agent, Operational Agent models)
- **BullMQ + Redis agent orchestration framework** — this is built FIRST
- **Agent state machine** (ACTIVE/PAUSED/COMPLETED/CANCELLED)
- **GitHub Copilot CLI integration** as LLM provider for dev/testing
- **SsLvScraper service** — bootstrap market data from ss.lv (prices, durations, categories)
- Authentication system
- i18n setup with all 5 languages (EN primary, + LV, RU, LT, ET)
- Basic listing CRUD (agent-created and manual)
- Image upload pipeline

### Phase 2: Concierge + Selling Agent (Weeks 5-7)
- **Concierge Agent**: chat interface on every page, intent routing, conversation memory
- **Selling Agent wizard** (/sell): photos → agent conversation → set goals → agent takes over
- Dynamic pricing engine (10 market factors, urgency curves)
- Auto-price adjustment scheduler
- Agent dashboard UI: active agents, timeline, controls
- Daily summary notifications
- Manual listing creation as fallback (/listings/new — "or create manually")

### Phase 3: Buying Agent + Search (Weeks 8-10)
- **Buying Agent wizard** (/buy): describe what you want → agent monitors 24/7
- Meilisearch integration for agent queries and manual browse
- Deal scoring engine (0-100 with 7 weighted factors)
- Real-time alerts (push + email) for matches
- Auto-offer and auto-negotiate within buyer's budget
- Traditional search/filter as browse mode fallback
- Baltic locations seed (Latvia, Lithuania, Estonia)

### Phase 4: Operational Agents (Weeks 11-13)
- **Moderation Agent**: auto-review all new listings, approve/flag/reject
- **Support Agent**: AI chat for user help, FAQ, escalation
- **Anti-Fraud Agent**: real-time fraud detection on listings + messages
- **Quality Agent**: stale listing cleanup, re-engagement suggestions
- **SEO Agent**: auto-generate meta descriptions, sitemaps, structured data
- **Engagement Agent**: lifecycle emails, re-engagement, personalized notifications
- **Analytics Agent**: daily health reports, anomaly detection, admin alerts
- Admin oversight dashboard for all operational agents

### Phase 5: Freemium & Payments (Weeks 14-15)
- Stripe integration for subscriptions and one-time boosts
- Free/Pro/Business tier enforcement (agent limits, photo limits, duration)
- Pricing page with feature comparison
- Subscription management dashboard
- Agent tier gating (free = basic AI, pro = GPT-4o, business = unlimited)

### Phase 6: Communication & Polish (Weeks 16-18)
- Real-time messaging (Socket.io) — agent-assisted conversations
- Auto-respond and auto-negotiate integration with messaging
- AI message translation (paid tier)
- Liquidation Agent, Timing Agent, Swap Agent, Watchdog Agent
- Mobile optimization & performance tuning
- Dark mode, loading skeletons, animations

### Phase 7: Launch (Weeks 19-20)
- Admin panel (mostly monitoring agents, handling escalations)
- Revenue dashboard (subscriptions, boosts, MRR)
- Final QA, security audit
- SEO optimization for all 3 Baltic countries
- Launch preparation: legal, terms, privacy policy

---

## 10. Non-Functional Requirements

### Security
- All API inputs validated with Zod schemas server-side (never trust client)
- CSRF protection on all state-changing operations
- Content Security Policy (CSP) headers via middleware
- XSS prevention: sanitize all user-generated HTML with DOMPurify
- File upload validation: type whitelist (JPEG/PNG/WebP), max 10MB, EXIF stripping, optional virus scan
- Password requirements: min 8 chars, hashed with bcrypt (12 rounds)
- Rate limiting per endpoint: auth routes 5/min, API 100/min, uploads 20/min, agent actions 50/min
- HTTPS enforced everywhere, HSTS headers
- Stripe webhooks verified with signing secret
- Admin routes protected by role-based middleware
- Agent actions logged for audit trail (AgentAction model with full metadata)

### GDPR & Privacy
- Cookie consent banner (required for EU/Baltic users)
- Privacy Policy and Terms of Service pages
- User data export endpoint (download all personal data as JSON)
- User data deletion endpoint (GDPR "right to be forgotten" — anonymize or delete)
- SsLvScraper: NEVER collects personal data
- Email opt-in for marketing (engagement agent respects unsubscribe)
- Data retention policy: auto-delete inactive accounts after 2 years with notice

### Performance Targets
- **Design checkpoint (EVERY change):** Before merging any PR, ask: "Is it still lightweight? Is it still fast? Does it look modern? Is it simple?" If any answer is no — refactor before merging.
- Time to First Byte (TTFB): < 200ms
- Largest Contentful Paint (LCP): < 2.5s
- First Input Delay (FID): < 100ms
- Cumulative Layout Shift (CLS): < 0.1
- API response time: < 300ms (p95)
- Search results: < 50ms (Meilisearch)
- Image load: lazy-load, WebP, responsive srcset
- Bundle size: < 200KB initial JS (gzipped)

### Testing Strategy
- **Unit tests**: Vitest for all services (agent logic, pricing engine, AI router, validators)
- **Integration tests**: tRPC router tests with test database
- **E2E tests**: Playwright for critical user flows (sell flow, buy flow, auth, payment)
- **Coverage target**: 80%+ for agent services, 60%+ overall
- **CI**: GitHub Actions runs lint + type-check + test on every PR
- **Pre-commit**: Husky + lint-staged runs ESLint + Prettier

### Error Handling & Logging
- Structured logging: use `pino` logger with JSON output
- Log levels: ERROR (alerts), WARN (monitor), INFO (events), DEBUG (dev only)
- Agent actions always logged at INFO level with full metadata
- Sentry integration for error tracking with source maps
- Global error boundary in Next.js with user-friendly error pages
- tRPC error handling: typed errors with user-facing messages
- Agent failures: auto-retry 3x, then pause agent and notify user

### Observability
- Health check endpoint: `/api/health` (DB, Redis, Meilisearch, BullMQ status)
- Agent metrics: jobs processed/failed per hour, average processing time
- AI cost tracking: log token usage per request, aggregate daily cost
- Dashboard: active users, active agents, listings created, revenue (real-time)

---
