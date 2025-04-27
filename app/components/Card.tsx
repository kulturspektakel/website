import type {BoxProps} from '@chakra-ui/react';
import {Box} from '@chakra-ui/react';
import {
  Link,
  RegisteredRouter,
  ValidateLinkOptions,
} from '@tanstack/react-router';
import {forwardRef, useMemo} from 'react';

type Props<
  TRouter extends RegisteredRouter = RegisteredRouter,
  TOptions = unknown,
> = BoxProps & {
  link?: ValidateLinkOptions<TRouter, TOptions>;
};

const Card = forwardRef<HTMLDivElement, Props>(
  ({onClick, children, link, ...props}, ref) => {
    const _focus = useMemo(
      () => ({
        transform: 'rotate(1deg) scale(1.03)',
        boxShadow: 'md',
        outlineColor: 'brand.900',
      }),
      [],
    );

    const onClickProps = useMemo(() => {
      if (onClick == null) return undefined;
      const p: BoxProps = {
        onKeyDown: (e) => {
          if (e.code === 'Enter' || e.code === 'Space') {
            e.preventDefault();
            onClick(e as any); // casting KeyboardEvent to MouseEvent
          }
        },
        tabIndex: 0,
        role: 'link',
        cursor: 'pointer',
        onClick,
      };
      return p;
    }, [onClick]);

    return (
      <Box
        ref={ref}
        as={link == null ? 'div' : Link}
        asChild={!!link}
        bgColor="offwhite.300"
        borderRadius="xl"
        transform="rotate(-1deg)"
        boxShadow="sm"
        transition="transform 0.1s ease-in-out, box-shadow 0.1s ease-in-out"
        _hover={_focus}
        _focus={_focus}
        _active={_focus}
        outlineOffset={3}
        overflow="hidden"
        {...onClickProps}
        {...props}
      >
        {link != null ? <Link {...link}>{children}</Link> : children}
      </Box>
    );
  },
);

Card.displayName = 'Card';

export default Card;
