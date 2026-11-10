# Lorely Settings Experience — Architecture & Implementation Plan

## 1. Executive Summary & Design Direction

This plan outlines the complete redesign and backend implementation of Lorely's **User Settings** suite. It transforms the current rudimentary settings screen into an editorial, high-polish settings hub that combines:
- **Linear's settings navigation**: Clean categorical sidebar (`ACCOUNT`, `PREFERENCES`, `PLAN`, `PRIVACY`), subtle active indicators, responsive mobile slide-over drawers, and full keyboard navigation.
- **Notion's profile layout**: Minimalist carded inputs, avatar uploader with initials fallback and Cloudflare R2 cloud storage.
- **GitHub's security & identity model**: Connected identity detection (Google OAuth vs Email/Password), one-click "Set Password" for Google-only users without creating duplicate accounts, and active session management.
- **Slack's appearance selector**: Curated `Light` / `Dark` / `System` segmented toggle with restrained brand accents (`Coral`, `Amber`, `Emerald`, `Indigo`) and accessibility toggles.
- **Stripe's billing structure**: Server-verified plan tiers, real-time quota meters (books, daily messages, voice minutes), and verifiable invoice/payment history.

---

## 2. Information Architecture & Hierarchy

Based on the proposed navigation hierarchy (`media_1794245917434_600d8d73.png`), Settings is organized into 4 distinct groups and 8 dedicated sections:

```
Settings Hub (/settings)
│
├── Header: User Identity Banner (Avatar, Full Name, Email, Active Status)
│
├── [ACCOUNT]
│   ├── Profile (/settings/profile)
│   │   ├── Avatar Upload (1:1 aspect, up to 10MB, stored in Cloudflare R2)
│   │   ├── Full Name & Display / Pen Name
│   │   ├── Verified Email Address (Supabase auth reference)
│   │   └── Account Created timestamp
│   │
│   └── Security & Sign-in (/settings/security)
│       ├── Login Identities (Google OAuth connected status)
│       ├── Password Management ("Set Password" for Google-only; "Change Password" for email)
│       ├── Active Session information & Sign out all other sessions
│       └── Two-factor authentication status
│
├── [PREFERENCES]
│   ├── Appearance (/settings/appearance)
│   │   ├── Mode: Light | Dark | System
│   │   ├── Accent Brand Color: Coral (Signature) | Amber | Emerald | Indigo
│   │   └── Accessibility: High Contrast mode | Reduced Motion
│   │
│   ├── Reading & Audio (/settings/reading-audio)
│   │   ├── Default Reader Theme (Parchment, Light, Sepia, Slate, Obsidian)
│   │   ├── Default Typography (Font family, base size, line height)
│   │   ├── Audio Narration: Auto-play, VAD silence sensitivity (500ms - 5000ms)
│   │   └── Spoiler Boundary Policy: Cautious (default), Strict, Unrestricted
│   │
│   ├── Language & Region (/settings/language)
│   │   ├── Interface Language: English (US), Amharic (አማርኛ)
│   │   ├── Character Conversation Language preference
│   │   └── Date & Time localized formatting preview
│   │
│   └── Notifications (/settings/notifications)
│       ├── Email Notifications: Reading summaries, weekly book digests
│       ├── In-App Alerts: Character replies, system announcements
│       └── Reading Reminders toggle
│
├── [PLAN]
│   └── Subscription & Billing (/settings/billing)
│       ├── Current Plan Card (Free / Scholar / Bibliophile) with server-verified status
│       ├── Quota Usage Bars (Books uploaded, messages sent, voice minutes consumed)
│       ├── Payment Method details & link to upgrade modal
│       └── Invoices & Receipts table (Date, Amount, Currency, Status, Receipt details)
│
└── [PRIVACY]
    └── Privacy & Data (/settings/privacy)
        ├── Export Account Data (Full JSON archive download via /api/v1/me/export)
        ├── Character Memory History purge
        └── Danger Zone: Delete Account (Permanent deletion via /api/v1/me with modal confirmation)
```

> [!IMPORTANT]
> **Admin Isolation**: The `/admin` portal remains strictly segregated. No administrative settings, system-wide toggles, or payment verification tools are exposed in the user settings menu.

