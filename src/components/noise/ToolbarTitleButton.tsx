import {forwardRef, type ReactNode} from 'react';
import {Box, Button, Spinner, type ButtonProps} from '@chakra-ui/react';
import {LuChevronDown} from 'react-icons/lu';

/**
 * The button a noise page's title is — the device page's monitor picker and the project
 * page's clock (see DevicePicker, PlayheadDisplay): each is the page's heading and the menu
 * that changes what the page is about, so the two are one control in two places.
 *
 * The dropdowns' own outline button at their size, so the strip's boxes are one kind of box
 * and one height; its contents, then a chevron saying it opens — or a spinner where the
 * chevron is, while the page waits on what was picked. Type fluid with the viewport: 13px on
 * a phone, where the strip is short of room, growing to 18px — the most the box's height
 * holds with room around it — from a laptop up, continuously rather than stepped at
 * breakpoints, so no width is the one where it jumps.
 *
 * Down to whatever the strip has left, and no further: it is the one thing in the strip that
 * can be abbreviated and still be read, so it shrinks (against the button recipe's own
 * `flex-shrink: 0`) and its contents are what give.
 *
 * A ref and the rest of the props passed through, because it is a menu's trigger by way of
 * `asChild`, which hands its handlers and ref to the child it is given.
 */
export const ToolbarTitleButton = forwardRef<
  HTMLButtonElement,
  ButtonProps & {children: ReactNode; pending?: boolean}
>(function ToolbarTitleButton({children, pending = false, ...rest}, ref) {
  return (
    <Button
      ref={ref}
      variant="outline"
      size="xs"
      ps="2.5"
      pe="1.5"
      gap="2"
      minW="0"
      maxW="full"
      flexShrink="1"
      fontSize="clamp(13px, 0.6rem + 1vw, 18px)"
      fontWeight="medium"
      cursor={pending ? 'progress' : undefined}
      disabled={pending}
      {...rest}
    >
      <Box minW="0" flex="1" display="flex" alignItems="center">
        {children}
      </Box>
      <Box display="flex" flexShrink="0" color="fg.muted">
        {pending ? <Spinner size="xs" /> : <LuChevronDown />}
      </Box>
    </Button>
  );
});
