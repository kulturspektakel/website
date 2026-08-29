import {
  createSystem,
  defaultConfig,
  defineRecipe,
  SystemConfig,
} from '@chakra-ui/react';
import {noiseColors, noiseSemanticColors} from './theme-noise';

const overrides: SystemConfig = {
  theme: {
    tokens: {
      colors: {
        // /crew/noise's accent scale. `brand` is deliberately absent: it
        // means the organisation's teal (see theme.ts), and this area's yellow
        // is a section accent rather than a second brand.
        ...noiseColors,
      },
      fonts: {
        // The crew area uses the system-default UI font (rather than the
        // marketing site's Space Grotesk) for a more native, legible feel.
        heading: {value: 'system-ui, sans-serif'},
        body: {value: 'system-ui, sans-serif'},
      },
    },
    semanticTokens: {
      colors: {
        // The `accent`, `chart.*` and `map.*` vocabulary of /crew/noise.
        // All new names rather than overrides, so they need no scoping — see
        // theme-noise.ts for why the section's two actual overrides (the page
        // ground just below, and the focus ring) are `_dark` values instead.
        ...noiseSemanticColors,
        // Nudges the light scale one step off pure white — but every entry has
        // to keep its `_dark` half. A flat value replaces Chakra's light/dark
        // pair outright, so a light grey would still be a light grey under
        // `.dark`; /crew/noise's page renders in a dark scope, and that is what
        // put near-white surfaces (`bg.muted`) under near-white text (`fg`).
        // Everything below the first entry differs only in its `_light` half.
        bg: {
          // The dark half is /crew/noise's ground, declared here rather than
          // asserted by the section's root. Pure black was only ever the default:
          // the wrapper painted itself gray.900 while html/body stayed black
          // behind it, which iOS shows you every time the page overscrolls. (The
          // page's scroll chain is contained now, so the two no longer have to
          // agree — see crew.noise.)
          DEFAULT: {
            value: {_light: '{colors.gray.50}', _dark: '{colors.gray.900}'},
          },
          subtle: {
            value: {_light: '{colors.gray.100}', _dark: '{colors.gray.950}'},
          },
          muted: {
            value: {_light: '{colors.gray.100}', _dark: '{colors.gray.900}'},
          },
          emphasized: {
            value: {_light: '{colors.gray.200}', _dark: '{colors.gray.800}'},
          },
          inverted: {
            value: {_light: '{colors.gray.900}', _dark: '{colors.white}'},
          },
        },
        // Focus rings/outlines are blue across the crew area. Components use the
        // (default) gray colorPalette, whose `focusRing` token drives
        // `--focus-ring-color`, so overriding it here recolors every focus ring.
        //
        // Dark is /crew/noise's page, where the ring is the section's accent
        // instead — blue against gray.900 is the ring you have to look for. Done
        // at the token rather than by hanging a `colorPalette` on that page's
        // root so that the pair travels with the colour mode rather than with the
        // DOM: the page's own controls get the accent ring, and the menus,
        // dialogs and toaster it opens — portalled to <body> and light — get the
        // blue one that belongs on a light surface.
        gray: {
          focusRing: {
            value: {
              _light: '{colors.blue.focusRing}',
              _dark: '{colors.accent.focusRing}',
            },
          },
        },
      },
    },
    recipes: {
      // A primary button is blue, across the whole crew area and in both appearances.
      //
      // On the variant rather than on `base`, because "primary" is what `solid` means —
      // an outline or a ghost button is the same action offered quietly, and tinting
      // those would make every secondary control in the area read as one more thing to
      // press. Unlike the links below this one does not turn on the noise page: a solid
      // button's legibility is its label against its own fill, not its fill against the
      // ground behind it, so the reason links go accent there does not apply.
      //
      // `colorPalette` and not `bg`/`color` outright, so that the whole of Chakra's solid
      // recipe — the hover, the expanded state, the contrast pair — keeps deciding how the
      // palette is used, and so that a button that names its own palette still wins:
      // style props are merged after recipe styles (see useResolvedProps), which is what
      // keeps the one `colorPalette="orange"` save button orange.
      button: defineRecipe({
        variants: {variant: {solid: {colorPalette: 'blue'}}},
      }),
      // Links are blue by default across the crew area, and the accent in
      // /crew/noise — blue.solid only just clears 5:1 against that section's
      // ground, and reads as a foreign colour next to everything else on the page.
      // `_dark` compiles to `.dark &, .dark .chakra-theme:not(.light) &`, so only
      // links inside that page turn; the ones in its dialogs and menus, which sit
      // outside the scope, stay blue.
      link: defineRecipe({
        base: {color: {base: 'blue.solid', _dark: 'accent.fg'}},
        variants: {
          variant: {
            plain: {color: {base: 'blue.solid', _dark: 'accent.fg'}},
            underline: {color: {base: 'blue.solid', _dark: 'accent.fg'}},
          },
        },
      }),
    },
    slotRecipes: {
      // Make the selected segment dark with light text so it's easy to spot.
      //
      // The dark background sits on the selected item itself, not on the
      // floating `indicator`. Chakra's default puts the two on different
      // elements: the text colour flips the moment `data-state` changes, while
      // the background is a separate box that *slides* into place. For the
      // length of that slide the selected label is light text on the light
      // track — invisible — and if the transition is interrupted (a route
      // change that mounts a map, say) it stays that way. Painting both in one
      // rule means they can never disagree. The indicator is then redundant, so
      // it's hidden rather than left to animate behind an opaque item.
      // A table's rows are the surface they sit on, not the page behind them.
      //
      // Chakra's `line` variant paints each row `bg`, which reads as "the default
      // background" — and for stock Chakra it is white, so the rule is invisible. Here
      // `bg` is the page ground (gray.50 light, gray.900 dark, just above), which made
      // every row a grey band across whatever panel it was in — a dialog, a card.
      //
      // `bg.panel` instead: the token the surfaces themselves use, so a row matches the
      // thing it is drawn on and follows it into a forced light or dark appearance. It has
      // to go on the variant rather than `base`, because a variant's styles win over base.
      table: {
        slots: [
          'root',
          'header',
          'body',
          'row',
          'columnHeader',
          'cell',
          'footer',
          'caption',
        ],
        variants: {
          variant: {
            line: {row: {bg: 'bg.panel'}},
          },
        },
      },
      segmentGroup: {
        slots: [
          'root',
          'item',
          'indicator',
          'label',
          'itemText',
          'itemControl',
        ],
        base: {
          // One step further than Chakra's `bg.muted`, which against this
          // theme's page `bg` is only a 2% step — the unselected half reads as
          // page background rather than as the other half of a control.
          root: {bg: 'bg.emphasized'},
          indicator: {display: 'none'},
          item: {
            _checked: {bg: 'fg', color: 'fg.inverted', shadow: 'sm'},
            // The pre-hydration rule is more specific than `_checked`, so it has
            // to repeat the same pair rather than inherit it.
            '&[data-state=checked][data-ssr]': {bg: 'fg', color: 'fg.inverted'},
          },
        },
      },
    },
  },
  globalCss: {
    'html, body': {
      bg: 'bg',
      color: 'fg',
    },
  },
};

export default createSystem(defaultConfig, overrides);
