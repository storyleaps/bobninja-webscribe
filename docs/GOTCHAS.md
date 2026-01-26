# Common Gotchas and Lessons Learned

## Table of Contents

- [Common Gotchas and Lessons Learned](#common-gotchas-and-lessons-learned)
  - [Table of Contents](#table-of-contents)
  - [Purpose](#purpose)
  - [UI Layout Issues](#ui-layout-issues)
    - [Width Overflow in Popup UI](#width-overflow-in-popup-ui)
    - [Scrollable Lists Not Reaching Bottom](#scrollable-lists-not-reaching-bottom)
  - [Build and Bundle Size](#build-and-bundle-size)
    - [Chunk Size Warning After Adding Dependencies](#chunk-size-warning-after-adding-dependencies)
  - [Future Sections](#future-sections)

---

## Purpose

This document captures common mistakes, tricky issues, and lessons learned during development of the Webscribe extension. The goal is to prevent repeating the same mistakes and to provide quick reference when similar issues arise.

**When to add to this document:**
- Recurring issues that have happened 2+ times
- Non-obvious bugs with subtle root causes
- Design patterns that frequently cause problems
- Performance issues with specific solutions

**When NOT to add to this document:**
- One-off bugs or typos
- Standard documentation (belongs in other docs)
- Feature descriptions (belongs in README or ARCHITECTURE)

---

## UI Layout Issues

### Width Overflow in Popup UI

#### The Issue

**Symptom:** Content cards or containers appear wider than the popup UI (400px), causing them to be cut off on the right side. The content looks like it's overflowing or hidden behind an invisible boundary.

**Visual Example:**
```
┌─────────────────────────────────┐
│ Popup UI (400px)                │
│ ┌───────────────────────────────┼─┐ ← Card extends beyond boundary
│ │ Card content that is too wi...│ │
│ └───────────────────────────────┼─┘
└─────────────────────────────────┘
```

**Occurrence:** This issue has appeared multiple times in:
- Search tab results (SearchTab.tsx)
- Job details modal (JobsTab.tsx)
- Page lists and content viewers

#### Root Cause

The root cause is **padding inside scrollable containers combined with width constraints**. Here's the specific pattern that causes overflow:

```tsx
// ❌ WRONG - Causes overflow
<div className="overflow-auto pr-3">          {/* Parent has right padding */}
  <div className="space-y-2">
    <Card className="w-full" />               {/* Child tries to be 100% width */}
  </div>
</div>
```

**Why this breaks:**
1. App.tsx has `p-4` (16px padding on each side)
2. Usable width: 400px - 32px = 368px
3. Inner container has `pr-3` (12px right padding)
4. Usable width for content: 368px - 12px = 356px
5. Card with `w-full` tries to be 100% of parent = 368px
6. Result: 368px card in 356px space = **12px overflow**

**The math:**
```
Popup width:        400px
App padding:        - 32px (16px × 2)
Available width:    = 368px

Container padding:  - 12px (pr-3 on inner div)
Usable width:       = 356px

Card width:         = 368px (w-full of parent)
Overflow:           = 12px 🔴
```

#### The Solution

**Option 1: Move padding to outer container (Recommended)**
```tsx
// ✅ CORRECT - No overflow
<div className="overflow-auto pr-1">          {/* Minimal padding on outer */}
  <div className="space-y-2">                 {/* No padding here */}
    <Card />                                   {/* Card sizes naturally */}
  </div>
</div>
```

**Option 2: Account for padding in width calculation**
```tsx
// ✅ CORRECT - But more complex
<div className="overflow-auto">
  <div className="space-y-2 pr-3" style={{ width: 'calc(100% - 12px)' }}>
    <Card className="w-full" />
  </div>
</div>
```

**Best Practice Pattern:**
```tsx
// Use this pattern for scrollable content in the popup
<div className="h-[350px] overflow-auto pr-1">  {/* Height + scroll + minimal padding */}
  <div className="space-y-2">                    {/* Layout only, no padding */}
    <Card>                                       {/* Natural sizing */}
      <CardContent className="pt-4">            {/* Content padding here */}
        {/* ... */}
      </CardContent>
    </Card>
  </div>
</div>
```

#### Key Takeaways

1. **Never add significant padding inside scroll containers** - Move padding to the outer scroll container or to individual cards
2. **Use `pr-1` not `pr-3`** - Minimal padding (4px) is enough to prevent scrollbar overlap
3. **Don't overuse `w-full`** - Let elements size naturally unless forcing 100% is necessary
4. **Test at popup dimensions** - Always verify layouts at 400px width during development
5. **Check for padding conflicts** - When debugging width issues, trace padding through the entire component tree

#### Affected Components

These components have been fixed using the pattern above:

| Component | File | Date Fixed | Pattern Used |
|-----------|------|------------|--------------|
| Search Results | `SearchTab.tsx` | 2025-01-21 | Moved padding to outer `overflow-auto` div |
| Job Details Modal | `JobsTab.tsx` | 2025-01-21 | Used `overflow-auto pr-1` on scrollable area |
| Page Content Modal | `JobsTab.tsx` | 2025-01-21 | Flexbox with proper width constraints |

**Prevention Checklist:**
- [ ] Is there a scroll container? (`overflow-auto`, `ScrollArea`)
- [ ] Does the scroll container have padding? (Check for `px-*`, `pr-*`)
- [ ] Do child elements have width constraints? (Check for `w-full`, `max-w-*`)
- [ ] Does the math add up? (Parent width - padding = actual usable width)
- [ ] Have you tested at 400px width?

---

### Scrollable Lists Not Reaching Bottom

#### The Issue

**Symptom:** A scrollable list (like the jobs list or search results) cannot scroll to the absolute bottom. The last item appears half-hidden or cut off at the bottom.

**Occurrence:** This issue appeared in:
- Jobs list in JobsTab.tsx
- Search results in JobsTab.tsx

#### Root Cause

Using **fixed max-height** (e.g., `max-h-[380px]`) on scrollable containers instead of flex-based layouts. The fixed height:
1. Doesn't adapt to actual available space in the flex container
2. Doesn't account for variable-height headers (e.g., normal header vs action bar)
3. Creates a rigid constraint that clips content

Additionally, missing **bottom padding** on the inner content prevents the last item from scrolling fully into view.

#### The Solution

**Use flex layout instead of fixed heights:**
```tsx
// ❌ WRONG - Fixed max-height clips content
<div className="max-h-[380px] overflow-auto pr-1">
  <div className="space-y-2">
    {items.map(...)}
  </div>
</div>

// ✅ CORRECT - Flex layout fills available space
<div className="flex flex-col flex-1 overflow-hidden">
  <div className="shrink-0">
    {/* Fixed header elements */}
  </div>
  <div className="flex-1 overflow-auto pr-1">
    <div className="space-y-2 pb-2">  {/* pb-2 for bottom breathing room */}
      {items.map(...)}
    </div>
  </div>
</div>
```

**Key Takeaways:**
1. **Use `flex-1 overflow-auto`** instead of `max-h-[Npx]` for scrollable areas in flex layouts
2. **Add `pb-2`** (or similar bottom padding) to inner content so last item can scroll fully into view
3. **Add `shrink-0`** to fixed-height elements (headers, search bars) to prevent them from shrinking
4. **Parent must have `overflow-hidden`** for flex children to respect boundaries

#### Affected Components

| Component | File | Date Fixed | Fix Applied |
|-----------|------|------------|-------------|
| Job List | `JobsTab.tsx` | 2025-12-04 | Changed from `max-h-[380px]` to flex layout with `pb-2` |
| Search Results | `JobsTab.tsx` | 2025-12-04 | Changed from `max-h-[380px]` to flex layout with `pb-2` |

---

## Build and Bundle Size

### Chunk Size Warning After Adding Dependencies

#### The Issue

**Symptom:** When running `npm run build` in the `popup/` folder, Rollup warns:
```
(!) Some chunks are larger than 500 kB after minification.
```

**Occurrence:** This happens when new dependencies are added without updating the `manualChunks` configuration in `vite.config.ts`.

#### Root Cause

The popup uses many large dependencies (React, Radix UI, react-markdown, react-syntax-highlighter, jszip, etc.). Without chunk splitting, Vite bundles everything into a single large file that exceeds 500 kB.

#### The Solution

**Always add new dependencies to the appropriate chunk in `vite.config.ts`:**

```typescript
// In vite.config.ts → build.rollupOptions.output.manualChunks
manualChunks: {
  'react-vendor': ['react', 'react-dom'],
  'radix-vendor': [
    '@radix-ui/react-accordion',
    '@radix-ui/react-checkbox',
    // ... add new @radix-ui/* packages here
  ],
  'markdown-vendor': [
    'react-markdown',
    'react-syntax-highlighter',
    'marked',
    // ... add new markdown/syntax libraries here
  ],
  'utils-vendor': [
    'jszip',
    'lucide-react',
    // ... add new utility libraries here
  ],
}
```

**When adding a new dependency:**

1. Install the package: `npm install <package>`
2. Determine which chunk it belongs to:
   - React-related → `react-vendor`
   - Radix UI components → `radix-vendor`
   - Markdown/syntax highlighting → `markdown-vendor`
   - Utilities/icons/other → `utils-vendor`
3. Add it to the appropriate array in `manualChunks`
4. Run `npm run build` and verify no chunk exceeds 500 kB
5. If a chunk grows too large, consider creating a new vendor chunk

#### Key Takeaways

1. **Never ignore the chunk size warning** - It indicates a real performance issue
2. **Don't use `chunkSizeWarningLimit`** - This just hides the warning without fixing it
3. **Don't use dynamic imports for core UI** - Causes loading states in a 400x600px popup that needs to be immediately responsive
4. **Keep chunks under 500 kB** - Split into a new chunk if needed
5. **Group related packages** - Keeps the configuration maintainable

#### Prevention Checklist

- [ ] Did you add a new npm dependency?
- [ ] Is it added to `manualChunks` in `vite.config.ts`?
- [ ] Does `npm run build` complete without chunk size warnings?
- [ ] Is each chunk under 500 kB?

---

## Future Sections

*Add more gotchas as they are discovered...*

### State Management Pitfalls

*To be added when patterns emerge*

### Service Worker Communication Issues

*To be added when patterns emerge*
