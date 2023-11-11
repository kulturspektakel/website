import React from 'react';
import type {TextProps} from '@chakra-ui/react';
import {Text} from '@chakra-ui/react';
import hexRgb from 'hex-rgb';

export default function Mark({
  children,
  bgColor,
  ...props
}: {children: React.ReactNode} & TextProps) {
  const {red, green, blue} = bgColor
    ? hexRgb(String(bgColor))
    : {
        red: 255,
        green: 215,
        blue: 75,
      };
  return (
    <Text
      as="mark"
      fontWeight="semibold"
      color="inherit"
      {...props}
      m="0 -0.4em"
      p="0.1em 0.4em"
      borderRadius="0.8em 0.3em"
      bgColor="transparent"
      whiteSpace="nowrap"
      boxDecorationBreak="clone"
      bgImage={`linear-gradient(
        to right,
        rgba(${red}, ${green}, ${blue}, 0.5),
        rgba(${red}, ${green}, ${blue}, 1) 4%,
        rgba(${red}, ${green}, ${blue}, 0.6)
      )`}
    >
      {children}
    </Text>
  );
}
