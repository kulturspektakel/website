import {Box, Grid} from '@chakra-ui/react';
import {Tooltip} from '../chakra-snippets/tooltip';
import {
  STAGE_COLS,
  STAGE_ROWS,
  type StageValue,
  stageLabel,
} from './stageMatrixShared';

// Compact, non-interactive rendering of a stage assignment for the booking
// table. Renders nothing when unset; otherwise a small dots-only 3×5 grid with
// the selected cell filled, wrapped in a tooltip naming the slot + stage.
const CELL = '0.5rem';

export function StageMatrixReadonly({value}: {value: StageValue}) {
  if (!value) return null;
  return (
    <Tooltip content={stageLabel(value)} positioning={{placement: 'top'}} showArrow>
      <Grid
        templateColumns={`repeat(${STAGE_COLS.length}, ${CELL})`}
        w="fit-content"
        mx="auto"
        gap="0"
      >
        {STAGE_ROWS.map((_, ri) =>
          STAGE_COLS.map((__, ci) => {
            const isSelected = value.row === ri && value.col === ci;
            return (
              <Box
                key={`${ri}:${ci}`}
                boxSize={CELL}
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Box
                  boxSize={isSelected ? '1.5' : '0.5'}
                  borderRadius="full"
                  bg={isSelected ? 'blue.solid' : 'gray.300'}
                />
              </Box>
            );
          }),
        )}
      </Grid>
    </Tooltip>
  );
}
