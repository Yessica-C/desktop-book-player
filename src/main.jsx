import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function HomePage() {
  const [backendStatus, setBackendStatus] = useState('Checking connection...');

  useEffect(() => {
    async function checkBackendHealth() {
      try {
        const response = await fetch(`${window.bookPlayer.backendUrl}/health`);

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const payload = await response.json();
        setBackendStatus(`Backend ${payload.status}`);
      } catch (error) {
        setBackendStatus(`Backend unavailable: ${error.message}`);
      }
    }

    void checkBackendHealth();
  }, []);

  return (
    <main className="home-page">
      <section className="welcome-panel">
        <p className="eyebrow">Your personal listening room</p>
        <h1>Welcome to Desktop Book Player</h1>
        <p className="intro">
          Pick up where you left off and settle into your next great story.
        </p>
        <button type="button" className="primary-button">Browse your library</button>
        <p className="status" aria-live="polite">{backendStatus}</p>
      </section>
      <aside className="listening-card">
        <span className="book-mark" aria-hidden="true">A</span>
        <p className="card-label">Ready when you are</p>
        <h2>Your library is waiting.</h2>
        <p>Add an audiobook to begin building your listening queue.</p>
      </aside>
    </main>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HomePage />
  </StrictMode>,
);
