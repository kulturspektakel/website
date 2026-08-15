import {Box} from '@chakra-ui/react';
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuTrigger,
} from '../chakra-snippets/menu';

// What a swept range on a trace becomes: not a crop, but a question about the range.
//
// The sweep used to be its own answer — mouse up and the page's timeframe was already
// the band you had just drawn. One gesture, one meaning, and no way to add a second
// without inventing a modifier for it. So the sweep now only *names* a range, and this
// is what says what can be done with it. One entry today; everything a range will grow
// (marking it, exporting it, comparing two of them) belongs on this menu rather than on
// another chord over the same canvas.
//
// Mounted only while there is a selection, so `open` is a constant: the presence of the
// menu in the tree and the presence of a pending range are the same fact, and giving it
// an `open` prop as well would be two places to keep the one state.
export function SelectionMenu({
  at,
  onZoom,
  onClose,
}: {
  // Where the sweep ended, in the pixels of the box the chart is absolute in — the same
  // coordinates the tooltip is placed with (see cursorAnchor).
  at: {left: number; top: number};
  onZoom: () => void;
  onClose: () => void;
}) {
  return (
    <MenuRoot
      open
      onOpenChange={({open}) => {
        if (!open) onClose();
      }}
      // Down and to the right of the pointer, the way a menu opened by a click always
      // is: the band is above and to the left of where the sweep finished, so this is
      // the one corner that doesn't cover what the menu is about.
      positioning={{placement: 'bottom-start'}}
    >
      <MenuTrigger asChild>
        {/* The anchor, and nothing else: the thing that opened this menu is a drag
            across a canvas, which is not an element Chakra can position against. A
            zero-sized box left standing where the pointer came up is — and being
            pointer-transparent it doesn't take a pixel of the plot away from the next
            sweep. */}
        <Box
          position="absolute"
          left={`${at.left}px`}
          top={`${at.top}px`}
          w="1px"
          h="1px"
          pointerEvents="none"
        />
      </MenuTrigger>
      <MenuContent>
        <MenuItem value="zoom" onClick={onZoom}>
          Hineinzoomen
        </MenuItem>
      </MenuContent>
    </MenuRoot>
  );
}
