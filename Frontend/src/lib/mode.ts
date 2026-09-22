// Everything the URL says, read once.
//
// Once, and not per render, because the first navigation inside the app drops
// the query string: read it later and it is already gone.
const params = new URLSearchParams(window.location.search);

// The app talks to the real server. `?fake` swaps in one that runs in this tab
// instead, with everyone on it invented — which is how these pages were built,
// and how they can be looked at with nothing running.
//
// Sticky for the tab, because the first navigation drops the query string and a
// refresh would otherwise land back on the real one. `?fake=0` leaves.
function askedForFake(): string | null {
    if (params.has('fake')) {
        return params.get('fake') ?? '';
    }
    // ?as= only means anything to the fake server, so it implies one
    if (params.has('as')) {
        return '';
    }
    return null;
}

function fakeMode() {
    const asked = askedForFake();
    try {
        if (asked !== null) {
            sessionStorage.setItem('lnc-fake', asked === '0' ? '' : '1');
        }
        return sessionStorage.getItem('lnc-fake') === '1';
    } catch {
        // a private window, or site data blocked: the flag just doesn't stick
        return asked !== null && asked !== '0';
    }
}

export const FAKE = fakeMode();

// The rest only mean anything with the fake server.
//
// `?as=meera3` joins before the page renders, `&demo` puts a private chat and a
// group already in progress (`&demo=group` opens the group instead), and
// `?settle` finishes the entrance animations and freezes the drift, which is
// what headless screenshots need.
export const JOIN_AS = params.get('as');
export const WANTS_DEMO = params.has('demo');
export const DEMO_OPEN = params.get('demo') ?? '';
export const SETTLE = params.has('settle');

// `?notice=...` has the server refuse something a moment after you arrive.
// Almost no refusal can be reached by clicking — the page checks the same rules
// before it sends anything — so this is the only way to look at one.
export const NOTICE = params.get('notice') ?? '';
