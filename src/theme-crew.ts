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
        bg: {
          DEFAULT: {value: '{colors.gray.50}'},
          subtle: {value: '{colors.gray.100}'},
          muted: {value: '{colors.gray.100}'},
          emphasized: {value: '{colors.gray.200}'},
          inverted: {value: '{colors.gray.900}'},
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
      segmentGroup: {
        slots: ['root', 'item', 'indicator', 'label', 'itemText', 'itemControl'],
        base: {
          indicator: {bg: 'fg'},
          item: {
            _checked: {color: 'fg.inverted'},
            // SSR fallback (before the indicator mounts) must match too.
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
