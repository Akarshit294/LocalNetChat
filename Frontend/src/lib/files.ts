// Small things about files that more than one place needs.

// "730 B", "48 KB", "4.2 MB": the size the way a person reads it
export function sizeOf(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Save a file from the server: a link with `download` on it, clicked. The
// browser's own download manager fetches it, cookie and all, and writes it
// straight to disk as it arrives, so the page never holds the bytes, however big.
export function startDownload(url: string, name: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
}

// Hand a file that's already in this tab to the browser to save, under the name
// it was shared as. Only the ?fake server needs this: its files never leave the tab.
//
// The bytes are already in this tab's memory, so they get a temporary blob:
// address, and a link with `download` on it saves whatever it points to. The
// address is let go a little later, so the memory can be freed.
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  // not straight away: some browsers, phones especially, start the save a
  // moment after the click, and need the address to still work when they do
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
