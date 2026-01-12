# PaperLink - Internal Specification Document

> **Last Updated**: 2026-01-12  
> **Current Version**: v0.3.0  
> **Maintainer**: @usnaveen

---

## 1. Project Overview

**PaperLink** is a Progressive Web App (PWA) that bridges handwritten paper notes to digital content. Users can shorten URLs into short codes, write those codes on paper, and later scan their handwriting with OCR to retrieve the original URLs.

### Core Value Proposition
- **Write**: Generate short codes from URLs
- **Scan**: OCR handwritten codes to retrieve URLs

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript |
| Styling | CSS Modules + CSS Variables |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (Google OAuth) |
| OCR | Tesseract.js (Client-side) |
| Hosting | Vercel |
| Font | Google Fonts - "Doto" (Variable), "Inter" |

---

## 3. Directory Structure

```
paperlink/
├── app/
│   ├── page.tsx           # Home (Write)
│   ├── scan/page.tsx      # Scanner
│   ├── design/page.tsx    # Design Lab (Internal)
│   ├── [code]/page.tsx    # Redirect handler
│   ├── api/
│   │   ├── shorten/route.ts   # URL shortening API
│   │   └── resolve/route.ts   # Code resolution API
│   ├── globals.css
│   └── layout.tsx
├── components/
│   └── AuthButton.tsx
├── lib/
│   ├── auth.ts
│   └── supabase.ts
├── public/
│   └── assets/
└── docs/
    ├── spec.md             # This file
    └── features.md         # Version tracking
```

---

## 4. Environment Variables

| Key | Description | Required |
|-----|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anon key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key (server only) | ✅ |

---

## 5. Database Architecture (Supabase)

### 5.1 Overview
We use **Supabase** (hosted PostgreSQL) as our database backend. The database stores shortened links with user ownership tracking and is secured using **Row Level Security (RLS)** for data isolation between users.

> **Fallback Mode**: If Supabase is not configured (missing env vars), the app automatically uses an **in-memory store** for development. This data is lost on restart.

### 5.2 Table Schema: `links`

```sql
CREATE TABLE links (
    id          SERIAL PRIMARY KEY,
    short_code  TEXT NOT NULL UNIQUE,
    original_url TEXT NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    click_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP WITH TIME ZONE,
    user_id     UUID REFERENCES auth.users(id) -- NULL for anonymous links
);

-- Index for fast code lookups
CREATE INDEX idx_links_short_code ON links(short_code);

-- Index for user dashboard queries
CREATE INDEX idx_links_user_id ON links(user_id);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Auto-increment primary key |
| `short_code` | TEXT | Unique short code (e.g., "PL-AB1-C23") |
| `original_url` | TEXT | The full original URL |
| `created_at` | TIMESTAMP | When the link was created |
| `click_count` | INTEGER | Number of times redirected |
| `last_accessed` | TIMESTAMP | Last redirect timestamp |
| `user_id` | UUID | FK to `auth.users` (nullable for anonymous) |

### 5.3 Row Level Security (RLS) Policies

RLS ensures **data isolation** between users while allowing public access for link resolution.

```sql
-- Enable RLS on the table
ALTER TABLE links ENABLE ROW LEVEL SECURITY;
```

#### Policy 1: Public Read Access
**Anyone can resolve any short code** (necessary for redirects to work):
```sql
CREATE POLICY "Public links viewable by everyone" 
ON links FOR SELECT 
TO public 
USING (true);
```

#### Policy 2: Authenticated Insert
**Logged-in users can create links assigned to themselves**:
```sql
CREATE POLICY "Users can insert own links" 
ON links FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);
```

#### Policy 3: Anonymous Insert (via Service Role)
**Anonymous users can create links** but the API uses the `service_role` key which bypasses RLS. This is necessary because anonymous users don't have an `auth.uid()`.

#### Policy 4: Owner-Only Update
**Users can only update their own links**:
```sql
CREATE POLICY "Users can update own links" 
ON links FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

#### Policy 5: Owner-Only Delete
**Users can only delete their own links**:
```sql
CREATE POLICY "Users can delete own links" 
ON links FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);
```

### 5.4 Data Isolation Strategy

