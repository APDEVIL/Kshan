/**
 * Page-wide background: soft drifting colour blobs, a dotted grid, and a glow that follows the mouse.
 * Pure CSS (no canvas), so it is light on the GPU. The mouse position comes from CursorSpotlight,
 * which writes --pointer-x / --pointer-y on <html>.
 */
export function BackgroundBlobs() {
	return (
		<div
			aria-hidden
			className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
		>
			<div className="k-pointer-glow" />
			<div className="k-blob k-blob-a" />
			<div className="k-blob k-blob-b" />
			<div className="k-blob k-blob-c" />
			<div className="k-dots" />
		</div>
	);
}
