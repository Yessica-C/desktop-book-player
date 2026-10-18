# Parent Audio Player Specification

## 1. Purpose

The parent audio player coordinates the application's book and chapter playback workflow and supplies controlled state and callbacks to `AudioControlBar`.

It owns the queue, the current item, the `HTMLAudioElement`, loading and error handling, playback persistence, and the rules for moving through a folder's contents. `AudioControlBar` remains presentational: it reports user intent and does not receive an audio element reference.

This specification covers the first parent implementation for local audio files represented by in-memory virtual folders. The storage model may be backed by a real library or persistence layer later, but the playback contract must not depend on that implementation detail.

### Implementation boundary

Implement this as a renderer-side playback controller with a React adapter, not as Electron main-process playback logic and not as one large visual React component.

- A pure TypeScript module should own queue resolution, item selection, status transitions, load cancellation, error mapping, and persistence interfaces. It must not depend on the DOM or Electron APIs.
- A React hook or small `AudioPlayer` container should own the renderer's `HTMLAudioElement`, subscribe to native media events, connect controller state to `AudioControlBar`, and expose progress and current-item data to the rest of the reader UI.
- `AudioControlBar` remains a presentational child. It receives controlled state and callbacks, and never receives the audio element, queue, or storage services.
- Electron main and preload code should provide only capabilities the renderer cannot safely provide itself, such as native file access, chapter metadata extraction, file dialogs, and durable persistence. These capabilities must cross narrow, typed preload APIs.

The `HTMLAudioElement` must remain in the renderer because it is a browser and DOM API. Electron main must not own playback state or call renderer audio methods. The renderer owns the active media session, while the main process may own file access and durable storage.

## 2. Responsibilities

The parent application must:

- Own the selected virtual folder and derive its queue from that folder's contents.
- Represent a long M4B audiobook as ordered chapter items in the queue.
- Select the current item and expose its metadata to the reader UI.
- Own one `HTMLAudioElement` for the active item.
- Load, play, pause, seek, and unload audio in response to user intent and media events.
- Supply `AudioControlBar` with playback status and capability flags.
- Advance to the next queue item when the current item ends.
- Cancel an in-progress load when the user selects Previous or Next.
- Discard an unavailable item and continue to the requested adjacent item when possible.
- Persist and restore the current item and playback position.
- Expose progress, duration, current time, and current item metadata to other UI.
- Translate media and storage failures into controlled application state.

The parent must not:

- Put queue-navigation logic into `AudioControlBar`.
- Ask `AudioControlBar` to inspect an audio element, folder, or queue.
- Allow stale media events from a replaced item to mutate current playback state.
- Automatically retry a failed item without an explicit recovery policy.
- Treat a missing item as a valid playable item.

## 3. Domain model

The initial domain model is intentionally independent of the storage implementation.

```ts
export interface VirtualFolder {
  id: string
  name: string
  itemIds: string[]
}

export interface AudioItem {
  id: string
  folderId: string
  title: string
  source: string
  kind: 'file' | 'chapter'
  chapterIndex?: number
  durationSeconds?: number
}

export interface PlaybackPosition {
  itemId: string
  positionSeconds: number
  updatedAt: number
}
```

A folder's queue is the ordered list obtained by resolving `itemIds`. The parent must preserve that order. For a chapterized M4B, each chapter is a separate `AudioItem` and its `source` identifies the playable media for that chapter, whether that is a byte-range-derived URL, a temporary local URL, or another renderer-compatible source.

The parent must validate that an item belongs to the selected folder before making it current. Missing item records and missing sources are unavailable and must not be passed to the audio element.

## 4. Parent component API

The parent component may be named `AudioPlayer` and should expose a view model to its child controls and surrounding reader UI.

