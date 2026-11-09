# Lorely Brand & Design Guidelines

> **Brand Identity System**: High-End Editorial Cognitive SaaS  
> **Aesthetic Philosophy**: Ethereal, tactile, literary, and modern. Balances timeless editorial typography with clean, responsive SaaS components.

---

## 1. Brand Identity & Vision

**Lorely** is a cognitive literary character simulation and voice dialogue platform. It resurrects the minds of classical literature through deep psychological state tracking, dynamic emotional drift telemetry, and spoiler-gated vector RAG.

- **Brand Essence**: Where classic literature meets high-precision cognitive AI.
- **Visual Tone**: Thoughtful, refined, airy, and trustworthy. Avoids chaotic "AI neon/cyberpunk" aesthetics in favor of crisp white canvases, soft warm-clay trays, obsidian typography, and an energetic signature vermilion-orange accent.
- **Key Metaphor**: A serene literary salon powered by an invisible, state-of-the-art telemetry engine.

---

## 2. Logo & Mark

The official Lorely mark is the **Literary Rosette**: 8 orbital character nodes arranged around an open book folio core.

```
       ○
   ○       ○
○     📖     ○
   ○       ○
       ○
```

### Specifications
- **Geometry**: 8 peripheral circles evenly distributed at radius $R = 10\text{px}$ around center $(16, 16)$, orbiting an open book folio core with a central nexus spark.
- **Outer Node Radius**: $r = 3\text{px}$ for the 8 peripheral circles.
- **Center Core**: Stylized dual folio pages with subtle page curvatures and central spark node $(r = 0.75\text{px})$.
- **ViewBox**: `0 0 32 32`.
- **Primary Color**: `#ef4d23` (Vermilion Orange).
- **Dark Surface Variant**: `#ffffff` (Pure White).
- **Asset Paths**:
  - `docs/Brand/logo.svg` (Orange #ef4d23 on transparent)
  - `docs/Brand/logo-white.svg` (White #ffffff on transparent)
  - `frontend/public/logo.svg` & `frontend/public/favicon.svg`

### SVG Markup
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="#ef4d23" aria-label="Lorely Literary Rosette Mark">
  <!-- 8 Petal circles at radius 10 around (16, 16) -->
  <circle cx="26" cy="16" r="3" />
  <circle cx="23.071" cy="23.071" r="3" />
  <circle cx="16" cy="26" r="3" />
  <circle cx="8.929" cy="23.071" r="3" />
  <circle cx="6" cy="16" r="3" />
  <circle cx="8.929" cy="8.929" r="3" />
  <circle cx="16" cy="6" r="3" />
  <circle cx="23.071" cy="8.929" r="3" />

  <!-- Center Core: Stylized Open Book Folio Pages -->
  <path
    d="M15.6 13.1 C14.25 12.7 12.75 12.8 11.75 13.4 C11.5 13.55 11.4 13.8 11.4 14.1 L11.4 17.9 C11.4 18.3 11.8 18.6 12.15 18.4 C13.1 17.9 14.4 17.8 15.6 18.25 Z"
  />
  <path
    d="M16.4 13.1 C17.75 12.7 19.25 12.8 20.25 13.4 C20.5 13.55 20.6 13.8 20.6 14.1 L20.6 17.9 C20.6 18.3 20.2 18.6 19.85 18.4 C18.9 17.9 17.6 17.8 16.4 18.25 Z"
  />
  <!-- Central Spark / Nexus Node -->
  <circle cx="16" cy="15.6" r="0.75" />
</svg>
```

---

## 3. Color Palette & Semantic Tokens

| Role | Name | Hex | Usage |
| :--- | :--- | :--- | :--- |
| **Primary Brand** | Vermilion Orange | `#ef4d23` | Brand mark, primary CTA pills, active nav tabs, gauge active ticks, prominent accents |
| **Primary Hover** | Orange Deep | `#d9421a` | Hover states for primary orange buttons and pills |
| **Primary Active** | Orange Shadow | `#bf3814` | Active / pressed states |
| **Dark Contrast** | Obsidian Black | `#0b0f1a` | Hero primary CTA button, modal action buttons, deep dark contrast surfaces |
| **Page Frame** | Pale Stone Grey | `#ededed` | Outermost application page wrapper, viewport frame padding |
| **Hero Canvas** | Muted Slate Canvas | `#d9d9d9` | Fallback hero container background under looping video |
| **Dashboard Tray** | Warm Clay / Cream | `#f5f2ee` | Metric dashboard tray container, preview panels, card dock wrapper |
| **Surface White** | Pure White | `#ffffff` | Primary cards, floating navbar pill, modals, input fields |
| **Text Strong** | Deep Charcoal | `#0b0f1a` | Headlines, titles, key numbers, bold labels |
| **Text Base** | Slate Grey | `#374151` | Body paragraphs, conversational messages, descriptions |
| **Text Muted** | Neutral Grey | `#6b7280` | Subtitles, helper text, timestamps, inactive options |
| **Text Subtle** | Zinc Grey | `#9ca3af` | Placeholders, inactive gauge ticks, minor captions |
| **Border Primary** | Soft Neutral Line | `#e5e5e5` | Card borders, navbar border, input borders |
| **Border Subtle** | Zinc Neutral | `#d4d4d8` | Inactive gauge tick lines, divider rules |
| **Accent Sky Blue**| Ethereal Sky | `#e0f2fe` | Auth screen right-side illustration backdrop, telemetry sparklines |
| **Accent Sky Text**| Deep Sky Blue | `#0284c7` | Auth illustration text, informational badges |
| **Positive Green** | Emerald Success | `#10b981` | Verification approved, positive drift, system active badges |
| **Negative Red**   | Ruby Alert | `#ef4444` | High distress emotional drift, payment rejected, delete actions |

---

## 4. Typography Hierarchy

### Font Families
- **Display & Headings**: `'Instrument Serif', Georgia, serif`
  - Used for large editorial headlines, emotional dialogue emphasis words, and literary accents.
  - Distinctive italic style gives an organic, literary voice.
- **UI & Body**: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
  - Weights: `400 (Regular)`, `500 (Medium)`, `600 (Semibold)`, `700 (Bold)`.
  - Used for navigation, inputs, cards, metric figures, buttons, and conversation chat bodies.
- **Telemetry & Mono**: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
  - Used for model IDs, token metrics, vector coordinates, reference codes.

### Typographic Scales & Clamp Formulas
- **Hero Title**:
  - `fontSize: clamp(36px, 8vw, 72px)`
  - `lineHeight: 1.05`
  - `letterSpacing: -0.02em`
  - `fontWeight: 500`
  - *Pattern*: Standard Inter text with key emphasis wrapped in `<span style={{fontFamily:"'Instrument Serif', serif", fontStyle:"italic", fontWeight:400}}>Word</span>`.
- **Hero Subtitle**:
  - `fontSize: clamp(13px, 3.5vw, 16px)`
  - `lineHeight: 1.5`
  - `color: #4b5563 (neutral-700)`
- **Card Big Metrics**:
  - `fontSize: 28px`
  - `fontWeight: 600`
  - `color: #0b0f1a`
- **Floating Badge**:
  - `fontSize: 13px`
  - `fontWeight: 500`
  - Padding: `px-4 py-1.5`

---

## 5. Core Architectural Components

### 5.1 Floating Pill Navbar
- **Container**: `max-w-[760px] w-full bg-white rounded-full shadow-sm border border-neutral-200 px-3 py-2 flex items-center justify-between`.
- **Left Cluster**: Orange flower SVG (`w-7 h-7 sm:w-8 sm:h-8`) + optional subtle brand name.
- **Center Links (Desktop)**: `gap-6 text-[14px] font-medium text-neutral-700`.
  - Active item features a `1.5px` black dot preceding the text (`• Home`).
  - Dropdown items feature `#ef4d23` text with `ChevronDown`.
- **Right Cluster**:
  - Primary Action Button: Orange `#ef4d23` pill button `"Start Reading"` / `"Early Access"` with white circular glyph containing `ChevronRight`.
  - **CRITICAL**: **NO cart icon** or e-commerce features anywhere!
- **Mobile Menu**: Lucide `Menu` hamburger button opening a floating dropdown panel below the pill with vertical nav items.

### 5.2 Full-Viewport Hero Container
- **Outer Shell**: `min-h-screen w-full bg-[#ededed] p-3 sm:p-4`.
- **Hero Canvas**: `h-[calc(100vh-24px)] sm:h-[calc(100vh-32px)] relative w-full overflow-hidden bg-[#d9d9d9] rounded-2xl sm:rounded-3xl`.
- **Background Video**:
  - Auto-looping, muted, playsInline video (`https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260424_064411_9e9d7f84-9277-41f4-ab10-59172d89e6be.mp4`) with poster fallback.
  - Overlay: `absolute inset-0 bg-white/10 pointer-events-none`.
- **Kicker Badge**: White pill `inline-flex items-center gap-2 bg-white rounded-full px-4 py-1.5 shadow-sm text-[13px]` with an orange dot + `"Lorely Studio"`.
- **Hero CTA**: Dark Obsidian `#0b0f1a` pill button with inner `white/15` circle containing `ChevronRight`.

### 5.3 Bottom Dashboard Preview Tray & Radial Gauges
- **Tray Wrapper**: `bg-[#f5f2ee] rounded-3xl p-4 sm:p-6 w-full max-w-[880px] mx-auto shadow-sm`.
- **Grid Layout**: 3 columns (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4`).
- **Cards**: Pure white `rounded-2xl p-5 shadow-sm border border-neutral-100`.
- **180° Tick Gauge Component**:
  - SVG viewBox `0 0 200 120`, max-width `260px`.
  - 40 tick marks spanning a 180° semi-circle arc (from angle $\pi$ to $2\pi$).
  - Active tick count = `round((value / 100) * 40)` colored in `#ef4d23` or `#9ca3af`.
  - Inactive ticks colored in `#d4d4d8`.
  - Center percentage text: `x=100 y=105`, `fontSize: 22`, `fontWeight: 600`.
  - Min/Max labels below SVG.

### 5.4 Split-Screen Auth Card (Image 1)
- **Container**: `max-w-4xl w-full bg-white rounded-3xl border border-neutral-200 shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-2`.
- **Left Column (Auth Form)**:
  - Back arrow in circular pill top-left.
  - Title: `"Create Lorely account"` / `"Sign in to Lorely"`.
  - Subtitle: `"Start your experience with Lorely by signing in or signing up."`
  - Form Fields: Clean bordered inputs (`border-neutral-200 rounded-xl px-4 py-3 focus:border-[#ef4d23] focus:ring-2 focus:ring-[#ef4d23]/15`).
  - Primary Action Button: Pill or rounded-xl button in `#0b0f1a` or `#ef4d23`.
  - Social OAuth Buttons: Bordered rounded-xl buttons for `"Continue with Google"` and `"Continue with Microsoft"`.
  - Legal Disclaimer: `"By creating an account, you agree to our Privacy Policy"`.
- **Right Column (Atmospheric Graphic Panel)**:
  - Gradient background: Soft ethereal sky blue (`bg-[#eff6ff]` or gradient).
  - Floating White Stat Card:
    - `"Cognitive Fidelity 98.4%"` or `"Improvement rate 126.6%"`.
    - Smooth SVG sparkline chart with gradient fill under the line.
  - Secondary lower time-series card with coordinate axes.
  - Editorial Footer:
    - Heading: `"A Living Sanctuary for Classic Minds & Voices"`.
    - Body: `"Lorely empowers you with psychologically faithful literary agents—delivering deep persona depth and a 360° dialogue experience across timeless books."`

---

## 6. System Prohibitions & Anti-Patterns

1. **NO Shopping Cart**: Never introduce cart icons, checkout funnels for physical goods, or e-commerce widgets. Lorely is a cognitive literature simulation platform.
2. **NO Harsh Black/Green Terminal Themes**: The legacy dark-mode green (#0A130E / #14241B) is retired. All reader and landing pages use the light, ethereal stone/cream/obsidian palette.
3. **NO Square Corners on Cards & Pills**: Always use `rounded-2xl` (24px) for cards, `rounded-3xl` (32px) for hero and dashboard trays, and `rounded-full` (9999px) for buttons, badges, and search pills.
4. **NO Dummy Text in Production**: Content must speak strictly to books, characters, psychological drift, chapter citations, and voice synthesis—never generic marketing filler or PR agency copy.
