import {WarningTwoIcon} from '@chakra-ui/icons';
import {
  Flex,
  VStack,
  Heading,
  Tag,
  Spacer,
  Button,
  Text,
} from '@chakra-ui/react';
import {Link} from '@remix-run/react';
import DateString from '../DateString';

export default function ApplicationPhase({
  href,
  disabled,
  buttonLabel,
  applicationStart,
  title,
  content,
}: {
  href: string;
  title: string;
  content: string;
  disabled: boolean;
  buttonLabel: string;
  applicationStart: Date;
}) {
  return (
    <Flex
      mt="5"
      alignItems="center"
      direction={{base: 'column', md: 'row'}}
      bg="white"
      borderRadius="lg"
      p="4"
      shadow="xs"
    >
      <VStack align="start" w="100%">
        <Heading size="md" textAlign="left">
          {title}
        </Heading>
        <Text>
          {content}
          <br />
          <strong>Bewerbungsschluss:</strong>{' '}
          {disabled ? (
            <Tag colorScheme="red">
              <WarningTwoIcon />
              &nbsp;Abgelaufen
            </Tag>
          ) : (
            <DateString date={applicationStart} />
          )}
        </Text>
      </VStack>
      <Spacer />
      <Button
        flexShrink={0}
        as={Link}
        to={href}
        mt="3"
        isDisabled={disabled}
        variant="primary"
      >
        {buttonLabel}
      </Button>
    </Flex>
  );
}