---

## 3. Database Architecture & Schema Changes

### 3.1 New `profiles` Table
In accordance with Supabase recommendations for public, application-owned profile records:
```sql
CREATE TABLE profiles (
    id VARCHAR(36) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    display_name VARCHAR(255),
    avatar_path VARCHAR(512),
    preferred_language VARCHAR(10) DEFAULT 'en' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX ix_profiles_display_name ON profiles(display_name);
```

### 3.2 SQLAlchemy Model Mapping
In `backend/src/book_character_simulation_backend/db/models.py`:
- Define `UserProfile` mapped to `profiles`.
- Establish a bidirectional one-to-one relationship with `UserAccount` (`user.profile`).
- Automatic profile initialization upon first user retrieval if absent.

### 3.3 Expanded Settings in `user_settings`
- Add `app_theme` (`VARCHAR(20) DEFAULT 'system'`).
- Add `accent_color` (`VARCHAR(20) DEFAULT 'coral'`).
- Add `reduced_motion` (`BOOLEAN DEFAULT FALSE`).
- Add `high_contrast` (`BOOLEAN DEFAULT FALSE`).
- Add `notification_preferences` (`JSON DEFAULT {}`).

---

## 4. Backend Service & API Design

### 4.1 Profile & Avatar Endpoints
- `GET /api/v1/me`: Returns consolidated profile (`full_name`, `display_name`, `avatar_url`, `preferred_language`), email, role, and auth provider metadata.
- `PATCH /api/v1/me`: Updates `full_name`, `display_name`, and `preferred_language`.
- `POST /api/v1/me/avatar`: Accepts multipart image file (`image/jpeg`, `image/png`, `image/webp`), enforces 10MB size limit, validates image dimensions, uploads to Cloudflare R2 at `avatars/{user_id}/{uuid}.{ext}`, and updates `avatar_path`.
- `DELETE /api/v1/me/avatar`: Removes avatar from R2 and resets `avatar_path` to null.

### 4.2 Security & OAuth Identity Support
- Frontend queries `supabase.auth.getUser()`.
- Inspects `user.app_metadata.providers` and `user.identities`.
- If Google OAuth is the only provider: surfaces **"Set Password"** calling `supabase.auth.updateUser({ password })`.
- If password already exists: surfaces **"Change Password"**.
- Lists connected identities with provider badge (Google, Email).

### 4.3 Server-Verified Subscription & Invoices Endpoint
- `GET /api/v1/me/subscription`: Returns authoritative subscription data:
  - Active verified plan details (`name`, `price_monthly`, `slug`).
  - Real-time quota usage: books count vs quota, daily messages vs limit, voice minutes used vs limit.
  - Invoices / payment transactions history from `payment_transactions` table.

### 4.4 Privacy & Data Deletion
- `GET /api/v1/me/export`: Exports a complete JSON archive of the user's books, annotations, bookmarks, reading progress, and character chats.
- `DELETE /api/v1/me`: Cascade deletes user account, library records, and associated data with a confirmation safeguard.

---

## 5. Frontend Editorial Design & UI Architecture

### 5.1 Component Structure
```
frontend/src/pages/settings/
├── SettingsHub.jsx               # Master responsive layout with Linear sidebar
├── SettingsHub.css               # Editorial CSS, responsive layout, CSS variables
├── components/
│   ├── SettingsSidebar.jsx       # Category navigation with badge counts
│   ├── ProfileSection.jsx        # Notion-style avatar upload & pen name inputs
│   ├── SecuritySection.jsx       # GitHub-style identity list & password set/change
│   ├── AppearanceSection.jsx     # Slack-style theme segmented toggle & accents
│   ├── ReadingAudioSection.jsx   # Reader themes, fonts, voice VAD, spoiler levels
│   ├── LanguageSection.jsx       # Bilingual toggle (EN / AM) & locale preview
│   ├── NotificationsSection.jsx  # Notification channel preferences
│   ├── BillingSection.jsx        # Stripe-style plan overview, quota meters, invoices
│   └── PrivacySection.jsx        # GDPR JSON data export & danger zone modal
```

