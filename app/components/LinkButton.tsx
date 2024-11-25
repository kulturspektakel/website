import type {ButtonProps, LinkProps} from '@chakra-ui/react';
import {Button, Link} from '@chakra-ui/react';
import {useNavigate} from '@remix-run/react';

export default function LinkButton({
  target,
  children,
  href,
  download,
  ...props
}: ButtonProps & LinkProps & {href: string}) {
  const navigate = useNavigate();
  const _hover = {
    bg: 'offwhite.300',
  };

  const isAbsolute = /^https?:\/\//.test(href);

  return (
    <Button
      role="link"
      _hover={_hover}
      _active={_hover}
      _focus={_hover}
      asChild
      {...props}
    >
      <Link
        href={href}
        download={download}
        onClick={(e) => {
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
