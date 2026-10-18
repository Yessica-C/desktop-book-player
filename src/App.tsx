import { useState } from 'react'
import { AudioControlBar, type PlaybackStatus } from './components/audio-control-bar'
import './App.css'

function App() {
  const [status, setStatus] = useState<PlaybackStatus>('paused')
  const [currentTime, setCurrentTime] = useState(0)
  const duration = 300

  return (
    <>
      <h1>Desktop Book Player</h1>
      <div className="card">
        <p>Playback position: {currentTime} / {duration} seconds</p>
        <AudioControlBar
          canSeek={duration > 0}
          hasNext={false}
          hasPrevious={false}
          onNext={() => undefined}
          onPause={() => setStatus('paused')}
          onPlay={() => setStatus('playing')}
          onPrevious={() => undefined}
          onSeekRelative={(offsetSeconds) => {
            setCurrentTime((time) => Math.max(0, Math.min(duration, time + offsetSeconds)))
          }}
          status={status}
        />
      </div>
    </>
  )
}

export default App
