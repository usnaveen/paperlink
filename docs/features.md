# PaperLink - Feature Tracking & Version History

> This document tracks all features shipped with each version.  
> The version number is displayed in the app footer.

---

## Current Version: `v0.3.0`

---

## Version History

### v0.3.0 (2026-01-12)
**Branch**: `design/dot-matrix-experiment` → `main`

#### ✨ Features
- **Dot Matrix Display**: Integrated LCD Blue dot matrix for header display
- **Code Display Theme**: Green dot matrix theme for generated codes
- **Fixed Bottom Nav**: Write/Scan buttons moved to fixed bottom bar
- **Centered Layout**: Page content now vertically centered
- **Version Footer**: Added v0.3.0 version number at bottom

#### 🛠️ Changes
- Preserved original Winamp-style card design
- Added Doto variable font for dot matrix text
- Created reusable dot matrix style functions

---

### v0.2.0 (2026-01-11)
**Branch**: `feature/scanner-improvements`

#### ✨ Features
- **Masked Viewfinder**: Sniper-style scan box
- **Digital Zoom**: 1.5x CSS zoom on camera
- **Adaptive Thresholding**: Better OCR under flash/glare
- **Flash Toggle**: ⚡️ button for camera flash

#### 🛠️ Changes
- Improved image preprocessing pipeline
- Added digitize animation on capture

---

### v0.1.0 (2026-01-10)
**Branch**: `main` (Initial)

#### ✨ Features
- **URL Shortening**: Generate short codes from URLs
- **Code Scanner**: OCR with Tesseract.js
- **Google Auth**: Sign in with Google
- **Manual Entry**: Fallback code input

#### 🛠️ Infrastructure
- Next.js 14 App Router setup
- Supabase integration
- Vercel deployment

---

## How to Update This Document

1. When creating a new feature branch, add a placeholder entry:
   ```markdown
   ### v0.X.X (In Progress)
   **Branch**: `feature/your-feature`
   
   #### ✨ Features
   - [ ] Your feature description
   ```

2. When merging to main, update the version number and date.

3. Bump the version in the app footer:
   - Location: `app/scan/page.tsx` (line ~665)
   - Location: `app/page.tsx` (add footer if missing)

---

## Semantic Versioning Guide

- **MAJOR** (1.x.x): Breaking changes, major redesigns
- **MINOR** (x.1.x): New features, significant improvements
- **PATCH** (x.x.1): Bug fixes, minor tweaks
