# Mobile Parity Audit Design

## Goal

Bring the React Native mobile app into one-to-one product parity with the desktop app.

For this project, any desktop/mobile mismatch counts as a bug, even if the mobile behavior is otherwise usable.

## Source Of Truth

- Desktop app behavior and naming are the reference product.
- Mobile must match desktop feature coverage, flow structure, and naming unless a platform limitation makes literal parity impossible.
- If a platform limitation exists, the mobile version should preserve the same user intent and terminology.

## Scope

The audit covers the full mobile app surface against the desktop app:

- Screen and tab names
- Navigation entry points and route structure
- Inbox behavior
- Review workflow behavior
- Library behavior
- Graph behavior
- Trash behavior
- Note opening flows
- Source selection and source lifecycle
- Permanent note linking
- Wikilink behavior
- Autosave and persistence behavior
- Delete, restore, and permanent delete flows
- Empty states and refresh behavior

## Audit Rules

Every finding should be classified as one or more of:

- `Parity bug`: mobile differs from desktop naming, feature set, or flow structure
- `Runtime bug`: mobile can fail, save invalid state, or lose data
- `UI bug`: visual or interaction issue that breaks expected behavior or clarity

Findings should be ordered by severity:

- High: data loss, broken lifecycle flow, unreachable features, incorrect product structure
- Medium: stale state, misleading UI, incomplete parity in non-critical flows
- Low: cosmetic or minor interaction mismatch

## Expected Mobile Product Shape

The mobile app should mirror the desktop product model:

- `Inbox` is the capture surface for fleeting notes
- `Review` is the processing surface for turning notes into literature and permanent notes
- `Library` contains processed literature notes
- `Graph` shows permanent notes and links
- `Trash` is reachable from the main product flow

Naming should match desktop exactly wherever the same concept exists.

## Known Mismatches Already Confirmed

- Mobile uses `Editor` in the tab bar instead of desktop-aligned naming
- Mobile currently collapses multiple desktop concepts into a single `workspace` route
- Mobile tab UI is currently rendering incorrectly in at least one observed state
- Mobile has already had missing navigation entry points such as Trash

These are bugs regardless of whether the underlying screens are still usable.

## Execution Plan For The Audit

1. Compare desktop and mobile route/screen structure.
2. Compare desktop and mobile naming across tabs, headers, buttons, and actions.
3. Compare each end-to-end note flow:
   - capture fleeting note
   - process to literature
   - process to permanent
   - browse library
   - inspect graph
   - delete, restore, permanently delete
4. Verify state synchronization and refresh behavior after each mutating action.
5. Verify that every desktop feature has a reachable mobile counterpart.
6. Produce a concrete findings list with file references.
7. Fix issues in small batches, verifying after each batch.

## Verification Gates

For each fix batch:

- Run `pnpm --filter @zettelkasten/mobile typecheck`
- Run any additional targeted verification relevant to the changed surface
- Run broader repo verification as needed, while distinguishing known pre-existing desktop typecheck failures from mobile-specific failures

## Non-Goals

- Redesigning the product beyond parity needs
- Introducing mobile-only naming for shared product concepts
- Leaving deliberate desktop/mobile divergence in place without explicit approval

## Success Criteria

This work is complete when:

- Mobile naming matches desktop naming for shared concepts
- Mobile exposes the same product features as desktop
- No major desktop flow is missing or unreachable on mobile
- Confirmed mobile bugs found during the audit are fixed
- Verification passes for the mobile app changes
