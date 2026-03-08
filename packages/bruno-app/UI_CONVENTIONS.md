# Bruno App — UI Conventions

This document is the authoritative reference for frontend UI standards in `bruno-app`.
All new components and edits to existing components **must** follow these conventions.

---

## Table of Contents

1. [Color](#color)
2. [Typography](#typography)
3. [Spacing](#spacing)
4. [Border Radius](#border-radius)
5. [Borders & Dividers](#borders--dividers)
6. [Shadows](#shadows)
7. [Transitions & Animation](#transitions--animation)
8. [Interactive States](#interactive-states)
9. [Focus Rings](#focus-rings)
10. [Loading States](#loading-states)
11. [Z-Index Scale](#z-index-scale)
12. [Component Structure](#component-structure)
13. [Styled-Components Rules](#styled-components-rules)
14. [Tailwind Usage](#tailwind-usage)
15. [Quick Reference](#quick-reference)

---

## Color

### Rules

- **MUST** use theme tokens via styled-components: `${({ theme }) => theme.colors.xxx}`
- **MUST NOT** hardcode hex, hsl, rgb, or named color values in components
- **MUST NOT** use Tailwind color utilities (`text-red-500`, `bg-gray-100`, `border-blue-600`, etc.)
- **MUST NOT** use CSS variables (`var(--color-brand)`) in new code — these are legacy

### Semantic Color Keys

| Purpose | Theme Key |
|---|---|
| Primary brand accent | `theme.brand` |
| Primary action variants | `theme.primary.solid / .text / .strong / .subtle` |
| Main text | `theme.text` |
| Muted/secondary text | `theme.colors.text.muted` |
| Link text | `theme.textLink` |
| Page background | `theme.background.base` |
| Elevated surface | `theme.background.surface0` / `surface1` / `surface2` |
| Sidebar background | `theme.colors.sidebar.bg` |
| Status info | `theme.status.info.text / .background / .border` |
| Status success | `theme.status.success.text / .background / .border` |
| Status warning | `theme.status.warning.text / .background / .border` |
| Status danger | `theme.status.danger.text / .background / .border` |

### Examples

```js
// ✅ Correct
const StyledWrapper = styled.div`
  background: ${({ theme }) => theme.background.base};
  color: ${({ theme }) => theme.text};
  border: 1px solid ${({ theme }) => theme.colors.border1};
`;

// ❌ Wrong
const StyledWrapper = styled.div`
  background: #1e1e1e;
  color: hsl(0, 0%, 80%);
  border: 1px solid #333;
`;
```

---

## Typography

### Font Families

| Use Case | Family |
|---|---|
| All UI text | `Inter, system-ui, sans-serif` |
| Code, Monaco editor, terminals | `'Fira Code', Consolas, monospace` |

### Font Sizes

Use `theme.font.size.*` — never hardcode pixel or rem values for font sizes.

| Token | Value | Use |
|---|---|---|
| `theme.font.size.xs` | 11px (0.6875rem) | Labels, badges, hints |
| `theme.font.size.sm` | 12px (0.75rem) | Secondary text, tab titles, captions |
| `theme.font.size.base` | 13px (0.8125rem) | Default body text, sidebar items |
| `theme.font.size.md` | 14px (0.875rem) | Modal titles, emphasized text |
| `theme.font.size.lg` | 16px (1rem) | Section headings |
| `theme.font.size.xl` | 18px (1.125rem) | Page titles (rarely used) |

### Font Weight

| Value | Use |
|---|---|
| `400` | Normal body text |
| `500` | Medium — sidebar item names, form labels |
| `600` | Semibold — modal titles, section headers |

Do **not** use `700` (bold) or `bold` keyword in UI components.

### Line Height & Letter Spacing

- UI components (dense): `line-height: 1.4`
- Body text / descriptions: `line-height: 1.6`
- Headings: `letter-spacing: -0.01em`
- Body/UI: `letter-spacing: 0`

---

## Spacing

Use rem values on the 4px grid. **MUST NOT** mix px and rem in the same component rule (exception: `1px` borders and `2px` outline-offsets are always px).

| Value | Pixels |
|---|---|
| `0.25rem` | 4px |
| `0.5rem` | 8px |
| `0.75rem` | 12px |
| `1rem` | 16px |
| `1.25rem` | 20px |
| `1.5rem` | 24px |
| `2rem` | 32px |

---

## Border Radius

**MUST** use theme tokens. **MUST NOT** hardcode `border-radius: 4px`.

| Token | Value | Use |
|---|---|---|
| `theme.border.radius.sm` | 4px | Small inputs, tags, tight UI |
| `theme.border.radius.base` | 6px | Default — cards, panels |
| `theme.border.radius.md` | 8px | Buttons, dropdowns |
| `theme.border.radius.lg` | 10px | Modals, larger cards |
| `theme.border.radius.xl` | 12px | Large panels |
| `999px` | — | Pills, badges, circular icons |

```js
// ✅ Correct
border-radius: ${({ theme }) => theme.border.radius.base};

// ❌ Wrong
border-radius: 6px;
```

---

## Borders & Dividers

Use the three-tier border system: `border0` (subtlest) → `border1` → `border2` (strongest).

| Token | Use |
|---|---|
| `theme.colors.border0` | Structural dividers, separator lines, subtle section breaks |
| `theme.colors.border1` | Input borders, card outlines, default borders |
| `theme.colors.border2` | Active/hover borders, focused inputs, emphasized containers |

**Dividers** (horizontal rules, row separators):
```css
border-bottom: 1px solid ${({ theme }) => theme.colors.border0};
```

**MUST NOT** use borders thicker than `1px` for structural dividers.

---

## Shadows

Use `theme.shadow.*`. **MUST NOT** hardcode `box-shadow` values.

| Token | Use |
|---|---|
| `theme.shadow.sm` | Inline cards, list items with elevation |
| `theme.shadow.md` | Floating dropdowns, popovers |
| `theme.shadow.lg` | Modals, overlay panels |

---

## Transitions & Animation

### Transition Standard

This is the most important convention for UI smoothness.

| Name | Value | Use |
|---|---|---|
| **fast** | `0.1s ease` | Hover backgrounds, icon color changes, micro-interactions |
| **base** | `0.15s ease` | Color, border, opacity changes — the **default** |
| **slow** | `0.25s cubic-bezier(0.4, 0, 0.2, 1)` | Size changes, sliding panels, height transitions |
| **spring** | `0.2s cubic-bezier(0.34, 1.56, 0.64, 1)` | Menu/modal open (snappy overshoot feel) |

Use `theme.transition.*` tokens in styled-components:

```js
// ✅ Correct
transition: background-color ${({ theme }) => theme.transition.fast},
            color ${({ theme }) => theme.transition.fast};

// ❌ Wrong — "all" is too broad and hurts performance
transition: all 0.15s ease;

// ❌ Wrong — hardcoded
transition: background-color 0.1s ease;
```

### What to Animate

**Always transition** on interactive elements:
- `background-color` — hover state
- `color` — active/hover text color change
- `border-color` — focus, hover
- `opacity` — show/hide helpers, fade-in
- `box-shadow` — focus ring appearance
- `transform` — active press scale, slide-in

**Never transition** (causes layout reflow, hurts perf):
- `width` / `height` (use `max-height` or `transform: scaleY` instead)
- `top` / `left` / `right` / `bottom` (use `transform: translate` instead)
- `padding` / `margin`

### Expand/Collapse Animation

For accordion-style expand/collapse (e.g., sidebar tree):
```css
/* Expanding content container */
max-height: 0;
overflow: hidden;
transition: max-height ${({ theme }) => theme.transition.slow};

&.expanded {
  max-height: 2000px; /* large enough value */
}
```

### Performance

Add `will-change: transform` to elements that animate with `transform`:
```css
will-change: transform;
transform: translateY(0);
transition: transform ${({ theme }) => theme.transition.slow};
```

### Available Keyframes (from `globalStyles.js`)

| Name | Effect |
|---|---|
| `fade-in` | opacity 0 → 1 |
| `fade-out` | opacity 1 → 0 |
| `slide-down` | translateY(-8px) + fade in — for menus/dropdowns |
| `slide-up` | translateY(-8px) + fade out — for closing |
| `scale-in` | scale(0.96) + fade in — for modals/cards appearing |
| `skeleton-shimmer` | shimmer sweep — for skeleton loaders |
| `fade-and-slide-in-from-top` | translateY(-12px) + fade in — modal entrance |
| `fade-and-slide-out-from-top` | translateY(-12px) + fade out — modal exit |

---

## Interactive States

Every interactive element (`button`, `a`, `[role="button"]`, custom clickable divs) **MUST** implement all four states:

### Hover
```css
&:hover {
  background-color: ${({ theme }) => theme.background.surface1};
  transition: background-color ${({ theme }) => theme.transition.fast};
}
```

### Active (pressed)
```css
&:active {
  transform: scale(0.97);
  transition: transform ${({ theme }) => theme.transition.fast};
}
```

### Focus (see Focus Rings below)

### Disabled
```css
&:disabled,
&[aria-disabled='true'] {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}
```

---

## Focus Rings

**Every** interactive element needs a visible focus state — keyboard accessibility is required.

### Standard Focus Ring
```css
&:focus-visible {
  outline: 2px solid ${({ theme }) => rgba(theme.brand, 0.5)};
  outline-offset: 2px;
}
```

### Input Focus Ring
```css
&:focus {
  border-color: ${({ theme }) => theme.input.focusBorder};
  box-shadow: 0 0 0 2px ${({ theme }) => rgba(theme.brand, 0.2)};
  outline: none;
}
```

Use `rgba` from `polished`:
```js
import { rgba } from 'polished';
```

---

## Loading States

**MUST** show a `<Skeleton>` component when content is loading asynchronously. Never show an empty container.

```jsx
import Skeleton from 'src/ui/Skeleton';

// While loading
<Skeleton width="100%" height="1.5rem" borderRadius={theme.border.radius.base} />

// Multiple lines
<>
  <Skeleton width="80%" height="1rem" />
  <Skeleton width="60%" height="1rem" />
</>
```

Skeleton colors use `theme.background.surface1` as base with an animated shimmer.

---

## Z-Index Scale

```
sidebar overlay:    10
sticky headers:     20
dropdown/popover:   30
modal backdrop:     40
modal card:         50
toast:              60
```

Do not use arbitrary z-index values. Pick the appropriate level from this scale.

---

## Component Structure

```
ComponentName/
  index.js                   — component logic + JSX
  StyledWrapper.js           — ALL styled-components (exported as default)
  ComponentName.stories.jsx  — Storybook (required for ui/ primitives)
```

Co-locate component-specific hooks and utilities within the component folder.
Shared utilities belong in `src/utils/`.

---

## Styled-Components Rules

### One StyledWrapper per component
All styled components for a given component file live in its `StyledWrapper.js`. Do not create inline `styled.div` inside `index.js`.

### Transient props
Prefix props that are only for styling (not HTML attributes) with `$`:
```js
// ✅ Correct
<StyledWrapper $isActive={isActive} $variant="primary">

// ❌ Wrong — passes unknown attr to DOM
<StyledWrapper isActive={isActive} variant="primary">
```

### Theme destructuring
```js
// ✅ Preferred — cleaner
${({ theme }) => theme.brand}

// Also fine
${(props) => props.theme.brand}
```

### Conditional styles
Use the `css` helper from styled-components:
```js
import styled, { css } from 'styled-components';

${({ $isActive }) => $isActive && css`
  font-weight: 600;
  color: ${({ theme }) => theme.brand};
`}
```

### No hardcoded colors
Even one-off values must use theme. If the value isn't in the theme, raise it as a theme addition.

---

## Tailwind Usage

Tailwind is for **layout only**. The following are the only approved Tailwind categories:

| ✅ Allowed | ❌ Not Allowed |
|---|---|
| `flex`, `grid`, `inline-flex` | `text-red-500`, `bg-gray-100` |
| `items-center`, `justify-between` | `border-blue-600`, `ring-offset-2` |
| `gap-*`, `space-*` | `shadow-lg`, `shadow-sm` |
| `p-*`, `px-*`, `py-*`, `m-*` | `rounded-*` |
| `w-full`, `h-full`, `min-w-0` | `opacity-50`, `text-opacity-*` |
| `overflow-hidden`, `overflow-auto` | Any color utility |
| `truncate`, `whitespace-nowrap` | |
| `relative`, `absolute`, `sticky` | |
| `hidden`, `block`, `sr-only` | |

When in doubt: if it touches color, shadow, radius, or border-color — use styled-components theme, not Tailwind.

---

## Quick Reference

```js
// Transition on interactive element
transition: background-color ${({ theme }) => theme.transition.fast},
            color ${({ theme }) => theme.transition.fast};

// Focus ring
&:focus-visible {
  outline: 2px solid ${({ theme }) => rgba(theme.brand, 0.5)};
  outline-offset: 2px;
}

// Border radius
border-radius: ${({ theme }) => theme.border.radius.base};

// Divider
border-bottom: 1px solid ${({ theme }) => theme.colors.border0};

// Shadow
box-shadow: ${({ theme }) => theme.shadow.md};

// Font size
font-size: ${({ theme }) => theme.font.size.base};

// Status color
color: ${({ theme }) => theme.status.danger.text};
background: ${({ theme }) => theme.status.danger.background};
border: 1px solid ${({ theme }) => theme.status.danger.border};
```
