import {useEffect, useMemo, useRef, useState} from 'react';
import {Box, Input} from '@chakra-ui/react';
import {type useNavigate} from '@tanstack/react-router';
import {useVirtualizer} from '@tanstack/react-virtual';
import {GenreCategory} from '../../generated/prisma/browser';
import {normalizeBandName} from '../../utils/normalizeBandName';
import {BandName} from './BandName';
import {
  DialogBody,
  DialogContent,
  DialogRoot,
} from '../chakra-snippets/dialog';

// Only the fields needed to render + navigate; the booking table's richer Row
// is structurally assignable to this.
type SearchBand = {
  id: string;
  bandname: string;
  genre: string | null;
  genreCategory: GenreCategory;
  imageUrl: string | null;
};

// Cap the result list — beyond a handful, scrolling a search dropdown is
// slower than just typing a few more characters.
const MAX_RESULTS = 10;

// Lower rank sorts first: exact match, then prefix, then word-boundary, then
// any substring. Returns null when the query isn't found at all.
function rank(norm: string, query: string): number | null {
  const i = norm.indexOf(query);
  if (i === -1) return null;
  if (norm === query) return 0;
  if (i === 0) return 1;
  if (norm[i - 1] === ' ') return 2;
  return 3;
}

/**
 * Cmd+F (Ctrl+F) command palette to jump to a band's detail modal. Searches the
 * already-loaded band list client-side with diacritic/punctuation-folding
 * substring matching, and renders matches in a virtualized list so even the
 * empty-query "all bands" view stays fast.
 */
export function BandSearch({
  bands,
  eventId,
  navigate,
}: {
  bands: SearchBand[];
  eventId: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Global shortcut. Registered in an effect so `document` is only touched in
  // the browser (SSR-safe).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Normalise every band name once; the costly NFD/regex work never runs per
  // keystroke.
  const index = useMemo(
    () => bands.map((band) => ({band, norm: normalizeBandName(band.bandname)})),
    [bands],
  );

  const results = useMemo(() => {
    const q = normalizeBandName(query);
    if (!q) return [];
    const scored: {band: SearchBand; r: number}[] = [];
    for (const {band, norm} of index) {
      const r = rank(norm, q);
      if (r !== null) scored.push({band, r});
    }
    scored.sort(
      (a, b) => a.r - b.r || a.band.bandname.localeCompare(b.band.bandname, 'de'),
    );
    return scored.slice(0, MAX_RESULTS).map((s) => s.band);
  }, [query, index]);

  const virtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 56,
    overscan: 12,
  });

  // Reset highlight + scroll to top whenever the result set changes.
  useEffect(() => {
    setHighlightedIndex(0);
    scrollRef.current?.scrollTo({top: 0});
  }, [query]);

  // Keep the highlighted row visible during keyboard navigation.
  useEffect(() => {
    if (open) virtualizer.scrollToIndex(highlightedIndex);
  }, [highlightedIndex, open, virtualizer]);

  const select = (band: SearchBand | undefined) => {
    if (!band) return;
    setOpen(false);
    setQuery('');
    navigate({
      to: '/crew/booking/$eventId/$applicationId',
      params: {eventId, applicationId: band.id},
    });
  };

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(results[highlightedIndex]);
    }
  };

  return (
    <DialogRoot
      open={open}
      onOpenChange={(e) => {
        setOpen(e.open);
        if (!e.open) setQuery('');
      }}
      placement="top"
      size="lg"
      scrollBehavior="inside"
      initialFocusEl={() => inputRef.current}
    >
      <DialogContent mt="20" overflow="hidden">
        <DialogBody p="0">
          <Input
            ref={inputRef}
            placeholder="Band suchen…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            size="lg"
            border="none"
            borderRadius="0"
            _focusVisible={{outline: 'none', boxShadow: 'none'}}
          />
          <Box
            ref={scrollRef}
            maxH="60vh"
            overflowY="auto"
            borderTopWidth="1px"
            display={results.length === 0 ? 'none' : undefined}
          >
            <Box position="relative" h={`${virtualizer.getTotalSize()}px`}>
              {virtualizer.getVirtualItems().map((vItem) => {
                const band = results[vItem.index];
                const active = vItem.index === highlightedIndex;
                return (
                  <Box
                    key={band.id}
                    data-index={vItem.index}
                    ref={virtualizer.measureElement}
                    position="absolute"
                    top="0"
                    left="0"
                    w="full"
                    transform={`translateY(${vItem.start}px)`}
                    px="3"
                    py="2"
                    cursor="pointer"
                    bg={active ? 'bg.muted' : undefined}
                    onMouseMove={() => setHighlightedIndex(vItem.index)}
                    onClick={() => select(band)}
                  >
                    <BandName
                      bandname={band.bandname}
                      genre={band.genre}
                      genreCategory={band.genreCategory}
                      imageUrl={band.imageUrl}
                    />
                  </Box>
                );
              })}
            </Box>
          </Box>
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
}
