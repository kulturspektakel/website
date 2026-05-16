import {createSystem, defaultConfig, SystemConfig} from '@chakra-ui/react';

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
        heading: {value: "'Space Grotesk', sans-serif"},
        body: {value: "'Space Grotesk', sans-serif"},
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
