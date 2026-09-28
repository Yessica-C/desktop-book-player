"""Domain objects for the user's audiobook library."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _file_key(filename: str) -> str:
    if not filename or not filename.strip():
        raise ValueError("filename must not be empty")

    return str(Path(filename).expanduser().resolve(strict=False))


@dataclass
class AudioBook:
    """Playback history and metadata for one audio file."""

    filename: str
    title: str | None = None
    current_time: float = 0.0
    last_played_time: float | None = None

    def __post_init__(self) -> None:
        self.filename = _file_key(self.filename)
        if self.title is None:
            self.title = Path(self.filename).stem
        self.set_current_time(self.current_time)

    def set_current_time(self, seconds: float) -> None:
        """Store the latest playback position for this audiobook."""
        if seconds < 0:
            raise ValueError("current time must not be negative")

        self.current_time = float(seconds)

    def mark_played(self, seconds: float | None = None) -> None:
        """Record a playback position and the time at which it was recorded."""
        if seconds is not None:
            self.set_current_time(seconds)

        self.last_played_time = datetime.now(timezone.utc).timestamp()

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable representation of this audiobook."""
        return {
            "filename": self.filename,
            "title": self.title,
            "current_time": self.current_time,
            "last_played_time": self.last_played_time,
        }


@dataclass
class Library:
    """The single collection of audiobooks known to the application."""

    audiobooks: dict[str, AudioBook] = field(default_factory=dict)

    def get_or_create(self, filename: str, title: str | None = None) -> AudioBook:
        """Return an existing audiobook or create it for a first-time selection."""
        key = _file_key(filename)
        audiobook = self.audiobooks.get(key)
        if audiobook is None:
            audiobook = AudioBook(filename=key, title=title)
            self.audiobooks[key] = audiobook
        elif title is not None and audiobook.title == Path(key).stem:
            audiobook.title = title

        return audiobook

    def get(self, filename: str) -> AudioBook | None:
        """Find an audiobook by filename without creating it."""
        return self.audiobooks.get(_file_key(filename))

    def to_dict(self) -> dict[str, dict[str, Any]]:
        """Return all audiobook data keyed by normalized filename."""
        return {filename: audiobook.to_dict() for filename, audiobook in self.audiobooks.items()}


library = Library()
    