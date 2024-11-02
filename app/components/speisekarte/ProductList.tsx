import {gql} from '@apollo/client';
import {InfoIcon} from '@chakra-ui/icons';
import type {PlacementWithLogical} from '@chakra-ui/react';
import {
  Separator,
  HStack,
  ListItem,
  Text,
  Tooltip,
  Box,
  useBreakpointValue,
  useDisclosure,
} from '@chakra-ui/react';
import {type FC} from 'react';
import type {
  ProductAdditives,
  ProductList,
  ProductListComponentFragment,
} from '~/types/graphql';

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
    <Box as="ul" listStyleType={'none'} marginInlineStart={0}>
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
      <Box as="ul" listStyleType="none" marginInlineStart={0}>
        {productList.product.map((item, index) => (
          <ListItem key={item.name}>
            <HStack justifyContent="space-between" py={1}>
              <Text>
                {item.name}
                <Info additives={item.additives} />
              </Text>
              <span>
                {item.requiresDeposit && (
                  <Text color="offwhite.500" as="span">
                    *{' '}
                  </Text>
                )}
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
      </Box>
      {showDepositText && (
        <>
          <Text textAlign="right" pt="1" color="offwhite.500">
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
  const {isOpen, onOpen, onToggle, onClose} = useDisclosure();
  const tooltipPlacement = useBreakpointValue<PlacementWithLogical>({
    base: 'top',
    lg: 'right',
    default: 'right',
  });

  if (additives.length === 0) {
    return null;
  }

  return (
    <Tooltip
      label={<TooltipContent additives={additives} />}
      hasArrow
      placement={tooltipPlacement!}
      isOpen={isOpen}
    >
      <InfoIcon
        color={'offwhite.300'}
        ml="1"
        mt="-1"
        onMouseEnter={onOpen}
        onMouseLeave={onClose}
        onClick={onToggle}
      />
    </Tooltip>
  );
}
