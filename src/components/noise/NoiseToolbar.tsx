import {Link, useRouter} from '@tanstack/react-router';
import {useState, type ReactNode} from 'react';
import {Box, Collapsible, HStack, Heading, IconButton} from '@chakra-ui/react';
import {LuArrowLeft} from 'react-icons/lu';
import {stepsBackToOtherRoute} from '../../utils/historyRoutes';

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
  children,
  below,
  belowOpen = true,
  back = true,
  centerTitle = false,
}: {
  // What the page is about: leading the strip, or in its middle (see centerTitle). A node
  // and not a string because the pages differ in kind: the index *has* a name (see
  // ToolbarTitle, which is that name as the h1), a monitor's name is also how you get to the
  // next monitor (see DevicePicker), and a project's title is its clock (see
  // PlayheadDisplay).
  title: ReactNode;
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
  // Whether that strip is showing. A flag beside it rather than the caller passing
  // nothing, so that hiding it can be animated: the strip folds up from its own height,
  // and that needs its contents still there while it does.
  belowOpen?: boolean;
  // The arrow back to the page you came from — the project list, where that isn't known.
  // On by default, because every page that has this strip was arrived at from somewhere —
  // except the list itself, the top of the section, where there is nowhere further up to
  // go. So the list opts out and nobody else says anything.
  back?: boolean;
  // The title in the middle of the strip rather than leading it — the project page, whose
  // title is its clock. The strip's true middle, not the middle of what the arrow and the
  // controls leave: the two sides are flex columns of equal basis and equal growth, so they
  // come out the same width whatever is in them, and the title sits between them. On a
  // phone there is no room for three columns, so the arrow goes and the title leads the
  // strip from the left — the controls are what the width is needed for, and the way back
  // is the browser's own.
  centerTitle?: boolean;
}) {
  // Whether the strip below is mid-fold, which is the only time it may clip: the fold is a
  // height animation and needs `overflow: hidden` to be one, but the timeline's readouts
  // stand above its top edge, over this strip, and a settled strip that clipped would cut
  // them off. Off to begin with, since the first render of an open strip doesn't animate
  // and so never reports an end.
  const [folding, setFolding] = useState(false);
  const router = useRouter();
  // Back to the page you came from rather than always to the list: the nearest entry of the
  // tab's history on another route, which steps over the ones on this one — the project page
  // pushes one per crop, and the next monitor is the same page about another device (see
  // historyRoutes). A link all the same, to the
  // list, which is what it falls back to where the way here isn't known (a link opened
  // straight onto the page) and what a middle-click or a modified click still opens.
  const backArrow = back && (
    <IconButton asChild aria-label="Back" variant="ghost" size="sm">
      <Link
        to="/crew/noise"
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          const steps = stepsBackToOtherRoute(router);
          if (steps == null) return;
          e.preventDefault();
          router.history.go(steps);
        }}
      >
        <LuArrowLeft />
      </Link>
    </IconButton>
  );
  // Only the strip's own animations, not ones bubbling up from inside the timeline.
  const onFold =
    (running: boolean) =>
    (e: {target: EventTarget; currentTarget: EventTarget}) => {
      if (e.target === e.currentTarget) setFolding(running);
    };

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
        {/* Three slots either way, and only their flex differs. Centred, the two sides
            are columns of equal basis and equal growth, so they come out the same width
            whatever is in them and the title sits in the strip's true middle; on a phone
            the arrow's slot goes and the title leads from the left. Otherwise the title
            takes what the arrow and the controls leave. */}
        {(back || centerTitle) && (
          <Box
            flex={centerTitle ? '1 1 0' : 'none'}
            minW="0"
            hideBelow={centerTitle ? 'md' : undefined}
          >
            {backArrow}
          </Box>
        )}
        <Box flex={centerTitle ? 'none' : '1'} minW="0" maxW="full">
          {title}
        </Box>
        <HStack
          flex={centerTitle ? '1 1 0' : 'none'}
          minW="0"
          gap="3"
          wrap="wrap"
          justify="flex-end"
        >
          {children}
        </HStack>
      </HStack>
      {below && (
        // Mounted only while open or on its way closed: a strip nobody can see has no
        // business drawing a timeline.
        <Collapsible.Root open={belowOpen} lazyMount unmountOnExit>
          {/* The whole strip inside, gutter and rule too, so the fold takes the line
              under it with it rather than leaving it behind at height 0. */}
          <Collapsible.Content
            overflow={folding ? 'hidden' : 'visible'}
            onAnimationStart={onFold(true)}
            onAnimationEnd={onFold(false)}
          >
            <Box {...STRIP}>{below}</Box>
          </Collapsible.Content>
        </Collapsible.Root>
      )}
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
