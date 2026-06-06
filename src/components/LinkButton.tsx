import type {ButtonProps} from '@chakra-ui/react';
import {Button} from '@chakra-ui/react';
import {
  RegisteredRouter,
  ValidateLinkOptions,
  Link,
} from '@tanstack/react-router';

type Props<
  TRouter extends RegisteredRouter = RegisteredRouter,
  TOptions = unknown,
> = {
  linkOptions: ValidateLinkOptions<TRouter, TOptions>;
  download?: string;
  target?: string;
} & ButtonProps;

export default function LinkButton<TRouter extends RegisteredRouter, TOptions>({
  linkOptions,
  children,
  disabled,
  ...props
}: Props<TRouter, TOptions>) {
  return (
    // `asChild` merges the button styles onto the Link so the rendered anchor
    // is the single focusable element (no nested <a> inside <button>). When
    // disabled we render a plain <button> with no navigable link.
    <Button
      role="link"
      variant="subtle"
      disabled={disabled}
      asChild={!disabled}
      // Set on the Button (Chakra) rather than the TanStack Link, so it compiles
      // to CSS instead of leaking as an `_hover` DOM attribute on the anchor.
      _hover={{textDecoration: 'none'}}
      {...props}
    >
      {disabled ? children : <Link {...linkOptions}>{children}</Link>}
    </Button>
  );
}
