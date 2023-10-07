import {cssVar, extendTheme} from '@chakra-ui/react';
import {StepsTheme as Steps} from 'chakra-ui-steps';

export default extendTheme({
  colors: {
    brand: {
      500: '#E12E2E',
      900: '#100A28',
    },
    red: {
      500: '#E12E2E',
    },
    offwhite: {
      100: '#f6f5f0',
      200: '#dbd8d3',
      300: '#d0cabc',
      400: '#b6b39f',
      500: '#9c9686',
      600: '#5a574e',
    },
  },
  fontWeights: {
    normal: 400,
    medium: 600,
    bold: 600,
  },
  fonts: {
    heading: "'Space Grotesk', sans-serif;",
    body: "'Space Grotesk', sans-serif;",
  },
  styles: {
    global: {
      html: {
        WebkitFontSmoothing: 'auto',
        fontSynthesis: 'none',
      },
      body: {
        bg: 'offwhite.100',
      },
      'h1,h2': {
        fontFamily: 'Shrimp !important',
        textTransform: 'uppercase',
        lineHeight: '0.95 !important',
      },
    },
  },
  components: {
    Steps,
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
    Tooltip: {
      baseStyle: {
        bg: 'brand.900',
        color: 'white',
        borderRadius: '0.5rem',
        paddingTop: 1,
        paddingBottom: 1,
        paddingLeft: 3,
        paddingRight: 3,
        [cssVar('popper-arrow-bg').variable]: 'colors.brand.900',
      },
    },
  },
});
