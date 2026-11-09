# Lorely Logo Redesign Proposals

> **Status**: Design Proposals for Review  
> **Constraint Verified**: Not yet applied to the active application UI. All files stored strictly in `brand/text/` and `docs/Brand/proposals/`.  
> **Brand Theme**: Classical Books, Living Character Cognition & Literary Dialogue  
> **Primary Color**: `#ef4d23` (Vermilion Orange)  
> **Secondary Accents**: `#0b0f1a` (Obsidian), `#f5f2ee` (Warm Paper), `#ffffff` (Pure White)  

---

## 1. Executive Summary & Design Mission

The current Lorely mark consists of an 8-node floral ring surrounding a central dot (`viewBox="0 0 32 32"`). While geometrically clean, the original mark is an abstract generic flower that does not immediately communicate **books, reading, literature, or character dialogues**.

The user requested:
> *"redesign the logo for our case, that relate to the current one, try redesign and put it in brand/text folder, (dont apply to the platform now)"*

To respect the brand equity and visual rhythm already established, we developed **three evolutionary proposals** that retain the iconic 8-fold radial symmetry while imbuing it with deep literary and cognitive symbolism.

---

## 2. The Three Concepts

### Concept 1: The Literary Rosette (Recommended — Highest Continuity)
- **File**: `brand/text/concept_1_literary_rosette.svg`
- **Variants**: `concept_1_literary_rosette_white.svg`, `concept_1_literary_rosette_dark.svg`, `lockup_concept_1.svg`
- **Concept**:
  - The outer 8 circular nodes are **100% preserved**, maintaining complete instant recognition with the existing mark.
  - The generic central circle is transformed into an **open book folio with turning pages and a central quill/spark nexus**.
  - **Symbolism**: The central book is the open text of literature; the 8 orbiting nodes represent the cognitive characters, memories, and story facets blooming outward into conversation.
- **Favicon & Small Sizes**: The open pages create a distinctive negative-space silhouette that remains legible down to 16×16px.

```
       ○
   ○       ○
○     📖     ○
   ○       ○
       ○
```

---

### Concept 2: The Folio Petals (Tactile & Organic)
- **File**: `brand/text/concept_2_folio_petals.svg`
- **Concept**:
  - The central node remains the bright glowing core of intelligence and character consciousness.
  - Each of the 8 petals is sculpted into a **radiating book leaf / deckled manuscript page**, terminating in the signature circular node.
  - **Symbolism**: An anthology in full bloom. It evokes the physical sensation of turning pages in a classic library volume.
- **Aesthetic**: Richly editorial, warm, and sophisticated.

---

### Concept 3: The Dialogue Octofoil (Conversational Dialogue)
- **File**: `brand/text/concept_3_dialogue_octofoil.svg`
- **Concept**:
  - The 8 nodes evolve into **conversational quotation seeds / speech droplets `“ ”`** rotating clockwise around an editorial chapter asterisk.
  - **Symbolism**: Focuses on the real-time dialogue and voice interactions between reader and literary characters.
  - **Aesthetic**: Intellectual, typographic, and conversational.

---

## 3. Interactive Visualizer

To preview all three concepts live across light, dark, and warm paper themes, open:
`brand/text/logo_preview.html` in any web browser.

---

## 4. Geometric Specifications

| Property | Value | Notes |
| :--- | :--- | :--- |
| **Grid / ViewBox** | `0 0 64 64` | Scalable vector paths with sub-pixel rounding |
| **Symmetry** | 8-fold Octagonal ($45^\circ$ rotational steps) | Retains original logo orbital angles |
| **Orbital Radius** | $R = 20\text{px}$ from center $(32, 32)$ | Matches original 10px radius scaled $2\times$ |
| **Node Radius** | $r = 6\text{px}$ | Solid `#ef4d23` fill |
| **Typography Pairing** | `Instrument Serif` (Wordmark) + `Inter` (Sub-brand) | Matches Lorely editorial guidelines |

---

## 5. Directory Contents

```
brand/text/
├── README.md                          # Quick start index
├── LOGO_REDESIGN_PROPOSALS.md         # This specification document
├── logo_preview.html                  # Interactive side-by-side previewer
├── concept_1_literary_rosette.svg     # Concept 1 (Primary Vermilion)
├── concept_1_literary_rosette_dark.svg# Concept 1 (Obsidian #0b0f1a)
├── concept_1_literary_rosette_white.svg# Concept 1 (White #ffffff)
├── concept_2_folio_petals.svg         # Concept 2 (Folio Pages)
├── concept_3_dialogue_octofoil.svg    # Concept 3 (Dialogue Quotes)
└── lockup_concept_1.svg               # Complete horizontal lockup
```