```tsx
export interface AudioPlayerProps {
  folder: VirtualFolder | null
  items: readonly AudioItem[]
  initialItemId?: string
  disabled?: boolean
  onPlaybackError?: (error: PlaybackError) => void
}

export interface AudioPlayerViewModel {
  status: PlaybackStatus
  currentItem: AudioItem | null
  currentIndex: number
  queueLength: number
  currentTimeSeconds: number
  durationSeconds: number
  hasPrevious: boolean
  hasNext: boolean
  canSeek: boolean
  error: PlaybackError | null
  onPlay: () => void
  onPause: () => void
  onPrevious: () => void
  onNext: () => void
  onSeekRelative: (offsetSeconds: number) => void
}
```

The parent passes the view-model fields directly to `AudioControlBar`. It may also use the same fields for a progress display, chapter title, loading indicator, and error UI.

`currentIndex` is the index in the resolved folder queue, not the index in the global item collection. When there is no current item, it is `-1`, `queueLength` is `0`, and all playback capabilities are false.

## 5. Audio element ownership

The parent owns exactly one `HTMLAudioElement` for the active playback session. It may render the element visibly or keep it visually unobtrusive, but it must remain available to receive native media events.

The parent is responsible for:

- Assigning `audio.src` only for the current validated item.
- Calling `audio.load()` when a new item is selected.
- Calling `audio.play()` only in response to the parent's play action or an allowed continuation after an item ends.
- Calling `audio.pause()` before replacing or clearing the current source.
- Removing or replacing event listeners during cleanup.
- Clearing `audio.src` and calling `audio.load()` when no playable item remains.

The parent must handle the promise returned by `audio.play()`. A rejected promise must transition to `error` and must not be treated as successful playback.

The parent must associate event handlers with the item load that created them. An event from an old source must be ignored when its load token no longer matches the current load token.

## 6. Playback state

The parent exposes the `PlaybackStatus` type used by `AudioControlBar`:

```ts
export type PlaybackStatus =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'error'
```

State meanings:

| Status | Meaning |
| --- | --- |
| `idle` | A valid item is selected but playback has not started, or no item is selected and the parent is ready for a selection. |
| `loading` | The selected item's source is being loaded or a requested play operation is pending. |
| `playing` | The audio element reports active playback for the current item. |
| `paused` | A valid item is loaded and playback is intentionally paused. |
| `ended` | The current item reached its end and no next item has yet become active. This is a transient state when a next item exists. |
| `error` | The current load or playback operation failed and requires parent-owned recovery or navigation. |

The parent must derive capabilities as follows:

```ts
const hasPrevious = currentIndex > 0
const hasNext = currentIndex >= 0 && currentIndex < queue.length - 1
const canSeek = durationSeconds > 0 && status !== 'loading' && status !== 'error'
```

The parent may disable the control bar for application-level unavailability, such as no selected folder, while still preserving the last known state for display.

## 7. Queue resolution and selection

When a folder is selected:

1. Resolve its `itemIds` in order.
2. Exclude missing or invalid item records from the playable queue.
3. Preserve the selected item if it remains valid.
4. Otherwise restore the persisted item for that folder, if valid.
5. Otherwise select the first playable item.
6. If no playable item exists, clear the current item and expose an unavailable or error state without assigning a source.

Selecting an item must cancel the current load, pause the audio element, clear transient error state, and start loading the new item. The parent must not reuse the previous item's duration or current time for the new item.

The parent should retain unavailable item information separately from the playable queue so the UI can explain why an item was skipped without allowing it to affect `hasPrevious` or `hasNext` calculations.

## 8. Control callback behavior

The callbacks passed to `AudioControlBar` are synchronous intent handlers owned by the parent.

### Play

When `onPlay` is called:

- If the current item is valid and loaded, call `audio.play()`.
- If the current item is selected but not loaded, begin loading it and then play after `canplay` or the equivalent readiness event.
- If status is `error`, do not silently retry. The parent may expose a separate retry action or require the user to select another item.
- Update state to `loading` while an asynchronous play or load operation is pending.

### Pause

When `onPause` is called:

- Call `audio.pause()` for the current item.
- Preserve the current time.
- Transition to `paused` after the pause state is confirmed or immediately if the element is already paused.
- Persist the updated position.

