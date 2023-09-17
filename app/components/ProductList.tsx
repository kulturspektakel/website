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
  UnorderedList,
} from '@chakra-ui/react';
import type { ProductList } from '~/types/graphql';

export default function ProductList({ productList }: { productList: ProductList }) {
  const showDepositText = productList.product.some(
    (item) => item.requiresDeposit,
  );
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
        <UnorderedList listStyleType={'none'}>
          {productList.product.map((item) => (
            <ListItem key={item.name}>
              <HStack justifyContent={'space-between'}>
                <span>{item.name}</span>
                <span>
                  {item.requiresDeposit && <span>* </span>}
                  {new Intl.NumberFormat('de-DE', {
                    style: 'currency',
                    currency: 'EUR',
                  }).format(item.price / 100)}
                </span>
              </HStack>
            </ListItem>
          ))}
        </UnorderedList>
        {showDepositText && (
          <>
            <Divider />
            <Text>
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
