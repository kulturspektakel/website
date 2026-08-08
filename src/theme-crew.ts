import {
  createSystem,
  defaultConfig,
  defineRecipe,
  SystemConfig,
} from '@chakra-ui/react';

const overrides: SystemConfig = {
  theme: {
    tokens: {
      colors: {
        brand: {
          500: {value: '#459388'},
          900: {value: '#003638'},
        },
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
        // Nudges the light scale one step off pure white — but every entry has
        // to keep its `_dark` half. A flat value replaces Chakra's light/dark
        // pair outright, so a light grey would still be a light grey under
        // `.dark`; /crew/lautstaerke renders inside <DarkMode>, and that is what
        // put near-white surfaces (`bg.muted`) under near-white text (`fg`).
        // Only the `_light` values differ from the defaults.
        bg: {
          DEFAULT: {
            value: {_light: '{colors.gray.50}', _dark: '{colors.black}'},
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
        gray: {
          focusRing: {value: '{colors.blue.focusRing}'},
        },
      },
    },
    recipes: {
      // Links are blue by default across the crew area.
      link: defineRecipe({
        base: {color: 'blue.solid'},
        variants: {
          variant: {
            plain: {color: 'blue.solid'},
            underline: {color: 'blue.solid'},
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
