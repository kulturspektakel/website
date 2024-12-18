import {gql} from '@apollo/client';
import {FaCircleInfo} from 'react-icons/fa6';
import {
  Separator,
  HStack,
  ListItem,
  ListRoot,
  Text,
  Box,
  useDisclosure,
  Icon,
  IconButton,
} from '@chakra-ui/react';
import {type FC} from 'react';
import type {
  ProductAdditives,
  ProductList,
  ProductListComponentFragment,
} from '~/types/graphql';
import {Tooltip} from '../chakra-snippets/tooltip';

gql`
  fragment ProductListComponent on ProductList {
    description
    product {
      additives {
        displayName
        id
      }
      name
      price
      requiresDeposit
    }
  }
`;

const TooltipContent: FC<{additives: ProductAdditives[]}> = ({additives}) => {
  return (
    <Box marginInlineStart={0}>
      {additives.map((additive: ProductAdditives) => (
        <Text key={additive.id} fontWeight={'normal'}>
          {additive.displayName}
        </Text>
      ))}
    </Box>
  );
};

export default function ProductList({
  productList,
}: {
  productList: ProductListComponentFragment;
}) {
  const showDepositText = productList.product.some(
    (item) => item.requiresDeposit,
  );
  const productListLength = productList.product.length;

  return (
    <>
      <ListRoot listStyleType="none" marginInlineStart={0}>
        {productList.product.map((item, index) => (
          <ListItem key={item.name}>
            <HStack justifyContent="space-between" py={1}>
              <Text>
                {item.name}
                <Info additives={item.additives} />
              </Text>
              <span>
                {item.requiresDeposit && <Text as="span">* </Text>}
                {new Intl.NumberFormat('de-DE', {
                  style: 'currency',
                  currency: 'EUR',
                }).format(item.price / 100)}
              </span>
            </HStack>
            {(showDepositText || index < productListLength - 1) && (
              <Separator />
            )}
          </ListItem>
        ))}
      </ListRoot>
      {showDepositText && (
        <>
          <Text textAlign="center" pt="1" fontSize="sm">
            * zuzüglich{' '}
            {new Intl.NumberFormat('de-DE', {
              style: 'currency',
              currency: 'EUR',
            }).format(2)}{' '}
            Pfand
          </Text>
        </>
      )}
    </>
  );
}

function Info({additives}: {additives: ProductAdditives[]}) {
  const {open, onOpen, onToggle, onClose} = useDisclosure();

  if (additives.length === 0) {
    return null;
  }

  return (
    <Tooltip
      content={<TooltipContent additives={additives} />}
      showArrow
      open={open}
    >
      <IconButton
        color="offwhite.300"
        ml="-0.5"
        mt="-2"
        mb="-1.5"
        variant="ghost"
        size="xs"
        _hover={{bg: 'transparent', color: 'brand.900'}}
        onMouseEnter={onOpen}
        onMouseLeave={onClose}
        onClick={onToggle}
      >
        <FaCircleInfo />
      </IconButton>
    </Tooltip>
  );
}
