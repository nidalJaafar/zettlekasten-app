# Inbox Expanded Capture Design

## Goal

Reduce friction when capturing fleeting notes by allowing users to write both the note title and body directly in the Inbox.

## Problem

The current Inbox capture flow only supports entering a title. If the user wants to add note body content, they must capture the note, find it again in the list, open it, and then continue writing. That adds unnecessary friction to the most frequent quick-capture workflow.

## Design

### Capture flow

- Replace the current title-only capture with a lightweight two-field fleeting-note composer.
- Fields:
  - title
  - body
- Both fields should live directly inside the Inbox capture card.

### Save behavior

- Saving should still create a `fleeting` note.
- If the body is empty, quick capture should remain fast and lightweight.
- If the body has content, it should be saved as the note `content` immediately.
- No follow-up search or workspace navigation should be required just to finish a fleeting note body.

### Keyboard behavior

- Title remains the primary entry point.
- Pressing `Enter` in the title field should move focus into the body field when the user is composing a longer thought.
- `Ctrl/Cmd+Enter` from the body field should save the note.

### UX constraints

- Keep the Inbox capture card visually quiet.
- Do not turn the Inbox into a large editor surface.
- Keep the rest of the Inbox list and note-opening behavior unchanged.

## Implementation outline

- Keep the change local to `apps/desktop/src/screens/InboxScreen.tsx`.
- Expand local capture state from title-only to title + body.
- Pass `content` to `createNote()` when body text exists.
- Add focused Inbox tests for title-only capture, title+body capture, keyboard save behavior, and empty capture behavior.

## Testing

Add or update tests for:

- capturing a title-only fleeting note
- capturing a fleeting note with both title and body
- `Ctrl/Cmd+Enter` saving from the body field
- empty capture doing nothing

## Scope boundaries

Included:

- Inbox two-field fleeting-note capture
- keyboard capture improvements within Inbox

Not included:

- changing the workspace flow
- changing note types or promotion rules
- replacing Inbox with a full editor
