# Lorely Brand System V2 — The Spine & Dialogue Identity

Welcome to the official **Lorely Brand Identity System (V2)** for `lorely.dawalink.space`.

---

## 1. Brand Concept & Semantics

The Lorely V2 identity represents the convergence of timeless written literature and modern cognitive AI character simulation.

- **The Left Spine (White / Dark `#18181B`):**  
  A clean, rounded vertical monolith representing the book spine, the author's written folios, and classical literature.
- **The Right Spine (Literary Orange `#EA580C`):**  
  An expressive, leaning curve with an integrated speech-bubble tail representing real-time voice and emotional simulation, dynamic character consciousness, and interactive dialogue.

---

## 2. Directory Structure

```
brand/V2/
├── README.md                              # This specification guide
├── tokens.json                            # Machine-readable colors, tokens, geometry specs
├── marks/                                 # Standalone icon marks (64x64)
│   ├── lorely-mark-dark.svg               # Dark badge (#18181B) + White/Orange spines (Canonical)
│   ├── lorely-mark-light.svg              # Light badge (#F4F4F5) + Dark/Orange spines
│   ├── lorely-mark-transparent-dark.svg   # No badge, White/Orange spines (for dark headers)
│   ├── lorely-mark-transparent-light.svg  # No badge, Dark/Orange spines (for light pages)
│   ├── lorely-mark-monochrome-white.svg   # Single-color white
│   └── lorely-mark-monochrome-dark.svg    # Single-color dark
├── lockups/                               # Horizontal & stacked wordmark combinations
│   ├── lorely-lockup-dark.svg             # Unbadged mark + White wordmark (220x80)
│   ├── lorely-lockup-light.svg            # Unbadged mark + Dark wordmark (220x80)
│   ├── lorely-lockup-badge-dark.svg       # Badged dark mark + White wordmark (240x80)
│   ├── lorely-lockup-badge-light.svg      # Badged light mark + Dark wordmark (240x80)
│   ├── lorely-lockup-stacked-dark.svg     # Vertical stacked lockup (120x120)
│   └── lorely-lockup-stacked-light.svg    # Vertical stacked light lockup (120x120)
└── favicons/                              # Browser and device icons
    ├── favicon.svg                        # Vector browser tab favicon
    ├── apple-touch-icon.svg               # iOS home screen bookmark (180x180)
    └── safari-pinned-tab.svg              # Safari pinned tab monochrome vector
```

---

## 3. Official Colors

| Swatch | Name | Hex | CSS Variable | Usage |
| :--- | :--- | :--- | :--- | :--- |
| ![#EA580C](https://placehold.co/15x15/EA580C/EA580C.png) | Literary Orange | `#EA580C` | `--brand-orange` | Dialogue spine, active accents, CTA rings |
| ![#18181B](https://placehold.co/15x15/18181B/18181B.png) | Dark Obsidian | `#18181B` | `--brand-obsidian` | Dark badge, modal card surfaces, dark text |
| ![#27272A](https://placehold.co/15x15/27272A/27272A.png) | Zinc Border | `#27272A` | `--brand-card-border` | Modal borders, inactive progress rings |
| ![#F4F4F5](https://placehold.co/15x15/F4F4F5/F4F4F5.png) | Surface Light | `#F4F4F5` | `--brand-surface-light` | Light badge background, subtle pill tags |
| ![#FAFAFA](https://placehold.co/15x15/FAFAFA/FAFAFA.png) | Pure White | `#FAFAFA` | `--brand-white` | Book spine on dark, white wordmarks, headings |

---

## 4. Minimum Clear Space & Sizing

- **Minimum digital mark size:** `20px × 20px`
- **Minimum lockup height:** `24px`
- **Clear space:** At least `0.5x` the width of the Left Spine (`5.5px` at base 64px scale) on all four sides.

---

## 5. Web & App Distribution

The canonical distribution files are mirrored directly in the frontend:
- `frontend/public/logo.svg` -> mirrors `brand/V2/marks/lorely-mark-dark.svg`
- `frontend/public/favicon.svg` -> mirrors `brand/V2/favicons/favicon.svg`
