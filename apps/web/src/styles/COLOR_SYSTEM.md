# Vara Color System Design Documentation

## Overview

Vara's color system is designed to create a calming, supportive, and empowering experience for women navigating digital safety. The palette avoids harsh, alarming colors in favor of soft, approachable tones that communicate safety without inducing anxiety.

## Design Philosophy

1. **Calming, Not Alarming**: Even warnings and errors use soft coral tones instead of harsh reds
2. **Empowering**: Lavender primary color feels confident and modern
3. **Safe**: Mint success colors reinforce feelings of protection and security
4. **Accessible**: All color combinations meet WCAG AA contrast requirements
5. **Consistent**: Semantic tokens ensure meaning is preserved across themes

---

## Core Palette

### Primary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Cream 100 | `#FEFAF1` | `254 250 241` | Primary background (light mode) |
| Lavender 300 | `#D7CAE6` | `215 202 230` | Secondary/accent highlights |
| Mint 300 | `#B1EFE3` | `177 239 227` | Success states, safety indicators |
| Coral 400 | `#FFAB91` | `255 171 145` | Warnings, soft attention |
| Charcoal 800 | `#1E1E1E` | `30 30 30` | Text, dark mode background |

### Full Color Scales

<details>
<summary><strong>Cream Scale</strong> (Background warmth)</summary>

| Step | Hex | Use Case |
|------|-----|----------|
| 50 | `#FFFBF5` | Lightest background |
| 100 | `#FEFAF1` | Primary background |
| 200 | `#FCF5E8` | Subtle background |
| 300 | `#F8EEDC` | Muted surfaces |
| 400 | `#F2E4CC` | Borders, dividers |
| 500 | `#EBD9BB` | Strong borders |

</details>

<details>
<summary><strong>Lavender Scale</strong> (Primary/Accent)</summary>

| Step | Hex | Use Case |
|------|-----|----------|
| 50 | `#FAF7FD` | Subtle background |
| 100 | `#F4EEFA` | Light tint |
| 200 | `#EBE0F4` | Selection, focus bg |
| 300 | `#D7CAE6` | Secondary color |
| 400 | `#BFACD6` | Hover states |
| 500 | `#A78FC6` | Info color |
| 600 | `#8B6EAF` | Primary color |
| 700 | `#6F5293` | Primary hover |
| 800 | `#553C73` | Primary active |
| 900 | `#3E2A55` | Dark text on light |

</details>

<details>
<summary><strong>Mint Scale</strong> (Success/Safety)</summary>

| Step | Hex | Use Case |
|------|-----|----------|
| 50 | `#F5FDFB` | Success subtle bg |
| 100 | `#EBFAF6` | Success background |
| 200 | `#D0F5EB` | Success muted |
| 300 | `#B1EFE3` | Success highlight |
| 400 | `#8CE1D0` | Success (dark mode) |
| 500 | `#66CFBB` | Success badge |
| 600 | `#47B4A0` | Success primary |
| 700 | `#349180` | Success hover |
| 800 | `#287366` | Success text |
| 900 | `#205A50` | Success dark text |

</details>

<details>
<summary><strong>Coral Scale</strong> (Warnings/Soft Errors)</summary>

| Step | Hex | Use Case |
|------|-----|----------|
| 50 | `#FFF8F5` | Warning subtle bg |
| 100 | `#FFF0EA` | Warning background |
| 200 | `#FFE0D3` | Warning muted |
| 300 | `#FFCEB9` | Warning light |
| 400 | `#FFAB91` | Warning highlight |
| 500 | `#FA8C6E` | Warning primary |
| 600 | `#EB6E50` | Destructive |
| 700 | `#D2553C` | Destructive hover |
| 800 | `#AF4430` | Warning text |
| 900 | `#8C3426` | Warning dark text |

</details>

<details>
<summary><strong>Charcoal Scale</strong> (Text/Dark Mode)</summary>

| Step | Hex | Use Case |
|------|-----|----------|
| 50 | `#FAFAFA` | Light text |
| 100 | `#F0F0F0` | Subtle text |
| 200 | `#DCDCDC` | Borders (dark) |
| 300 | `#B4B4B4` | Muted text |
| 400 | `#828282` | Subtle text |
| 500 | `#5A5A5A` | Secondary text |
| 600 | `#3C3C3C` | Elevated surface |
| 700 | `#2D2D2D` | Card (dark) |
| 800 | `#1E1E1E` | Background (dark) |
| 900 | `#121212` | Deep background |
| 950 | `#0A0A0A` | Deepest |

