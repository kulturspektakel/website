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
    <Button role="link" variant="subtle" disabled={disabled} {...props}>
      {disabled ? (
        children
      ) : (
        <Link
          href={linkOptions?.href}
          _hover={{textDecoration: 'none'}}
          {...linkOptions}
        >
          {children}
        </Link>
      )}
    </Button>
  );
}