### Previous and Next

When `onPrevious` or `onNext` is called:

- Cancel any in-progress load or pending play operation.
- Pause the current element.
- Select the adjacent playable item in the resolved queue.
- Begin loading the selected item.
- Start playback after the new item is ready if the request originated while the previous item was playing or loading for playback.

If no adjacent playable item exists, do nothing and emit no invalid audio operation. The corresponding button should normally already be disabled by `hasPrevious` or `hasNext`.

If the current item becomes unavailable during loading, discard it from the playable queue for the current folder and continue in the requested direction. If the requested direction has no remaining item, expose the error or empty-queue state and do not loop back to the other end of the queue.

### Relative seek

When `onSeekRelative(offsetSeconds)` is called:

- Ignore the request while loading, in error, or without a valid duration.
- Clamp the target position to the interval `[0, durationSeconds]`.
- Assign the clamped value to `audio.currentTime`.
- Persist the new position after the assignment succeeds.

The parent, not the control component, owns clamping and persistence.

## 9. Native media event handling

The parent must map native media events to the controlled state:

| Event | Parent behavior |
| --- | --- |
| `loadedmetadata` | Set duration from `audio.duration`, restore the saved position for the current item, and expose `canSeek` when valid. |
| `canplay` | Complete loading. If a play request is pending, call `audio.play()`. |
| `play` | Set status to `playing`. |
| `pause` | Set status to `paused` unless the parent is replacing or clearing the source. |
| `timeupdate` | Update current time and schedule position persistence. |
| `ended` | Persist the final position, then select and load the next item when one exists. |
| `error` | Convert the media error into `PlaybackError`, discard the unavailable item for this session, and stop playback for that item. |
| `stalled` or `waiting` | Keep or enter `loading` only when the parent is waiting for the initial item load; do not label ordinary buffering as a new queue selection. |

On `ended`, the parent must advance exactly once per end event. It must not call `AudioControlBar` callbacks, simulate a button click, or rely on a second `ended` event from the replaced source.

When advancing automatically, the parent should load the next item and begin playback. If the next item is unavailable, discard it and continue forward until a playable item is found or the queue is exhausted. When the queue is exhausted, leave the final item selected with status `ended` and `hasNext === false`.

## 10. Loading cancellation and stale work

Every selection or load attempt receives a monotonically increasing load token. Async work may update state only if its token still matches the current token.

Cancellation must:

- Invalidate the current token.
- Pause the audio element.
- Clear pending play intent.
- Detach or supersede handlers for the old source.
- Prevent old `canplay`, `play`, `pause`, `ended`, and `error` events from changing current state.

If source preparation later requires asynchronous Electron or storage work, that work must support cancellation through `AbortController` or an equivalent request token. A canceled request must not surface as a playback error for the newly selected item.

## 11. Persistence

The parent must persist playback state per folder and item. At minimum it stores:

```ts
export interface PersistedPlaybackState {
  folderId: string
  itemId: string
  positionSeconds: number
  updatedAt: number
}
```

Persistence rules:

- Restore state only after validating that the folder and item still exist.
- Clamp restored position to the known duration when duration is available.
- Persist on pause, seek, item change, `timeupdate` at a throttled interval, and before normal app shutdown when practical.
- Store `0` for an item that has completed if the product wants replay to start from the beginning; otherwise retain the final position and define replay behavior consistently. The initial implementation should reset a completed item to `0` when Play is requested.
- A persistence failure must not crash playback. Report it through diagnostics and continue with in-memory state.

The persistence adapter should be asynchronous and replaceable. The parent should not couple playback behavior to a particular database, file format, or Electron IPC channel.

## 12. Error model and recovery

The parent exposes structured errors rather than raw media event objects:

```ts
export type PlaybackErrorCode =
  | 'item-missing'
  | 'source-unavailable'
  | 'media-load-failed'
  | 'playback-rejected'
  | 'persistence-failed'

export interface PlaybackError {
  code: PlaybackErrorCode
  itemId?: string
  message: string
  recoverable: boolean
}
```

