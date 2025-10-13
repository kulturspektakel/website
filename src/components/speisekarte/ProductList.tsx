import {FaCircleInfo} from 'react-icons/fa6';
import {
  Separator,
  HStack,
  ListItem,
  ListRoot,
  Text,
  Box,
  useDisclosure,
  IconButton,
} from '@chakra-ui/react';
import {type FC} from 'react';
import {Tooltip} from '../chakra-snippets/tooltip';

type ProductAdditive = {
  id: string;
  displayName: string;
};

const TooltipContent: FC<{
  additives: Array<ProductAdditive>;
}> = ({additives}) => {
  return (
    <Box marginInlineStart={0}>
      {additives.map((additive) => (
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
  productList: {
    description: string | null;
    product: {
      name: string;
      price: number;
      requiresDeposit: boolean;
      additives: Array<ProductAdditive>;
    }[];
  };
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

function Info({additives}: {additives: ProductAdditive[]}) {
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
