async function checkBackendHealth() {
  const statusNode = document.getElementById('status');

  try {
    const response = await fetch(`${window.bookPlayer.backendUrl}/health`);

    if (!response.ok) {
      throw new Error(`Health check failed with status ${response.status}`);
    }

    const payload = await response.json();
    statusNode.textContent = `Backend status: ${payload.status}`;
  } catch (error) {
    statusNode.textContent = `Backend connection failed: ${error.message}`;
  }
}

void checkBackendHealth();
