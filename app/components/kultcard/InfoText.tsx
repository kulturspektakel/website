import {Text, TextProps} from '@chakra-ui/react';

export default function InfoText({children, ...props}: TextProps) {
  return (
    <Text color="offwhite.500" fontSize="sm" {...props}>
      {children}
    </Text>
  );
}
