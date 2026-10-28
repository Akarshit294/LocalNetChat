// Light, dark, or whatever the device says.
//
// The choice lives on <html> as data-scheme="light" or "dark", which is what
// GlobalStyle reads. "system" is no attribute at all. It is remembered by this
// browser only: another phone on the same wi-fi keeps its own.
//
// index.html puts a saved choice on <html> before anything is drawn, so a page
// set to dark never loads light first. It reads the same key as this file.
export type Scheme = 'system' | 'light' | 'dark';

const KEY = 'lnc-scheme';

export function currentScheme(): Scheme {
  const scheme = document.documentElement.dataset.scheme;
  return scheme === 'light' || scheme === 'dark' ? scheme : 'system';
}

export function chooseScheme(scheme: Scheme) {
  const root = document.documentElement;
  if (scheme === 'system') {
    delete root.dataset.scheme;
  } else {
    root.dataset.scheme = scheme;
  }

  try {
    if (scheme === 'system') {
      localStorage.removeItem(KEY);
    } else {
      localStorage.setItem(KEY, scheme);
    }
  } catch {
    // a private window, or site data blocked: the choice lasts until a reload
  }
}
