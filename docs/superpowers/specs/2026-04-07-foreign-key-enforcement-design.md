# Foreign Key Enforcement Design

**Date:** 2026-04-07  
**Scope:** Enforce SQLite foreign-key integrity for `sources`, `notes`, and `note_links` in both test and desktop database connections.  
**Out of scope:** Soft-delete link filtering, review-flow transactions, graph filtering, and unrelated repo hygiene fixes.

## Problem

The schema declares foreign-key relationships, but SQLite does not enforce them unless each connection enables `PRAGMA foreign_keys = ON`.

Current behavior allows invalid rows such as:

- `notes.source_id` pointing at a missing source
- `note_links.from_note_id` or `note_links.to_note_id` pointing at missing notes

This breaks the contract implied by the schema and allows silent data corruption.

## Goals

- Enable foreign-key enforcement for every supported database connection.
- Keep the fix minimal and local to database setup.
- Update tests so they only create valid referenced rows.
- Add regression coverage proving invalid references are rejected.

## Non-Goals

- Adding a new validation layer in note or link CRUD helpers.
- Reworking the schema shape or migration strategy beyond enabling FK enforcement.
- Changing application workflows except where test fixtures must become valid.

## Design

### 1. Enable FK enforcement at connection setup

Each concrete database implementation must execute `PRAGMA foreign_keys = ON` before relying on the schema:

- `packages/core/tests/helpers/db.ts` for the sql.js test database
- `apps/desktop/src/db.ts` for the Tauri SQL database

This keeps integrity enforcement at the actual persistence boundary rather than scattering checks through callers.

### 2. Keep migrations additive

`runMigrations()` remains responsible for schema creation and additive column migrations. The FK-enabling step is connection setup, not schema definition, because SQLite applies the pragma per connection.

### 3. Tighten tests to use valid fixtures

Tests that create literature notes with `source_id` must first insert a real source row. Regression tests should assert that invalid foreign-key inserts reject with SQLite errors rather than succeeding silently.

### 4. Verification

The implementation is complete when:

- creating a literature note with a missing `source_id` fails in tests
- inserting a link to a missing note fails in tests
- existing happy-path tests still pass with valid source fixtures
- desktop and core typechecks relevant to touched files still pass

## Risks

- Existing tests may fail because they rely on invalid fixtures.
- Existing app code paths that accidentally write invalid references will start failing instead of corrupting data. This is desired, but verification should confirm the app still initializes correctly.

## Chosen Approach

Approach 1: enable foreign-key enforcement in every DB connection and update tests/data setup to only create valid references.