### 5.2 Visual Polish (Lorely Editorial Aesthetic)
- **Backgrounds**: Warm ivory / parchment (`#FAF7F0` in light, `#18181B` in dark).
- **Typography**: Editorial serif headings (`Lora` / `Literata` / `Merriweather`) with crisp clean sans-serif controls (`Inter`).
- **Accents**: Lorely coral (`#E05A47` / `#D9534F`) with subtle amber undertones.
- **Cards**: Thin neutral borders (`#E5E0D5` / `#27272A`), soft diffusion shadows, no generic AI glowing cards.

---

## 6. Phased Implementation Roadmap

### Phase 1: Database Migration & Profile Foundation
- [x] Create Alembic migration `20261109_0012_user_profiles_and_settings_expansion.py` (`profiles` table and `user_settings` extensions).
- [x] Add `UserProfile` SQLAlchemy model and relationship with `UserAccount`.
- [x] Implement `StorageService` avatar upload helper with mime-type, dimension, and 10MB size validation.
- [x] Implement `GET /api/v1/me`, `PATCH /api/v1/me`, `POST /api/v1/me/avatar`, and `DELETE /api/v1/me/avatar`.

### Phase 2: Navigation & Linear-Style Shell
- [x] Build `SettingsHub.jsx` with responsive two-column Linear layout (desktop sidebar + mobile breadcrumb/drawer).
- [x] Implement URL-synced tab navigation (`/settings?tab=profile`, `/settings?tab=security`, etc.).
- [x] Build top user identity banner (avatar, display name, email, active badge).

### Phase 3: Profile & Avatar Management (Notion-Style)
- [x] Build `ProfileSection.jsx` with interactive avatar drag-and-drop / file picker.
- [x] Implement direct avatar upload with immediate image preview and initials fallback.
- [x] Full name and pen name inputs with unsaved changes detection and save toasts.

### Phase 4: Security & Google Password Setup (GitHub-Style)
- [x] Build `SecuritySection.jsx` detecting `user.identities` via Supabase client.
- [x] Implement Google-only account detection with intuitive "Set Password" flow using `supabase.auth.updateUser`.
- [x] Implement "Change Password" modal with current and new password validation.
- [x] Display active session details and "Sign out everywhere" option.

### Phase 5: Appearance & Theme Engine (Slack-Style)
- [x] Build `AppearanceSection.jsx` with `Light` / `Dark` / `System` segmented toggle.
- [x] Curated accent color swatches (`Coral`, `Amber`, `Emerald`, `Indigo`).
- [x] Instant theme switching via CSS root variables + persistent sync to both `localStorage` and backend.
- [x] Accessibility toggles for high contrast and reduced motion.

### Phase 6: Reading, Audio & Language Preferences
- [x] Build `ReadingAudioSection.jsx` connecting reader themes, typography defaults, voice VAD sensitivity slider, and spoiler protection policies.
- [x] Build `LanguageSection.jsx` supporting English and Amharic with immediate UI toggle.
- [x] Build `NotificationsSection.jsx` for email and in-app digest toggles.

### Phase 7: Subscription, Billing & Invoices (Stripe-Style)
- [x] Implement backend `GET /api/v1/me/subscription` endpoint calculating real usage against `MembershipPlan` quotas and returning verified payment records.
- [x] Build `BillingSection.jsx` with visual quota progress bars, plan badge, upgrade button (linking to `PricingModal.jsx`), and receipt download history.

### Phase 8: Privacy, GDPR & Account Deletion
- [x] Build `PrivacySection.jsx` with one-click "Export My Data" downloading formatted JSON archive.
- [x] Build Danger Zone account deletion modal requiring explicit confirmation ("DELETE").

### Phase 9: End-to-End Verification & Testing
- [x] Backend Pytest integration tests covering profile CRUD, avatar upload validation, settings persistence, subscription usage calculation, and data export.
- [x] Frontend Vitest tests covering all 8 settings tabs, avatar upload, password set/change flows, theme toggling, and keyboard navigation.
- [x] Production build (`npm run build`) verification.
