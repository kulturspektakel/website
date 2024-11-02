import {CheckIcon} from '@chakra-ui/icons';
import {Box, Flex, Stack, StackProps} from '@chakra-ui/react';
import {Fragment} from 'react';

export default function Steps({
  steps,
  currentStep,
  ...props
}: {steps: string[]; currentStep: number} & StackProps) {
  return (
    <Stack
      align={['flex-start', 'center']}
      direction={['column', 'row']}
      gap={['1', '3']}
      w="100%"
      {...props}
    >
      {steps.map((step, index) => {
        return (
          <Fragment key={index}>
            <Flex justifyContent="center" alignItems="center" fontWeight="bold">
              <Flex
                w="40px"
                h="40px"
                borderRadius="50%"
                justifyContent="center"
                alignItems="center"
                flexShrink={0}
                bg={index < currentStep ? 'brand.900' : 'offwhite.300'}
                color={index < currentStep ? 'white' : undefined}
                mr="3"
                borderWidth="2px"
                borderColor={
                  index <= currentStep ? 'brand.900' : 'offwhite.300'
                }
              >
                {index < currentStep ? <CheckIcon /> : index + 1}
              </Flex>
              {step}
            </Flex>
            {index < steps.length - 1 && (
              <Box
                flexGrow={1}
                ml={['19px', 'auto']}
                h={['10px', '2px']}
                w={['2px', 'auto']}
                bg={index < currentStep ? 'brand.900' : 'offwhite.300'}
              />
            )}
          </Fragment>
        );
      })}
    </Stack>
  );
}
