// Streamer mode on a page is `?stream=1` in the address (as /play?stream=1). Read without useSearchParams, so
// the static page needs no Suspense boundary; the server renders "off" and the browser corrects it.
import { useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void) => {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
};
const read = () => new URLSearchParams(window.location.search).get('stream') === '1';

export function useStreamerMode(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
