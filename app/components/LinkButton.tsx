import type {ButtonProps, LinkProps} from '@chakra-ui/react';
import {Button, Link} from '@chakra-ui/react';
import {
  RegisteredRouter,
  useNavigate,
  ValidateLinkOptions,
} from '@tanstack/react-router';

type BaseLinkButtonProps = Omit<ButtonProps & LinkProps, 'href'> & {
  target?: string;
  children: React.ReactNode;
  download?: boolean;
};

type HrefProps = BaseLinkButtonProps & {
  href: string;
  linkProps?: never;
};

type LinkPropsVariant<
  TRouter extends RegisteredRouter = RegisteredRouter,
  TOptions = unknown,
> = BaseLinkButtonProps & {
  href?: never;
  linkProps: ValidateLinkOptions<TRouter, TOptions>;
};

export default function LinkButton<
  TRouter extends RegisteredRouter = RegisteredRouter,
  TOptions = unknown,
>({
  target,
  children,
  href,
  download,
  linkProps,
  ...props
}: HrefProps | LinkPropsVariant<TRouter, TOptions>) {
  const navigate = useNavigate();

  return (
    <Button role="link" variant="subtle" asChild {...props}>
      <Link
        _hover={{textDecoration: 'none'}}
        href={props.disabled ? undefined : href}
        download={download}
        onClick={(e) => {
          if (!linkProps) {
            return
          }
          if (props.disabled) {
            return e.preventDefault();
          }
          e.preventDefault();
          navigate(linkProps);
        }}
        target={href ? '_blank' : undefined}
      >
        {children}
      </Link>
    </Button>
  );
}
