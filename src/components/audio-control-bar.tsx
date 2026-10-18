import type { CSSProperties } from 'react'

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

const buttonStyle: CSSProperties = {
	alignItems: 'center',
	background: 'transparent',
	border: '1px solid currentColor',
	borderRadius: 4,
	cursor: 'pointer',
	display: 'inline-flex',
	font: 'inherit',
	height: 40,
	justifyContent: 'center',
	minWidth: 40,
	padding: '0 8px',
}

const buttonGroupStyle: CSSProperties = {
	alignItems: 'center',
	display: 'flex',
	gap: 8,
}

export function AudioControlBar({
	status,
	hasPrevious,
	hasNext,
	canSeek,
	onPlay,
	onPause,
	onPrevious,
	onNext,
	onSeekRelative,
	disabled = false,
	className,
}: AudioControlBarProps) {
	const isUnavailable = disabled || status === 'loading' || status === 'error'
	const isPlaying = status === 'playing'
	const playOrPauseDisabled =
		isUnavailable || (!isPlaying && status !== 'idle' && status !== 'paused' && status !== 'ended')

	return (
		<nav
			aria-busy={status === 'loading'}
			aria-label="Audio playback controls"
			className={className}
			style={buttonGroupStyle}
		>
			<button
				aria-label="Previous chapter"
				disabled={isUnavailable || !hasPrevious}
				onClick={onPrevious}
				style={buttonStyle}
				type="button"
			>
				<span aria-hidden="true">&lt;&lt;</span>
			</button>

			<button
				aria-label="Rewind 15 seconds"
				disabled={isUnavailable || !canSeek}
				onClick={() => onSeekRelative(-15)}
				style={buttonStyle}
				type="button"
			>
				<span aria-hidden="true">-15</span>
			</button>

			{isPlaying ? (
				<button
					aria-label="Pause"
					disabled={playOrPauseDisabled}
					onClick={onPause}
					style={buttonStyle}
					type="button"
				>
					<span aria-hidden="true">||</span>
				</button>
			) : (
				<button
					aria-label="Play"
					disabled={playOrPauseDisabled}
					onClick={onPlay}
					style={buttonStyle}
					type="button"
				>
					<span aria-hidden="true">&gt;</span>
				</button>
			)}

			<button
				aria-label="Forward 15 seconds"
				disabled={isUnavailable || !canSeek}
				onClick={() => onSeekRelative(15)}
				style={buttonStyle}
				type="button"
			>
				<span aria-hidden="true">+15</span>
			</button>

			<button
				aria-label="Next chapter"
				disabled={isUnavailable || !hasNext}
				onClick={onNext}
				style={buttonStyle}
				type="button"
			>
				<span aria-hidden="true">&gt;&gt;</span>
			</button>
		</nav>
	)
}
