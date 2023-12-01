import type {ButtonProps, LinkProps} from '@chakra-ui/react';
import {Button} from '@chakra-ui/react';
import {useNavigate} from '@remix-run/react';

export default function LinkButton({
  target,
  ...props
}: ButtonProps & LinkProps & {href: string}) {
  const navigate = useNavigate();
  const _hover = {
    bg: 'offwhite.300',
  };

  const isAbsolute = /^https?:\/\//.test(props.href);

  return (
    <Button
      role="link"
      as="a"
      _hover={_hover}
      _active={_hover}
      _focus={_hover}
      onClick={(e) => {
        if (!isAbsolute && !props.download) {
          e.preventDefault();
          navigate(props.href);
        }
      }}
      target={isAbsolute ? '_blank' : undefined}
      {...props}
    />
  );
}