```
┌─────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                    │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐    │
│  │ User A      │   │ User B      │   │ Anonymous   │    │
│  │ Links       │   │ Links       │   │ Links       │    │
│  │ (user_id=A) │   │ (user_id=B) │   │ (user_id=   │    │
│  │             │   │             │   │  NULL)      │    │
│  └─────────────┘   └─────────────┘   └─────────────┘    │
├─────────────────────────────────────────────────────────┤
│  RLS ENFORCEMENT:                                       │
│  • User A → Can only see/edit User A's links            │
│  • User B → Can only see/edit User B's links            │
│  • Public  → Can resolve ANY link (read short_code)     │
│  • Anonymous → Can create links (via service_role API)  │
└─────────────────────────────────────────────────────────┘
```

### 5.5 CRUD Operations (`lib/db.ts`)

#### Create Link
```typescript
createLink(shortCode: string, originalUrl: string, userId?: string): Promise<Link>
```
- Inserts a new link with optional user ownership
- Uses `service_role` key to bypass RLS (allows anonymous inserts)

#### Read Link by Code
```typescript
getLinkByCode(shortCode: string): Promise<Link | undefined>
```
- Publicly accessible (RLS allows all SELECTs)
- Used for redirect resolution

#### Check for Duplicate
```typescript
getLinkByUserAndUrl(userId: string, url: string): Promise<Link | undefined>
```
- Prevents duplicate links for the same user+URL combo
- Only checks for logged-in users (respects privacy)

#### Update Click Count
```typescript
recordClick(shortCode: string): Promise<void>
```
- Increments `click_count` and updates `last_accessed`
- Called on every redirect

#### Get All Codes (for Fuzzy Matching)
```typescript
getAllCodes(): Promise<string[]>
```
- Returns all short codes for OCR fuzzy matching
- Used in scanner to suggest close matches

### 5.6 Adding/Deleting Links via Supabase Dashboard

#### To ADD a Link Manually:
1. Go to Supabase Dashboard → Table Editor → `links`
2. Click **"Insert row"**
3. Fill in:
   - `short_code`: Your desired code (e.g., "MY-TEST-01")
   - `original_url`: Full URL
   - `user_id`: Leave NULL or paste a user UUID
4. Click **"Save"**

#### To DELETE a Link:
1. Go to Table Editor → `links`
2. Find the row by `short_code`
3. Click the **trash icon** or select → **Delete**

> **Note**: Only links with matching `user_id` will appear in a user's future dashboard (when implemented). Anonymous links (`user_id = NULL`) are orphaned but still functional.

---

## 6. API Endpoints

### `POST /api/shorten`
**Request**:
```json
{ "url": "https://example.com", "userId": "optional-uuid" }
```
**Response**:
```json
{ "code": "PL-AB1-C23", "shortUrl": "https://paperlink.app/PL-AB1-C23" }
```

### `GET /api/resolve?code=PL-AB1-C23`
**Response**:
```json
{ "url": "https://example.com" }
```

---

## 7. Design System

### LCD Blue Theme (Primary)
```css
--lcd-bg: #0055aa;
--lcd-dot-inactive: rgba(255, 255, 255, 0.2);
--lcd-dot-active: #ffffff;
--lcd-glow: 0 0 4px #ffffff;
```

### Dot Grid Pattern
```css
background-image: radial-gradient(circle, var(--dot-inactive) 1.5px, transparent 2px);
background-size: 6px 6px;
```

### Typography
- **Display Font**: `Doto` (Variable, weight 100-900)
- **Body Font**: `Inter`
- **Label Font**: Monospace

---

## 8. Agent Coordination Rules

> These rules ensure consistency when multiple AI agents work on the codebase.

### 8.1 Code Style
- Use **functional components** with hooks
- Use **inline styles** for component-specific styling
- Use **CSS variables** for theme values
- Keep components **self-contained** (avoid prop drilling)

### 8.2 File Naming
- Components: `PascalCase.tsx`
- Utilities: `camelCase.ts`
- Pages: `page.tsx` (Next.js convention)

### 8.3 State Management
- Use `useState` for local state
- Use `useEffect` for side effects
- No external state libraries (keep it simple)

### 8.4 Documentation Updates
- **ALWAYS** update `docs/features.md` when shipping a new feature
- **ALWAYS** bump version number in UI footer
- **ALWAYS** commit with conventional commit messages

### 8.5 Branch Strategy
- `main` - Production
- `feature/*` - Feature branches
- `fix/*` - Bug fixes
- `design/*` - Design experiments

---

## 9. Component Reference

### `<DotMatrixDisplay />`
Located in design experiments. Uses CSS grid pattern + Doto font.

### `<AuthButton />`
Google OAuth sign-in/out button.

---

## 10. Future Roadmap

- [ ] Offline support (Service Worker)
- [ ] QR code generation fallback
- [ ] User dashboard with link history
- [ ] Multi-language OCR support