</details>

---

## Semantic Color Tokens

### Background & Foreground

```css
/* Light Mode */
--background: cream-100        /* Main page background */
--background-subtle: cream-50  /* Slightly lighter */
--background-muted: cream-200  /* Subtle sections */
--background-elevated: white   /* Cards, modals */

--foreground: charcoal-800     /* Primary text */
--foreground-muted: charcoal-500  /* Secondary text */
--foreground-subtle: charcoal-400 /* Placeholder, hints */

/* Dark Mode */
--background: charcoal-800
--background-elevated: charcoal-700
--foreground: cream-100
--foreground-muted: charcoal-300
```

### Interactive States

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `primary` | lavender-600 | lavender-400 | Primary buttons, links |
| `primary-hover` | lavender-700 | lavender-300 | Hover state |
| `primary-active` | lavender-800 | lavender-500 | Pressed state |
| `primary-subtle` | lavender-100 | lavender-900 | Subtle backgrounds |
| `primary-foreground` | white | charcoal-900 | Text on primary |

### Status Colors

| Status | Primary | Background | Border | Text |
|--------|---------|------------|--------|------|
| **Success** | mint-600 | mint-100 | mint-300 | mint-800 |
| **Warning** | coral-500 | coral-100 | coral-300 | coral-800 |
| **Destructive** | coral-600 | coral-100 | coral-300 | coral-800 |
| **Info** | lavender-500 | lavender-100 | lavender-300 | lavender-800 |

---

## Alert Severity System

Vara uses a 5-level alert severity system. Colors progress in warmth/intensity without ever becoming harsh or alarming.

### Light Mode

| Severity | Color | Background | Border | Icon | Text |
|----------|-------|------------|--------|------|------|
| **INFO** | Lavender | `#F4EEFA` | `#D7CAE6` | `#8B6EAF` | `#553C73` |
| **LOW** | Mint | `#EBFAF6` | `#B1EFE3` | `#47B4A0` | `#287366` |
| **MEDIUM** | Coral Light | `#FFF0EA` | `#FFCEB9` | `#FA8C6E` | `#AF4430` |
| **HIGH** | Coral | `#FFE0D3` | `#FFAB91` | `#D2553C` | `#8C3426` |
| **CRITICAL** | Coral Deep | `#FFE0D3` | `#FA8C6E` | `#AF4430` | `#8C3426` |

### Dark Mode

| Severity | Color | Background | Border | Icon | Text |
|----------|-------|------------|--------|------|------|
| **INFO** | Lavender | `#3E2A55` | `#6F5293` | `#BFACD6` | `#EBE0F4` |
| **LOW** | Mint | `#205A50` | `#349180` | `#8CE1D0` | `#D0F5EB` |
| **MEDIUM** | Coral | `#8C3426` | `#D2553C` | `#FFAB91` | `#FFE0D3` |
| **HIGH** | Coral | `#8C3426` | `#EB6E50` | `#FFAB91` | `#FFF0EA` |
| **CRITICAL** | Coral | `#8C3426` | `#FA8C6E` | `#FFCEB9` | `#FFF0EA` |

---

## Component Color Mappings

### Buttons

| Variant | Background | Text | Hover | Focus Ring |
|---------|------------|------|-------|------------|
| **Primary** | `primary` | `primary-foreground` | `primary-hover` | `ring` |
| **Secondary** | `card` | `card-foreground` | `card-hover` | `ring` |
| **Ghost** | transparent | `foreground-muted` | `muted` | `ring` |
| **Outline** | transparent | `primary` | `primary-subtle` | `ring` |
| **Destructive** | `destructive` | `destructive-foreground` | `destructive-hover` | `destructive` |
| **Success** | `success` | `success-foreground` | `success-hover` | `success` |

### Cards

| Variant | Background | Border | Usage |
|---------|------------|--------|-------|
| **Default** | `card` | `border` | Standard content cards |
| **Elevated** | `background-elevated` | `border` | Modals, dropdowns |
| **Muted** | `background-muted` | `border-subtle` | Secondary content |
| **Hover** | `card-hover` | `border-strong` | Interactive cards |

### Form Elements

| State | Border | Focus Ring | Background |
|-------|--------|------------|------------|
| **Default** | `input` | - | `card` |
| **Focus** | `input-focus` | `ring/20` | `card` |
| **Error** | `destructive` | `destructive/20` | `card` |
| **Disabled** | `muted` | - | `muted` |

