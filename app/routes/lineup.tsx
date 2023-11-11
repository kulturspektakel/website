import {gql, useSuspenseQuery} from '@apollo/client';
import {TriangleDownIcon} from '@chakra-ui/icons';
import {
  Box,
  Stack,
  Heading,
  MenuButton,
  Menu,
  MenuItem,
  MenuList,
  IconButton,
  Flex,
  Tooltip,
} from '@chakra-ui/react';
import {NavLink, Outlet, useParams} from '@remix-run/react';
import {$path} from 'remix-routes';
import Search from '~/components/lineup/Search';
import type {LineupsQuery} from '~/types/graphql';
import {LineupsDocument} from '~/types/graphql';

gql`
  query Lineups {
    events(type: Kulturspektakel) {
      name
      id
      start
      bandsPlaying {
        totalCount
      }
    }
  }
`;

export default function () {
  const params = useParams();
  return (
    <>
      <Stack
        direction={['column', 'row']}
        justifyContent="space-between"
        align={['start', 'center']}
      >
        <Flex alignItems="center" position="relative">
          {params.slug != null && (
            <Tooltip label={`Zum Lineup ${params.year}`} placement="top-start">
              <IconButton
                aria-label={`Zum Lineup ${params.year} zurückkehren`}
                as={NavLink}
                to={$path('/lineup/:year', {year: params.year})}
                icon={<TriangleDownIcon />}
                transform="rotate(90deg) translateY(120%)"
                size="xs"
                isRound={true}
                mt="0.5"
                position="absolute"
                left="0"
              />
            </Tooltip>
          )}
          <Heading as="h1" display="inline">
            Lineup
            {params?.year && <>&nbsp;{params.year}</>}
          </Heading>
          {params.slug == null && (
            <Menu placement="bottom-end" isLazy>
              <MenuButton
                size="xs"
                mt="0.5"
                ml="1.5"
                isRound
                as={IconButton}
                icon={<TriangleDownIcon />}
              >
                Actions
              </MenuButton>
              <MenuList>
                <MenuItems />
              </MenuList>
            </Menu>
          )}
        </Flex>
        <Search w={['100%', 'auto']} />
      </Stack>
      <Outlet />
    </>
  );
}

function MenuItems() {
  const {data} = useSuspenseQuery<LineupsQuery>(LineupsDocument, {});
  return (
    <>
      {data?.events
        .filter((e) => e.bandsPlaying.totalCount > 0)
        .map((e) => (
          <MenuItem
            as={NavLink}
            to={$path('/lineup/:year', {year: e.start.getFullYear()})}
            key={e.id}
          >
            {e.name}
          </MenuItem>
        ))}
    </>
  );
}
