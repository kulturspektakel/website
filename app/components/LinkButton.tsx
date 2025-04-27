import type {ButtonProps, LinkProps} from '@chakra-ui/react';
import {Button, Link} from '@chakra-ui/react';
import {
  RegisteredRouter,
  useNavigate,
  ValidateLinkOptions,
} from '@tanstack/react-router';

export default function LinkButton<
  TRouter extends RegisteredRouter = RegisteredRouter,
  TOptions = unknown,
>({
  target,
  children,
  href,
  download,
  ...props
}: ButtonProps & LinkProps & {href: ValidateLinkOptions<TRouter, TOptions>}) {
  const navigate = useNavigate();
  const isAbsolute = /^https?:\/\//.test(href);

  return (
    <Button role="link" variant="subtle" asChild {...props}>
      <Link
        _hover={{textDecoration: 'none'}}
        href={props.disabled ? undefined : href}
        download={download}
        onClick={(e) => {
          if (props.disabled) {
            return e.preventDefault();
          }
          if (!isAbsolute && !download) {
            e.preventDefault();
            navigate(href);
          }
        }}
        target={isAbsolute ? '_blank' : undefined}
      >
        {children}
      </Link>
    </Button>
  );
}
