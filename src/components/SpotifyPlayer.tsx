import {useCallback, useEffect, useRef, useState} from 'react';

export type SpotifyPlayerStatus = 'idle' | 'loading' | 'playing';

export type SpotifyPlayerState = {
  activeUrl: string | null;
  status: SpotifyPlayerStatus;
  toggle: (url: string) => void;
};

export function useSpotifyPlayer(): SpotifyPlayerState {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<SpotifyPlayerStatus>('idle');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const audio = new Audio();
    audio.preload = 'none';
    audioRef.current = audio;

    const onPlaying = () => setStatus('playing');
    const onPause = () => setStatus('idle');
    const onEnded = () => {
      setStatus('idle');
      setActiveUrl(null);
    };
    const onError = () => setStatus('idle');

    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audioRef.current = null;
    };
  }, []);

  const toggle = useCallback(
    (url: string) => {
      const audio = audioRef.current;
      if (!audio) return;

      // Guard so an aborted play() from a previous track doesn't clobber
      // the loading state of the new one.
      const onPlayRejected = () => {
        if (audio.src === url) setStatus('idle');
      };

      if (activeUrl === url) {
        if (status === 'playing') {
          audio.pause();
        } else {
          setStatus('loading');
          audio.play().catch(onPlayRejected);
        }
        return;
      }

      audio.src = url;
      setActiveUrl(url);
      setStatus('loading');
      audio.play().catch(onPlayRejected);
    },
    [activeUrl, status],
  );

  return {activeUrl, status, toggle};
}
