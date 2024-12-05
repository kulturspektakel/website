import {FaTriangleExclamation} from 'react-icons/fa6';
import {Flex, VStack, Heading, Spacer, Text} from '@chakra-ui/react';
import {Link} from '@remix-run/react';
import DateString from '../DateString';
import {Button} from '../chakra-snippets/button';
import {Tag} from '../chakra-snippets/tag';

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
                  <Tag
                    colorScheme="red"
                    startElement={<FaTriangleExclamation />}
                  >
                    Abgelaufen
                  </Tag>
                )}
              </>
            )
          )}
        </Text>
      </VStack>
      <Spacer />
      <Button
        asChild
        flexShrink={0}
        as={disabled ? undefined : Link}
        mt="3"
        disabled={disabled}
      >
        <Link to={href}>{buttonLabel}</Link>
      </Button>
    </Flex>
  );
}
