# Editorial Dark Overhaul Design

**Date:** 2026-04-07  
**Scope:** Visual overhaul of the desktop app toward a dark, minimalist, Obsidian-adjacent writing environment without changing the core app structure.  
**Out of scope:** Navigation architecture changes, new product features, workflow redesign, or major state-management refactors.

## Problem

The current desktop UI feels over-designed in the wrong direction: too ornamental, too product-like, and not calm enough for a note-taking tool centered on reading and writing.

The goal is not to make it flashy. The goal is to make it feel composed, quiet, and intentional.

## Goals

- Move the app toward a dark, minimalist, writing-first atmosphere.
- Land closer to Obsidian's emotional tone than VS Code's utilitarian tooling aesthetic.
- Keep the existing screen structure and workflows intact.
- Make Review the visual centerpiece of the app.
- Establish a tighter, more coherent design language across all desktop screens.

## Non-Goals

- Reworking the information architecture.
- Adding new UI features beyond what is required for the overhaul.
- Introducing heavy animation or attention-seeking visual effects.

## Chosen Direction

Warm editorial minimalism.

The app should feel like a quiet reading room at night: dark graphite surfaces, warm text, restrained accents, and strong typographic hierarchy. The most memorable quality should be that it feels like writing in a serious notebook rather than operating a dashboard.

## Structure

The app keeps the current composition:

- sidebar navigation
- one active primary screen at a time
- existing modal/overlay behavior

The visual treatment changes, not the app map.

### Structural intent

- Sidebar becomes quieter and lighter in visual weight.
- Screen headers become subtle page introductions rather than toolbar-like bars.
- Content areas gain more breathing room.
- Lists and editor surfaces become flatter and calmer.
- Review becomes the visual center of gravity.
- Graph chrome recedes so the graph itself is primary.

## Visual Language

### Palette

- Base background: near-black graphite
- Raised surfaces: soft slate variants with low contrast from the base
- Primary text: warm parchment-tinted off-white
- Secondary text: cool muted gray-brown
- Accent: restrained, sparingly used, ink-like rather than luminous
- Note-type colors: still distinct, but desaturated and more refined than the current gold/amber/violet emphasis

### Typography

- Serif for major titles, note titles, and reading-heavy surfaces
- Understated sans for controls, metadata, labels, and navigation
- More generous line-height and breathing room
- Reduced small-text harshness by lowering contrast and tightening hierarchy

### Surfaces

- Fewer loud card borders
- More layering through tone than through boxes
- Soft separators instead of hard divisions
- Extremely restrained texture or depth where useful, never decorative for its own sake

### Motion

- Subtle hover/focus transitions only
- Soft overlay fades where already supported by existing structure
- No flashy motion language

### Controls

- Inputs should feel integrated into writing surfaces
- Active states should feel inked or pressed-in, not glowing
- Counts, chips, and tags should be visually quieter and more typographic

## Screen Intent

### Sidebar

The sidebar should feel like a table of contents. It should stop acting like a product control panel.

Design targets:

- quieter logo/monogram treatment
- lighter separators
- more elegant active state
- less emphasis on boxed counters and stronger emphasis on reading flow

### Inbox

Inbox should feel like an intake tray.

Design targets:

- quick capture becomes the primary visual gesture
- fleeting notes read as stacked entries instead of product cards
- empty state should feel intentional and literary, not generic

### Review

Review should be the most refined screen in the application.

Design targets:

- the editor feels substantial and calm
- step progression is present but subtle
- supporting controls recede behind note title and writing area
- source and link pickers feel like part of the page, not embedded widgets

### Library

Library should feel archival.

Design targets:

- processed notes read like catalog entries or shelf items
- source and date metadata become elegant and compact
- expanded content reads comfortably and quietly

### Graph

Graph should feel atmospheric and immersive.

Design targets:

- search and inspector remain, but their chrome becomes lighter and more integrated
- background and overlays feel more contemplative than technical
- graph remains easy to inspect without becoming visually noisy

## Implementation Boundaries

This overhaul should primarily touch:

- `apps/desktop/src/theme.ts`
- `apps/desktop/src/global.css`
- shared desktop components such as sidebar and note/list/picker surfaces
- screen-level styling in Inbox, Review, Library, and Graph

If a component file becomes too overloaded during the overhaul, splitting styles or subcomponents is acceptable only where it improves clarity for this redesign.

## Success Criteria

- The app still behaves the same functionally.
- The UI feels calmer, darker, and more writing-focused.
- Review clearly feels like the visual centerpiece.
- The design is coherent across all screens instead of screen-by-screen styling drift.
- Desktop typecheck passes after the overhaul.

## Verification

- `pnpm --filter @zettelkasten/desktop typecheck`
- manual visual check across Inbox, Review, Library, and Graph
- confirm the app remains usable at the current desktop window constraints

## Chosen Approach

Apply a visual-only overhaul with the existing layout and workflows intact, using a warm editorial dark theme closer to Obsidian than VS Code.
