import {Link, LinkProps, useLayoutEffect} from '@tanstack/react-router';

import {
  Image,
  Flex,
  Text,
  Heading,
  Progress,
  Button,
  Link as ChakraLink,
  Card,
  Stack,
  ClientOnly,
} from '@chakra-ui/react';
import CountUp from 'react-countup';
import Mark from '../Mark';
import {useMemo, useState} from 'react';
import {EuroSign} from './EuroSign';

const GOAL = 1600000;

export function SpendenBox({
  total,
  donors,
  secondaryLabel,
  secondaryLinkProps,
}: {
  total: number;
  donors: number;
  secondaryLabel: React.ReactNode;
  secondaryLinkProps: LinkProps;
}) {
  const currency = useMemo(() => {
    return new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, []);

  const currencySign = useMemo(() => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }, []);

  const [amount, setAmount] = useState(0);
  useLayoutEffect(() => {
    setTimeout(() => {
      setAmount(total);
    }, 0);
  }, [setAmount]);

  const currencyFormat = currency.format(total / 100);

  return (
    <Card.Root variant="elevated" borderRadius="2xl" px={['2', '6']}>
      <Card.Header>
        <Heading textAlign="center" size={['xl', '3xl']} mt={['2', '5']}>
          <Text lineHeight="1.2">
            <Mark>
              <ClientOnly fallback="0,00">
                <Text
                  as="span"
                  textAlign="right"
                  w={
                    12 / 30 + //euro sign
                    (currencyFormat.replace(/[^0-9]/g, '').length * 18) / 30 +
                    4 / 30 +
                    (currencyFormat.length > 6 ? 4 / 30 : 0) +
                    'em'
                  }
                  display="inline-block"
                >
                  <CountUp
                    useEasing
                    start={0}
                    end={total}
                    duration={1.5}
                    formattingFn={(n) => currency.format(n / 100)}
                  />
                </Text>
              </ClientOnly>
              <EuroSign />
            </Mark>{' '}
            von {donors + 52}&nbsp;Unterstützer:innen
          </Text>
        </Heading>
      </Card.Header>
      <Card.Body pt={['2', '4']}>
        <Progress.Root
          animated
          max={GOAL}
          value={amount}
          shape="full"
          size="xl"
          my="5"
        >
          <Progress.Track>
            <Progress.Range transition="1.5s width ease-out" />
          </Progress.Track>
          <Progress.Label
            children={<>{currencySign.format(GOAL / 100)}</>}
            float="right"
          />
          <Progress.ValueText fontSize="sm" />
        </Progress.Root>

        <Flex flexDirection="column" alignItems="center" gap="2">
          <Stack
            direction={['column', 'row']}
            justifyContent="center"
            alignItems="center"
          >
            <ChakraLink href="https://donate.stripe.com/dR68z1cend47cBW000">
              <Button borderRadius="full" px="10" color="white">
                Jetzt Spenden
              </Button>
            </ChakraLink>
            <Link {...secondaryLinkProps}>
              <Button variant="subtle" borderRadius="full" px="10">
                {secondaryLabel}
              </Button>
            </Link>
          </Stack>
          <Image
            w="320px"
            src="https://files.kulturspektakel.de/ed5b4a69-5ad5-454a-9b8d-134d88ed6a15?width=640"
          />
          <Text textAlign="center">
            oder&nbsp;
            <ChakraLink asChild>
              <Link
                to="/$slug"
                params={{
                  slug: 'spenden',
                }}
                hash="spenden-per-uberweisung"
              >
                per Überweisung spenden
              </Link>
            </ChakraLink>
          </Text>
        </Flex>
      </Card.Body>
    </Card.Root>
  );
}
