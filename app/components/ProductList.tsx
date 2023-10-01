import {InfoIcon} from '@chakra-ui/icons';
import {
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Divider,
  HStack,
  Heading,
  ListItem,
  Text,
  Tooltip,
  UnorderedList,
  useBreakpointValue,
} from '@chakra-ui/react';
import type {FC} from 'react';
import type {ProductAdditives, ProductList} from '~/types/graphql';

const TooltipContent: FC<{additives: ProductAdditives[]}> = ({additives}) => {
  return (
    <UnorderedList listStyleType={'none'} marginInlineStart={0} padding={1}>
      {additives.map((additive: ProductAdditives) => (
        <Text key={additive.id} fontWeight={'normal'}>
          {additive.displayName}
        </Text>
      ))}
    </UnorderedList>
  );
};

export default function ProductList({productList}: {productList: ProductList}) {
  const showDepositText = productList.product.some(
    (item) => item.requiresDeposit,
  );
  const productListLength = productList.product.length;
  const tooltipPlacement = useBreakpointValue({base: 'top', lg: 'right', default: 'right'});

  return (
    <AccordionItem>
      <Heading>
        <AccordionButton textTransform={'inherit'}>
          <Box as="span" flex="1" textAlign="left">
            {productList.emoji} {productList.name}
          </Box>
          <AccordionIcon />
        </AccordionButton>
      </Heading>
      <AccordionPanel pb={4}>
        <UnorderedList listStyleType={'none'} marginInlineStart={0}>
          {productList.product.map((item, index) => (
            <ListItem key={item.name}>
              <HStack justifyContent={'space-between'} paddingY={1}>
                <Text>
                  {item.name}
                  {item.additives.length > 0 && (
                    <Tooltip
                      label={<TooltipContent additives={item.additives} />}
                      hasArrow
                      placement={tooltipPlacement}
                    >
                      <InfoIcon color={'offwhite.300'} marginLeft={1} />  
                    </Tooltip>
                  )}
                </Text>
                <span>
                  {item.requiresDeposit && (
                    <Text color={'offwhite.500'} as={'span'}>
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
                <Divider />
              )}
            </ListItem>
          ))}
        </UnorderedList>
        {showDepositText && (
          <>
            <Text textAlign={'right'} paddingTop={1} color={'offwhite.500'}>
              * zuzüglich{' '}
              {new Intl.NumberFormat('de-DE', {
                style: 'currency',
                currency: 'EUR',
              }).format(2)}{' '}
              Pfand
            </Text>
          </>
        )}
      </AccordionPanel>
    </AccordionItem>
  );
}
