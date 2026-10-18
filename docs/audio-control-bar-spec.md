# AudioControlBar Component Specification

## 1. Purpose

`AudioControlBar` is a presentational React component for user interaction with audio playback in the desktop book player. It renders playback controls and reports the user's requested action to its parent.

The component does not own the playlist, select tracks, load audio, call `HTMLAudioElement` methods, persist playback state, or decide what the next or previous item is.

## 2. Responsibilities

The component must:

- Render play/pause, previous, next, rewind 15 seconds, and fast-forward 15 seconds controls.
- Reflect playback state supplied by the parent.
- Emit explicit callbacks when the user activates a control.
- Disable controls that cannot currently function.
- Provide accessible names and pressed/busy state where appropriate.
- Remain usable with either a single audio file or an item from a parent-owned queue.

The component must not:

- Maintain or mutate the playlist or queue.
- Find the next or previous track/chapter/file.
- Directly control an audio element.
- Automatically advance playback after a track ends.
- Decide whether a requested previous item exists.
- Add playback persistence, keyboard shortcuts, or volume controls in this version.

## 3. Proposed API

```tsx
export type PlaybackStatus =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'error'

export interface AudioControlBarProps {
  status: PlaybackStatus
  hasPrevious: boolean
  hasNext: boolean
  canSeek: boolean
  onPlay: () => void
  onPause: () => void
  onPrevious: () => void
  onNext: () => void
  onSeekRelative: (offsetSeconds: number) => void
  disabled?: boolean
  className?: string
}
```

### API decisions

- The parent supplies `hasPrevious` and `hasNext`; the component never inspects or navigates the queue.
- `onSeekRelative` receives `-15` for rewind and `15` for fast-forward. The parent clamps the resulting position to the valid duration.
- `status` is controlled by the parent and should reflect the actual audio element state.
- `disabled` is an optional parent-level override for cases such as unavailable application state.
- `className` is optional so the app can position the bar without requiring a styling system.
- The source URL, current track metadata, duration, and current time are deliberately outside this first control-only API.

## 4. Control behavior

| Control | Enabled when | Callback | Accessible name |
| --- | --- | --- | --- |
| Play | `status` is `idle`, `paused`, or `ended` and not globally disabled | `onPlay()` | `Play` |
| Pause | `status` is `playing` and not globally disabled | `onPause()` | `Pause` |
| Previous | `hasPrevious` and status is not `loading` and not globally disabled | `onPrevious()` | `Previous chapter` |
| Rewind | `canSeek` and status is not `loading` and not globally disabled | `onSeekRelative(-15)` | `Rewind 15 seconds` |
| Fast-forward | `canSeek` and status is not `loading` and not globally disabled | `onSeekRelative(15)` | `Forward 15 seconds` |
| Next | `hasNext` and status is not `loading` and not globally disabled | `onNext()` | `Next chapter` |

The previous and next labels may say “track” or “file” if the parent provides an accessible context, but the default component wording should use “chapter” because the app is a book player.

### Loading and error rules

- While `status === 'loading'`, every control is disabled. This prevents requests against a source whose state is changing.
- While `status === 'error'`, every control is disabled because the component cannot know which actions are recoverable. Recovery belongs to the parent.
- While `status === 'idle'`, play is enabled; seek and navigation follow their capability flags.
- While `status === 'ended'`, play is enabled so the parent can replay or start the next item according to application policy.
- `disabled === true` disables every control regardless of status or capability flags.
- Disabled controls must use the native `disabled` attribute and must not emit callbacks from mouse or keyboard interaction.

## 5. Rendering contract

The component should render:

- A semantic `<div>` or `<nav>` container with an accessible label such as `Audio playback controls`.
- One native `<button type="button">` per action.
- Exactly one play/pause button at a time, based on `status`.
- Stable button dimensions so changing from play to pause does not shift neighboring controls.
- Icons with visible or screen-reader-accessible labels. An icon alone is not sufficient accessible naming.

The first implementation should use the project's existing CSS approach and avoid introducing a component library solely for these controls. Icon assets may be selected during implementation, but the action must remain clear without relying on color alone.

## 6. Parent integration example

```tsx
function ReaderControls() {
  const [status, setStatus] = useState<PlaybackStatus>('paused')

  return (
    <AudioControlBar
      status={status}
      hasPrevious={currentIndex > 0}
      hasNext={currentIndex < queue.length - 1}
      canSeek={duration > 0}
      onPlay={() => audioElement.play()}
      onPause={() => audioElement.pause()}
      onPrevious={() => requestTrack(queue[currentIndex - 1])}
      onNext={() => requestTrack(queue[currentIndex + 1])}
      onSeekRelative={(offsetSeconds) => {
        audioElement.currentTime = Math.max(
          0,
          Math.min(duration, audioElement.currentTime + offsetSeconds),
        )
      }}
    />
  )
}
```

The example is illustrative: the parent is responsible for updating `status`, handling missing queue entries, and coordinating the audio element.

## 7. State matrix

| Status | Visible primary action | Navigation/seek behavior |
| --- | --- | --- |
| `idle` | Play | Capability flags determine availability |
| `loading` | No actionable control | All disabled |
| `playing` | Pause | Capability flags determine availability |
| `paused` | Play | Capability flags determine availability |
| `ended` | Play | Capability flags determine availability |
| `error` | No actionable control | All disabled |

## 8. Accessibility requirements

- Every button must have an accessible name that describes its action and amount where relevant.
- Buttons must be reachable and operable with a keyboard.
- Focus indicators must remain visible.
- Disabled buttons must be communicated through the native disabled state.
- Do not use color as the only indication of disabled, playing, or focused state.
- The play/pause control may expose `aria-pressed` only if it represents a toggle; its accessible name must still distinguish `Play` from `Pause`.
- The component should not announce every seek request itself. The parent may provide a live status message if the product later requires feedback such as “Skipped forward 15 seconds.”

## 9. Error and callback contract

Callbacks are user intent notifications and should be synchronous from the component's perspective. The component must not catch, retry, or translate errors from parent callbacks. If a callback can fail, the parent owns error handling and should update `status` or `disabled` accordingly.

## 10. Acceptance criteria

- A parent can fully control playback without the component receiving an audio element reference.
- Clicking Play invokes `onPlay` exactly once and does not invoke any other callback.
- Clicking Pause invokes `onPause` exactly once and does not invoke any other callback.
- Rewind invokes `onSeekRelative(-15)` exactly once.
- Fast-forward invokes `onSeekRelative(15)` exactly once.
- Previous and Next invoke only their corresponding callback when their capability flag is true.
- Previous and Next do not invoke callbacks when their capability flag is false.
- All controls are disabled during `loading` and `error` states.
- The primary control changes between Play and Pause according to `status`.
- Keyboard activation follows the same callback rules as pointer activation.
- The component has no queue-navigation logic and does not make assumptions about the queue's item type.

## 11. Out of scope for this version

- Volume and mute controls.
- A progress slider or absolute seek position.
- Playback speed.
- Queue display or track selection.
- Automatic next-track behavior.
- Media Session API integration.
- Persistence across application launches.
- Audio loading and retry UI.
