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
  },
  globalCss: {
    html: {
      fontSmooth: 'auto',
      fontSynthesis: 'none',
    },
    body: {
      bg: 'offwhite.100',
    },
    'h1,h2,h3': {
      fontFamily: 'Shrimp !important',
      textTransform: 'uppercase',
      lineHeight: '0.95 !important',
    },
  },
  components: {
    Form: {
      baseStyle: {
        helperText: {
          color: 'offwhite.600',
        },
      },
    },
    Heading: {
      baseStyle: {
        color: 'brand.900',
      },
    },
    Button: {
      baseStyle: {
        bg: 'offwhite.200',
        _focusVisible: {
          outlineOffset: '3',
          outlineColor: 'blue.500',
          boxShadow: 'none',
        },
      },
      variants: {
        primary: {
          bg: 'brand.900',
          color: 'white',
          _hover: {
            _disabled: {
              bg: 'brand.900',
            },
          },
        },
      },
      defaultProps: {
        variant: 'base',
      },
    },
    Input: {
      defaultProps: {
        focusBorderColor: 'blue.500',
      },
      // baseStyle: {
      //   field: {
      //     // _focus: {
      //     //   bg: 'red.500',
      //     //   outlineOffset: '3',
      //     //   outlineColor: 'blue.500',
      //     //   boxShadow: 'none',
      //     },
      //   },
      // },
    },
    Tooltip: {
      baseStyle: {
        bg: 'brand.900',
        color: 'white',
        borderRadius: '0.5rem',
        paddingTop: 1,
        paddingBottom: 1,
        paddingLeft: 3,
        paddingRight: 3,
        // [cssVar('popper-arrow-bg').variable]: 'colors.brand.900',
      },
    },
    Separator: {
      baseStyle: {
        borderColor: 'offwhite.300',
      },
    },
    Link: {
      baseStyle: {
        _hover: {
          color: 'brand.500',
          textDecoration: 'none',
        },
        _focus: {
          color: 'brand.500',
          textDecoration: 'none',
        },
      },
      variants: {
        inline: {
          color: 'brand.500',
          _hover: {
            textDecoration: 'underline',
          },
          _focus: {
            textDecoration: 'underline',
          },
        },
      },
    },
  },
};

export default createSystem(defaultConfig, overrides);