Error behavior:

- Missing records and unusable sources are marked unavailable before loading when possible.
- Media load failures transition to `error`, preserve the failed item metadata for display, and prevent controls from issuing requests until the parent provides recovery or navigation.
- A failed item encountered during automatic advancement is discarded for the current session and the next playable item is attempted.
- A failed item encountered during an explicit Previous or Next request is discarded and traversal continues in the requested direction.
- Errors from persistence are non-blocking and must not change playback status to `error`.
- The parent must expose enough error information for the reader UI to identify the item and offer an appropriate retry, removal, or navigation action.

## 13. Electron boundary

Playback orchestration belongs in the renderer because the `HTMLAudioElement` is a renderer API. Electron integration is appropriate for operations the renderer cannot safely or reliably perform itself, including:

- Selecting or importing files through native dialogs.
- Reading file metadata or chapter information when renderer access is insufficient.
- Resolving protected local paths into renderer-consumable sources.
- Persisting folders, items, and playback positions across launches.
- Coordinating application shutdown and a final persistence flush.

The preload layer must expose narrow, typed APIs for these operations. The parent must not access Node.js or Electron internals directly from React code, and it must not send arbitrary filesystem paths or unvalidated objects across IPC.

The Electron main process must not own playback state or call renderer audio methods. It may own durable storage and file access, while the renderer remains the source of truth for the currently active media session.

## 14. Accessibility and UI integration

The parent must provide:

- A current item title and folder name for accessible context.
- A readable current time and duration for progress UI.
- A loading indication while a source is being prepared.
- An error message associated with the failed item when status is `error`.
- A live status message only when needed to communicate state changes that are not otherwise visible.

The parent must not depend on color, visual animation, or the control bar's icon content to communicate playback state. The control bar remains responsible for its own button names and native disabled state.

## 15. State transition examples

### Initial folder selection

```text
no folder
  -> resolve folder queue
  -> select restored or first playable item
  -> loading
  -> idle
```

### User starts playback

```text
idle or paused
  -> loading, if media is not ready
  -> playing
```

### Automatic advancement

```text
playing
  -> ended
  -> select next playable item
  -> loading
  -> playing
```

### Failed item during navigation

```text
loading item A
  -> cancel item A
  -> discard item A
  -> select requested adjacent item B
  -> loading item B
```

### Exhausted queue

```text
playing final item
  -> ended
  -> no next item
  -> ended, with hasNext === false
```

## 16. Acceptance criteria

- The parent can fully drive `AudioControlBar` without passing it an audio element reference.
- The resolved queue contains only valid items from the selected virtual folder and preserves folder order.
- A chapterized M4B is navigated as ordered chapter items.
- Play, pause, relative seek, Previous, and Next operate through the parent's callbacks.
- Previous or Next cancels an active load and starts loading the requested adjacent item.
- A stale event from an old source cannot change the current item's status, time, duration, or error.
- The current item automatically advances to the next playable item exactly once when playback ends.
- Automatic advancement skips unavailable items and stops at the end of the queue without wrapping.
- The parent exposes accurate `hasPrevious`, `hasNext`, `canSeek`, status, duration, current time, and current item metadata.
- Playback position is restored when a valid persisted item is selected.
- Playback position is persisted on the required state changes without blocking playback.
- Media and play-promise failures become structured parent state and do not escape as unhandled rejections.
- Electron-specific storage and file operations cross a narrow preload API rather than importing Electron or Node APIs into React components.
- The parent provides enough state for loading, progress, current item, and error UI without putting those responsibilities into `AudioControlBar`.

## 17. Out of scope for this version

- Volume, mute, and playback speed.
- A queue editor or drag-and-drop reordering.
- Cross-folder playback.
- Automatic repeat or shuffle modes.
- Media Session API integration.
- Background playback independent of the application window.
- Cloud synchronization.
- Multiple simultaneous audio elements.
