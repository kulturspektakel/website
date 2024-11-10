import {FaTriangleExclamation} from 'react-icons/fa6';
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
  buttonLabel,
  applicationStart,
  applicationEnd,
  title,
  content,
}: {
  href: string;
  title: string;
  content: string;
  buttonLabel: string;
  applicationStart: Date;
  applicationEnd?: Date | null;
}) {
  const applicationEnded = applicationEnd ? applicationEnd < new Date() : false;
  const applicationNotStarted = applicationStart > new Date();
  const disabled = applicationEnded || applicationNotStarted;

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
          {applicationNotStarted ? (
            <strong>Bewerbungsphase hat noch nicht begonnen</strong>
          ) : (
            applicationEnd && (
              <>
                <strong>Bewerbungsschluss:</strong>{' '}
                {!applicationEnded ? (
                  <DateString date={applicationEnd} />
                ) : (
                  <Tag colorScheme="red">
                    <FaTriangleExclamation />
                    &nbsp;Abgelaufen
                  </Tag>
                )}
              </>
            )
          )}
        </Text>
      </VStack>
      <Spacer />
      <Button
        flexShrink={0}
        as={disabled ? undefined : Link}
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
