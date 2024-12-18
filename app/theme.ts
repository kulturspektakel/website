import {
  createSystem,
  defaultConfig,
  defineRecipe,
  defineSlotRecipe,
  SystemConfig,
} from '@chakra-ui/react';

const overrides: SystemConfig = {
  theme: {
    slotRecipes: {
      nativeSelect: defineSlotRecipe({
        slots: ['root'],
        base: {
          root: {
            bg: 'white',
          },
        },
      }),
      segmentGroup: defineSlotRecipe({
        slots: ['root', 'item', 'indicator'],
        base: {
          root: {
            w: 'full',
            fontWeight: 'bold',
          },
          item: {
            flexGrow: 1,
            flexBasis: 0,
            justifyContent: 'center',
            '&[data-state=checked]': {
              bg: 'brand.900',
              color: 'white',
            },
            _before: {
              bg: 'offwhite.300',
            },
          },
          indicator: {
            color: 'white',
          },
        },
      }),
    },
    recipes: {
      input: defineRecipe({
        variants: {
          visual: {
            custom: {
              bg: 'white',
            },
          },
        },
        defaultVariants: {
          visual: 'custom',
        },
      }),
      textarea: defineRecipe({
        variants: {
          visual: {
            custom: {
              bg: 'white',
            },
          },
        },
        defaultVariants: {
          visual: 'custom',
        },
      }),
      link: defineRecipe({
        variants: {
          variant: {
            plain: {
              color: 'brand.500',
            },
          },
        },
      }),
    },
    tokens: {
      colors: {
        brand: {
          500: {value: '#E12E2E'},
          900: {value: '#100A28'},
        },
        red: {
          500: {value: '#E12E2E'},
        },
        offwhite: {
          100: {value: '#f6f5f0'},
          200: {value: '#dbd8d3'},
          300: {value: '#d0cabc'},
          400: {value: '#b6b39f'},
          500: {value: '#9c9686'},
          600: {value: '#5a574e'},
        },
        gray: {
          100: {value: '{colors.offwhite.100}'},
          200: {value: '{colors.offwhite.200}'},
          300: {value: '{colors.offwhite.300}'},
          400: {value: '{colors.offwhite.400}'},
          500: {value: '{colors.offwhite.500}'},
        },
      },
      fontWeights: {
        normal: {value: 400},
        medium: {value: 600},
        bold: {value: 600},
      },
      fonts: {
        heading: {value: "'Space Grotesk', sans-serif;"},
        body: {value: "'Space Grotesk', sans-serif;"},
      },
    },
    semanticTokens: {
      colors: {
        bg: {
          DEFAULT: {
            value: '{colors.offwhite.100}',
          },
          subtle: {
            value: '{colors.offwhite.200}',
          },
          muted: {
            value: '{colors.offwhite.200}',
          },
          emphasized: {
            value: '{colors.offwhite.300}',
          },
          inverted: {
            value: '{colors.brand.900}',
          },
        },
        fg: {
          muted: {
            value: '{colors.offwhite.600}',
          },
        },
        gray: {
          solid: {
            value: '{colors.brand.900}',
          },
          fg: {
            value: '{colors.brand.900}',
          },
          focusRing: {
            value: '{colors.brand.900}',
          },
        },
      },
      shadows: {
        inset: {value: 'inset 0 0 0 1px {colors.offwhite.300}'},
      },
    },
  },
  globalCss: {
    '*': {
      fontSmooth: 'auto',
      WebkitFontSmoothing: 'auto',
      fontSynthesis: 'none',
    },
    'h1,h2,h3': {
      fontFamily: 'Shrimp !important',
      textTransform: 'uppercase',
      lineHeight: '0.95 !important',
    },
  },
};

export default createSystem(defaultConfig, overrides);
