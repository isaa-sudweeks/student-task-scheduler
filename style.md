# Student Task Scheduler – UI Style Guide

This document defines visual and interaction guidelines for the app. Follow these conventions for a consistent, accessible, and clean UI.

## Design Principles

- Clarity: Prioritize legibility and simple layouts.
- Restraint: Minimal chrome; let content carry the weight.
- Consistency: Reuse components and spacing tokens.
- Accessibility: Sufficient contrast, clear focus states, keyboard support.

## Foundations

### Colors

- Light theme base: `bg-white`, `text-zinc-900`, subtle borders `border-zinc-200`.
- Dark theme base: `bg-zinc-900`, `text-zinc-100`, borders `border-white/10`.
- Muted text: `text-muted-foreground` via Tailwind config or `text-zinc-500`.
- Accents: Prefer neutral emphasis; avoid bright brand colors in core UI.

### Spacing & Radii

- Spacing scale: Tailwind defaults; common vertical rhythm uses `py-2.5`, `py-3`, `gap-2`, `gap-3`.
- Container width: content max at `max-w-4xl` with side padding `px-4 sm:px-6 lg:px-8`.
- Radius: `rounded-md` for inputs/buttons; `rounded-lg`/`rounded-xl` for cards.

### Typography

- Base: System font stack via Tailwind. Keep sizes small-to-medium.
- Headings: `text-2xl font-semibold` for page titles; `text-lg font-medium` for sections.
- Body: `text-sm` for controls and dense layouts.

### Elevation & Borders

- Cards: `border` + subtle `shadow-sm` for primary containers.
- Menus: `rounded` + `shadow-lg`; thin borders for dark theme: `dark:border-white/10`.

### Light/Dark

- Use `next-themes` with `ThemeToggle` in the header.
- Ensure foreground/background pairs have WCAG AA contrast.
- Provide skeletons/placeholders that adapt to theme (e.g., `bg-black/10` vs `dark:bg-white/10`).

## Layouts

### App Header (Top Bar)

- Composition: Title + count on left; search input, primary action, theme toggle, account avatar on the right.
- Behavior: Sticky with blur: `sticky top-0 z-10 border-b bg-white/80 backdrop-blur dark:bg-slate-950/80`.
- Right cluster order: search → primary action → theme toggle → account avatar.
- Account avatar uses the user’s Google profile image when available; otherwise initials.

### Content Area

- Page padding: `py-6` with side paddings `px-4 sm:px-6 lg:px-8`.
- Primary card: `rounded-xl border bg-white dark:bg-zinc-900 shadow-sm p-4`.

## Components

### Buttons

- Variants:
  - Primary: `bg-black text-white dark:bg-white dark:text-black`.
  - Secondary: `bg-gray-100 text-gray-900 border border-gray-300 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700`.
  - Danger: `bg-red-600 text-white hover:bg-red-700 dark:bg-red-700`.
- Sizing: Default height `h-9` in dense toolbars; horizontal padding `px-3`–`px-4`.
- Shape: `rounded-md`. Avoid pill shapes unless clearly needed.
- Focus: Always show visible ring: `focus-visible:ring-2 focus-visible:ring-indigo-500` for interactive icon buttons.

### Primary Action (New Task)

- Placement: Right cluster, after search.
- Size: `h-9`; text `text-sm`; padding `px-3`–`px-4`.
- Label: “+ New Task”. Avoid emojis; keep concise.
- Behavior: Opens Task Modal; also bind global hotkey “n”.

### Text Input (Search)

- Size: `h-9` with `rounded-md border px-3 text-sm`.
- Widths: `w-40 md:w-80`.
- Placeholder: “Search tasks…”. Avoid extra adornments unless necessary.

### Theme Toggle

- Icon-only button `h-9 w-9`, rounded, subtle hover bg.
- Taps between light/dark; persists in `localStorage`.

### Account Menu (Settings)

- Trigger: Icon-only avatar at top-right. Use user’s Google profile image (`user.image`) when present; fall back to initials in a neutral circle.
- Size: `h-9 w-9` round avatar; no text label adjacent.
- Menu: Right-aligned dropdown `w-56` with rounded corners, subtle border, and hover states.
- Items: “Account Settings”, “Sign out”.

### Tabs (Filters)

- Use compact segment control with `inline-flex rounded-lg border bg-white p-1`.
- Active tab style: subtle background `bg-neutral-100` in light mode.

### Skeletons

- Use animated placeholders during suspense: `animate-pulse` with theme-aware colors `bg-black/10` or `dark:bg-white/10`.

## Accessibility

- Labels and titles for icon-only buttons via `aria-label`/`title`.
- Keyboard: All menus focusable; Esc closes; click outside closes.
- Contrast: Minimum AA; test in both themes.

## Do/Don’t

- Do keep headers light and uncluttered.
- Do align controls to `h-9` for dense toolbars.
- Don’t mix multiple button heights in one row.
- Don’t introduce bright brand colors in core shell; reserve for logos/avatars.

