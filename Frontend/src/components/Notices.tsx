import { resolveValue, useToaster } from 'react-hot-toast/headless';

// Everything the server refused, shown wherever you happen to be standing.
//
// Headless on purpose: react-hot-toast keeps the queue and the dismiss timers,
// and we do all of the rendering. Nothing here inherits the library's styling,
// so the UI pass has nothing to undo.
//
// This is mounted by RealtimeProvider, above the routes. An error arrives on a
// socket that outlives the page, so the thing that reports it has to as well.
export default function Notices() {
    const { toasts, handlers } = useToaster();

    return (
        // hovering holds a message open, so a long reason isn't snatched away mid-read
        <div onMouseEnter={handlers.startPause} onMouseLeave={handlers.endPause}>
            {toasts
                .filter((notice) => notice.visible)
                .map((notice) => (
                    <p key={notice.id} role="alert">{resolveValue(notice.message, notice)}</p>
                ))}
        </div>
    );
}
