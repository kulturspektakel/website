import type {BoxProps} from '@chakra-ui/react';
import {Box, Heading, Link as ChakraLink} from '@chakra-ui/react';
import React from 'react';
import Mark from './Mark';
import {Link, useLocation} from '@remix-run/react';

export default function Headline({
  children,
  href,
  mark,
  ...props
}: {
  children: string;
  href?: string;
  mark?: React.ReactNode;
} & BoxProps) {
  const {pathname} = useLocation();
  href = href === pathname ? undefined : href;

  return (
    <Box textAlign={href ? undefined : 'center'} {...props}>
      <Heading size={[href ? '2xl' : '3xl']} mb="1" as={href ? 'h2' : 'h1'}>
        {href ? (
          <ChakraLink asChild>
            <Link to={href}>{children}</Link>
          </ChakraLink>
        ) : (
          children
        )}
      </Heading>
      {mark && <Mark fontSize="md">{mark}</Mark>}
    </Box>
  );
}
