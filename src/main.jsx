import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function AudioControlBar() {
  const [activeAudio, setActiveAudio] = useState(null);
  const [audioState, setAudioState] = useState({
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    volume: 1,
  });

  useEffect(() => {
    const audioListeners = new Map();

    function refreshAudioElements() {
      const audioElements = [...document.querySelectorAll('audio')];

      audioElements.forEach((audio) => {
        if (audioListeners.has(audio)) {
          return;
        }

        const handlePlay = () => setActiveAudio(audio);
        const handleChange = () => {
          setAudioState({
            currentTime: audio.currentTime,
            duration: Number.isFinite(audio.duration) ? audio.duration : 0,
            isPlaying: !audio.paused,
            volume: audio.volume,
          });
        };

        audio.addEventListener('play', handlePlay);
        ['pause', 'ended', 'loadedmetadata', 'timeupdate', 'volumechange'].forEach((eventName) => {
          audio.addEventListener(eventName, handleChange);
        });
        audioListeners.set(audio, { handleChange, handlePlay });

        if (!activeAudio || !activeAudio.isConnected) {
          setActiveAudio(audio);
        }
      });

      audioListeners.forEach((listeners, audio) => {
        if (audio.isConnected) {
          return;
        }

        audio.removeEventListener('play', listeners.handlePlay);
        ['pause', 'ended', 'loadedmetadata', 'timeupdate', 'volumechange'].forEach((eventName) => {
          audio.removeEventListener(eventName, listeners.handleChange);
        });
        audioListeners.delete(audio);
      });
    }

    refreshAudioElements();
    const observer = new MutationObserver(refreshAudioElements);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      audioListeners.forEach((listeners, audio) => {
        audio.removeEventListener('play', listeners.handlePlay);
        ['pause', 'ended', 'loadedmetadata', 'timeupdate', 'volumechange'].forEach((eventName) => {
          audio.removeEventListener(eventName, listeners.handleChange);
        });
      });
    };
  }, [activeAudio]);

  useEffect(() => {
    if (!activeAudio) {
      return undefined;
    }

    const syncState = () => {
      setAudioState({
        currentTime: activeAudio.currentTime,
        duration: Number.isFinite(activeAudio.duration) ? activeAudio.duration : 0,
        isPlaying: !activeAudio.paused,
        volume: activeAudio.volume,
      });
    };

    syncState();
    return () => activeAudio.removeEventListener('timeupdate', syncState);
  }, [activeAudio]);

  function togglePlayback() {
    if (!activeAudio) {
      return;
    }

    if (activeAudio.paused) {
      void activeAudio.play();
    } else {
      activeAudio.pause();
    }
  }

  function skip(seconds) {
    if (activeAudio) {
      activeAudio.currentTime = Math.max(0, Math.min(activeAudio.duration || 0, activeAudio.currentTime + seconds));
    }
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) {
      return '0:00';
    }

    const hours = Math.floor(seconds / 3600);   
    if (hours > 0) {
      const remainingMinutes = Math.floor((seconds % 3600) / 60);
      const remainingSeconds = Math.floor(seconds % 60).toString().padStart(2, '0');
      return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds}`;
    }
    else
    {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.floor(seconds % 60).toString().padStart(2, '0');
      return `${minutes}:${remainingSeconds}`;
    }
  }

  const title = activeAudio?.dataset.title || activeAudio?.getAttribute('aria-label') || 'Nothing playing';
  const progress = audioState.duration ? (audioState.currentTime / audioState.duration) * 100 : 0;

  return (
    <nav className="audio-control-bar" aria-label="Audio playback controls">
      <div className="track-summary">
        <span className="track-icon" aria-hidden="true">♪</span>
        <div>
          <span className="track-kicker">Now listening</span>
          <strong>{title}</strong>
        </div>
      </div>
      <div className="transport-controls">
        <button type="button" className="icon-button" onClick={() => skip(-15)} disabled={!activeAudio} aria-label="Skip back 15 seconds">-15</button>
        <button type="button" className="play-button" onClick={togglePlayback} disabled={!activeAudio} aria-label={audioState.isPlaying ? 'Pause' : 'Play'}>
          {audioState.isPlaying ? '||' : '>'}
        </button>
        <button type="button" className="icon-button" onClick={() => skip(30)} disabled={!activeAudio} aria-label="Skip forward 30 seconds">+30</button>
      </div>
      <div className="progress-control">
        <span>{formatTime(audioState.currentTime)}</span>
        <input
          type="range"
          min="0"
          max={audioState.duration || 0}
          step="0.1"
          value={audioState.currentTime}
          onChange={(event) => {
            if (activeAudio) {
              activeAudio.currentTime = Number(event.target.value);
            }
          }}
          style={{ '--progress': `${progress}%` }}
          disabled={!activeAudio || !audioState.duration}
          aria-label="Playback progress"
        />
        <span>{formatTime(audioState.duration)}</span>
      </div>
      <label className="volume-control">
        <span aria-hidden="true">VOL</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={audioState.volume}
          onChange={(event) => {
            if (activeAudio) {
              activeAudio.volume = Number(event.target.value);
            }
          }}
          disabled={!activeAudio}
          aria-label="Volume"
        />
      </label>
    </nav>
  );
}

function HomePage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [selectedAudiobook, setSelectedAudiobook] = useState(null);
  const [audiobooks, setAudiobooks] = useState([]);
  const backendUrl = window.bookPlayer?.backendUrl;

  async function refreshAudiobooks() {
    const response = await fetch(`${backendUrl}/audiobooks`);

    if (!response.ok) {
      throw new Error(`Audiobook list failed with status ${response.status}`);
    }

    const payload = await response.json();
    setAudiobooks(payload.audiobooks);
  }

  useEffect(() => {
    void refreshAudiobooks().catch((error) => {
      console.error('Could not load audiobooks:', error);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  function playAudiobook(audiobook) {
    console.log(`Playing audiobook: ${audiobook.title}`);
    setSelectedAudiobook(audiobook);
    setSelectedFile({ name: audiobook.title });
    setAudioUrl(`${backendUrl}/audio?filename=${encodeURIComponent(audiobook.filename)}`);
    console.log(`Audio URL set to: ${backendUrl}/audio?filename=${encodeURIComponent(audiobook.filename)}`);
    }

  function handleAudioSelection(event) {
    const [file] = event.target.files;

    if (!file) {
      return;
    }

    const originalPath = window.bookPlayer?.getPathForFile?.(file) || file.path || file.name;
    setSelectedFile(file);
    setSelectedAudiobook(null);
    setAudioUrl(URL.createObjectURL(file));
    void fetch(`${backendUrl}/audiobooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: originalPath,
        title: file.name,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Audiobook registration failed with status ${response.status}`);
        }

        return refreshAudiobooks();
      })
      .catch((error) => {
        console.error('Could not register audiobook:', error);
      });
    event.target.value = '';
  }

  return (
    <>
      <main className="file-picker-page">
        <label className="file-picker">
          Import
          <input type="file" accept="audio/*,.m4b" onChange={handleAudioSelection} />
        </label>
        <section className="audiobook-list" aria-labelledby="audiobook-list-heading">
          <h1 id="audiobook-list-heading">Your audiobooks</h1>
          {audiobooks.length === 0 ? (
            <p>No audiobooks yet.</p>
          ) : (
            <ul>
              {audiobooks.map((audiobook) => (
                <li key={audiobook.filename}>
                  <button type="button" onClick={() => playAudiobook(audiobook)}>
                    {audiobook.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      {audioUrl && (
        <audio
          className="audio-source"
          src={audioUrl}
          data-title={selectedFile.name}
          aria-label={selectedFile.name}
          onLoadedMetadata={(event) => {
            if (selectedAudiobook) {
              event.currentTarget.currentTime = selectedAudiobook.current_time;
            }
          }}
          controls={false}
        />
      )}
      <AudioControlBar />
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HomePage />
  </StrictMode>,
);
