import {useCallback, useEffect, useRef, useState} from 'react';

type SpotifyController = {
  play: () => void;
  pause: () => void;
  resume: () => void;
  togglePlay: () => void;
  loadUri: (uri: string) => void;
  destroy: () => void;
  addListener: (
    event: 'playback_update' | 'ready',
    cb: (e: {data: {isPaused: boolean; isBuffering: boolean}}) => void,
  ) => void;
};

type SpotifyIFrameAPI = {
  createController: (
    element: HTMLElement,
    options: {uri: string; width?: string | number; height?: string | number},
    callback: (controller: SpotifyController) => void,
  ) => void;
};

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIFrameAPI) => void;
    __spotifyIframeApi?: SpotifyIFrameAPI;
  }
}

const SCRIPT_SRC = 'https://open.spotify.com/embed/iframe-api/v1';
// Spotify's createController requires a URI up front; we use this to warm the
// iframe and then loadUri() the real track on demand.
const PLACEHOLDER_TRACK_URI = 'spotify:track:4cOdK2wGLETKBW3PvgPWqT';

export type SpotifyPlayerState = {
  activeTrackId: string | null;
  isPlaying: boolean;
  loadingTrackId: string | null;
  toggle: (trackId: string) => void;
};

export function useSpotifyPlayer(): SpotifyPlayerState & {
  hostRef: React.RefObject<HTMLDivElement | null>;
} {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<SpotifyController | null>(null);
  const isReadyRef = useRef(false);
  const playOnReadyRef = useRef(false);
  const pendingTrackRef = useRef<string | null>(null);

  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !hostRef.current) return;
    const host = hostRef.current;

    const attach = (api: SpotifyIFrameAPI) => {
      if (controllerRef.current) return;
      // Spotify's createController replaces the element it's given with an
      // iframe. Hand it a throwaway child so our React-managed host stays put.
      const target = document.createElement('div');
      host.replaceChildren(target);
      api.createController(
        target,
        {uri: PLACEHOLDER_TRACK_URI, width: '300', height: '80'},
        (controller) => {
          controllerRef.current = controller;
          controller.addListener('ready', () => {
            isReadyRef.current = true;
            const pending = pendingTrackRef.current;
            if (pending) {
              pendingTrackRef.current = null;
              isReadyRef.current = false;
              controller.loadUri(`spotify:track:${pending}`);
              return;
            }
            if (playOnReadyRef.current) {
              playOnReadyRef.current = false;
              controller.play();
            }
          });
          controller.addListener('playback_update', (e) => {
            setIsPlaying(!e.data.isPaused);
            if (e.data.isPaused || !e.data.isBuffering) {
              setLoadingTrackId(null);
            }
          });
        },
      );
    };

    if (window.__spotifyIframeApi) {
      attach(window.__spotifyIframeApi);
    } else {
      window.onSpotifyIframeApiReady = (api) => {
        window.__spotifyIframeApi = api;
        attach(api);
      };
      if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
        const script = document.createElement('script');
        script.src = SCRIPT_SRC;
        script.async = true;
        document.body.appendChild(script);
      }
    }

    return () => {
      controllerRef.current?.destroy();
      controllerRef.current = null;
      isReadyRef.current = false;
      playOnReadyRef.current = false;
      pendingTrackRef.current = null;
    };
  }, []);

  const toggle = useCallback(
    (trackId: string) => {
      const controller = controllerRef.current;

      if (loadingTrackId === trackId) {
        playOnReadyRef.current = false;
        pendingTrackRef.current = null;
        controller?.pause();
        setLoadingTrackId(null);
        setIsPlaying(false);
        return;
      }

      if (!controller || !isReadyRef.current) {
        pendingTrackRef.current = trackId;
        playOnReadyRef.current = true;
        setActiveTrackId(trackId);
        setLoadingTrackId(trackId);
        return;
      }

      if (activeTrackId === trackId) {
        if (isPlaying) {
          controller.pause();
          setLoadingTrackId(null);
        } else {
          setLoadingTrackId(trackId);
          controller.resume();
        }
        return;
      }

      setActiveTrackId(trackId);
      setLoadingTrackId(trackId);
      isReadyRef.current = false;
      playOnReadyRef.current = true;
      controller.loadUri(`spotify:track:${trackId}`);
    },
    [activeTrackId, isPlaying, loadingTrackId],
  );

  return {activeTrackId, isPlaying, loadingTrackId, toggle, hostRef};
}

export function SpotifyPlayerHost({
  hostRef,
}: {
  hostRef: React.RefObject<HTMLDivElement | null>;
}) {
  // Must stay on-screen for browsers to keep the iframe active (off-screen
  // positioning can prevent the `ready` event and block audio autoplay).
  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        bottom: 0,
        right: 0,
        width: 0,
        height: 0,
        opacity: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: -1,
      }}
    />
  );
}
