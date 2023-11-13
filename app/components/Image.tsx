import type {ImageProps} from '@chakra-ui/react';
import {Image as ChakraImage} from '@chakra-ui/react';
import React, {useMemo} from 'react';

const Image = React.forwardRef(({onClick, ...props}: ImageProps, ref) => {
  const _focus = useMemo(
    () => ({transform: 'rotate(1deg) scale(1.03)', boxShadow: 'md'}),
    [],
  );

  const onClickProps = useMemo(() => {
    if (onClick == null) return undefined;
    return {
      onKeyDown: (e: React.KeyboardEventHandler<HTMLImageElement>) => {
        e?.key === 'Enter' && onClick(e);
      },
      tabIndex: 0,
      role: 'link',
      cursor: 'pointer',
      onClick,
    };
  }, [onClick]);

  return (
    <ChakraImage
      ref={ref}
      borderRadius="xl"
      transform="rotate(-1deg)"
      boxShadow="sm"
      transition="transform 0.1s ease-in-out, box-shadow 0.1s ease-in-out"
      _hover={_focus}
      _focus={_focus}
      _active={_focus}
      loading="lazy"
      outlineOffset={3}
      {...onClickProps}
      {...props}
    />
  );
});

Image.displayName = 'Image';

export default Image;