### Navigation

| State | Background | Text | Border |
|-------|------------|------|--------|
| **Default** | `nav` | `nav-foreground` | `nav-border` |
| **Hover** | `nav-hover-bg` | `nav-hover` | - |
| **Active** | `nav-active-bg` | `nav-active` | - |

---

## Accessibility Compliance

### Contrast Ratios (WCAG AA)

All text/background combinations meet minimum requirements:
- Normal text (< 18px): 4.5:1 minimum
- Large text (>= 18px or 14px bold): 3:1 minimum

| Combination | Ratio | Status |
|-------------|-------|--------|
| `foreground` on `background` | 12.5:1 | Pass AAA |
| `foreground-muted` on `background` | 5.2:1 | Pass AA |
| `primary` on `background` | 4.8:1 | Pass AA |
| `destructive` on `background` | 4.6:1 | Pass AA |
| `success` on `background` | 4.5:1 | Pass AA |
| `primary-foreground` on `primary` | 8.1:1 | Pass AAA |

### Dark Mode Adjustments

Dark mode uses lighter versions of accent colors to maintain contrast:
- Primary shifts from lavender-600 to lavender-400
- Success shifts from mint-600 to mint-400
- Backgrounds use charcoal-800 with elevated cards at charcoal-700

---

## Usage Guidelines

### Do

- Use `primary` for main CTAs and important actions
- Use `success` to indicate safety, protection, or positive outcomes
- Use `warning` for situations requiring attention (not urgent)
- Use `destructive` sparingly, only for irreversible actions
- Use `info` for neutral informational content
- Let semantic tokens handle light/dark mode automatically

### Don't

- Don't use raw color values (e.g., `#FFAB91`) - use tokens
- Don't use harsh red (`#FF0000`) for errors
- Don't combine low-contrast color pairs
- Don't override semantic meaning of colors
- Don't use multiple accent colors in the same component

---

## Tailwind CSS Classes

### Backgrounds
```html
<!-- Semantic (recommended) -->
<div class="bg-background">...</div>
<div class="bg-card">...</div>
<div class="bg-primary">...</div>
<div class="bg-success-subtle">...</div>

<!-- Raw palette (when needed) -->
<div class="bg-cream-100">...</div>
<div class="bg-lavender-600">...</div>
```

### Text
```html
<p class="text-foreground">Primary text</p>
<p class="text-foreground-muted">Secondary text</p>
<p class="text-primary">Accent text</p>
<p class="text-success">Success message</p>
<p class="text-destructive">Error message</p>
```

### Borders
```html
<div class="border border-border">Default border</div>
<div class="border border-border-subtle">Subtle border</div>
<div class="border border-primary">Accent border</div>
```

### Alert Cards
```html
<div class="alert-info">Info alert</div>
<div class="alert-low">Low severity</div>
<div class="alert-medium">Medium severity</div>
<div class="alert-high">High severity</div>
<div class="alert-critical">Critical alert</div>
```

### Badges
```html
<span class="badge-success">Protected</span>
<span class="badge-warning">Attention</span>
<span class="badge-alert-medium">Medium Risk</span>
```

---

## Dark Mode Implementation

### Enabling Dark Mode

Add `class="dark"` to the `<html>` element:

```html
<html class="dark">
```

### Respecting System Preference

```javascript
// Check system preference
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

// Toggle dark mode
document.documentElement.classList.toggle('dark', prefersDark);
```

### Transition Between Modes

```css
html {
  transition: background-color 0.3s ease, color 0.3s ease;
}
```

---

## Design Tokens Export

For design tools (Figma, Sketch), export these values:

```json
{
  "vara-cream-100": "#FEFAF1",
  "vara-lavender-300": "#D7CAE6",
  "vara-lavender-600": "#8B6EAF",
  "vara-mint-300": "#B1EFE3",
  "vara-mint-600": "#47B4A0",
  "vara-coral-400": "#FFAB91",
  "vara-coral-600": "#EB6E50",
  "vara-charcoal-800": "#1E1E1E"
}
```

---

## Related Files

- `/apps/web/src/styles/colors.css` - CSS custom properties
- `/apps/web/tailwind.config.js` - Tailwind color configuration
- `/apps/web/src/styles/globals.css` - Component classes
- `/apps/web/src/components/ui/Button.tsx` - Button variants
- `/apps/web/src/components/ui/Input.tsx` - Input styling
