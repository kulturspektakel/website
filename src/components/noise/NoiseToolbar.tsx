import {Link} from '@tanstack/react-router';
import {type ReactNode} from 'react';
import {Box, HStack, Heading, IconButton, VStack} from '@chakra-ui/react';
import {LuArrowLeft} from 'react-icons/lu';

// One strip: the gutter it keeps, the rule under it, and the ground both are painted on.
// Applied to each of the two rather than described twice, which is the whole reason this
// component exists — retune it here and both follow.
const STRIP = {
  px: '4',
  py: '2',
  borderBottomWidth: '1px',
  borderColor: 'border',
} as const;

// The top of a noise page, shared by the two that have one: a project and a single
// monitor. Both are a thing you arrived at from the index and then set up a way of
// looking at, so both are a way back, a name, a line under it, and the controls that
// decide what the page below is showing.
//
// One component rather than two that resemble each other, because what is worth keeping
// identical is the chrome and not the contents: the strip's height, its rule, the ground
// it is painted on and the fact that it stays put while the page scrolls under it. The
// two pages disagree about every *item* in it and agree about all of that — which is the
// shape a slot takes, so the items are children and the frame is here.
//
// Sticky rather than fixed, and sticky to whatever scrolls — the area layout's box on
// both pages. A page one viewport tall would let the strip scroll away the moment a
// long list ran past it, so the pages grow instead (`flex: 1 0 auto`) and this stays.
export function NoiseToolbar({
  title,
  sub,
  children,
  below,
  back = true,
}: {
  // What the page is about, filling the strip's left half. A node and not a string
  // because the two pages differ in kind: a project *has* a name (see ToolbarTitle,
  // which is that name as the h1), while a monitor's name is also how you get to the
  // next monitor, so its title is a control (see DevicePicker).
  title: ReactNode;
  // The line under it, which is where the two pages differ most: a project says which
  // festival it is (its dates), a monitor says what state it is in (its dot, where it
  // stands, its battery). A node and not a string, because the second of those is a row
  // of badges.
  sub?: ReactNode;
  // The controls, hard against the right edge. Wrapping rather than squeezing: four of
  // them is more than a phone's width, and the heading beside them has already taken
  // what it needs.
  children?: ReactNode;
  // A second strip under the first, inside the same sticky box — the project page's
  // timeline. In here rather than stacked below by the caller, because a box of its own
  // would need this one's height as its `top`, and this one has no fixed height: its
  // controls wrap onto a second line at phone width. Given the same strip as the first,
  // so a caller passes contents and not chrome.
  below?: ReactNode;
  // The arrow back to the project list. On by default, because every page that has this
  // strip was arrived at from that list — except the list itself, which is the one place
  // the arrow would point at the page you are already on. So the destination opts out and
  // nobody else says anything.
  back?: boolean;
}) {
  return (
    <Box
      position="sticky"
      top="0"
      zIndex="2"
      flexShrink="0"
      // Opaque, because content passes underneath. Same ground as the layout, so the
      // strip reads as the top of the page rather than as a card over it — the rule
      // under it is what separates the two.
      bg="bg"
    >
      <HStack align="center" gap="3" {...STRIP}>
        {back && (
          <IconButton
            asChild
            aria-label="Back to the project list"
            variant="ghost"
            size="sm"
          >
            <Link to="/crew/noise">
              <LuArrowLeft />
            </Link>
          </IconButton>
        )}
        {/* The sub line's type is the toolbar's, not each caller's: one size and one
            muted grey, whether what sits in it is a date range or a row of chips. */}
        <VStack align="start" gap="0" flex="1" minW="0">
          {title}
          {sub && (
            <Box fontSize="xs" color="fg.subtle" w="full" minW="0">
              {sub}
            </Box>
          )}
        </VStack>
        <HStack gap="3" flexShrink="0" wrap="wrap" justify="flex-end">
          {children}
        </HStack>
      </HStack>
      {below && <Box {...STRIP}>{below}</Box>}
    </Box>
  );
}

// A page's name as its heading: the ordinary filling for the title slot above, and the
// one place its type is decided, so a page that has a name doesn't restate the size and
// the truncation to look like the other one. Sized to sit level with the controls beside
// it rather than to lead a document — a toolbar's title, however much it is also the h1.
export function ToolbarTitle({children}: {children: ReactNode}) {
  return (
    <Heading as="h1" size="md" truncate w="full" lineHeight="1.2">
      {children}
    </Heading>
  );
}
