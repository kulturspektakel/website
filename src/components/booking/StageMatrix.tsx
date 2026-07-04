import {Box, Flex, Grid, Text} from '@chakra-ui/react';
import {
  STAGE_CELL,
  STAGE_COLS,
  STAGE_ROWS,
  type StageCell,
  type StageValue,
  colLabel,
} from './stageMatrixShared';

type StageMatrixProps =
  | {multiple?: false; value: StageValue; onChange: (next: StageValue) => void}
  | {multiple: true; value: StageCell[]; onChange: (next: StageCell[]) => void};

// Interactive stage-assignment grid (mouse-only). Click a cell to select it.
//
// Single mode (detail dialog): one cell selected; clicking the selected cell
// clears it. Multi mode (table filter dropdown): any number of cells selected;
// clicking toggles a cell in/out. Selection is controlled via `value`/`onChange`.
export function StageMatrix(props: StageMatrixProps) {
  const selectedKeys = new Set(
    props.multiple
      ? props.value.map((c) => `${c.row}:${c.col}`)
      : props.value
        ? [`${props.value.row}:${props.value.col}`]
        : [],
  );

  const toggle = (r: number, c: number) => {
    if (props.multiple) {
      const exists = props.value.some((cell) => cell.row === r && cell.col === c);
      props.onChange(
        exists
          ? props.value.filter((cell) => !(cell.row === r && cell.col === c))
          : [...props.value, {row: r, col: c}],
      );
    } else {
      const selected = props.value?.row === r && props.value?.col === c;
      props.onChange(selected ? null : {row: r, col: c});
    }
  };

  return (
    // Outer 2×2 layout: (0,0) empty · (0,1) column legend · (1,0) row legend ·
    // (1,1) the dot grid. Legends live here (flex) instead of inside the grid.
    <Grid templateColumns="auto auto" w="fit-content" columnGap="2" rowGap="1">
      {/* (0,0) empty corner */}
      <Box />

      {/* (0,1) column legend — one slot per grid column (empty slots sit over
          the "between" columns). Confining each label to a single column width
          lets the soft hyphens wrap Kult/Waldbühne automatically. Pinned to the
          grid's width so the labels can't widen the shared column. */}
      <Flex aria-hidden w={`calc(${STAGE_CELL} * 5)`}>
        {STAGE_COLS.map((label, i) => (
          <Text
            key={i}
            flex="1"
            minW="0"
            textAlign="center"
            fontSize="xs"
            fontWeight="medium"
            color="fg.muted"
            lineHeight="1.2"
          >
            {label}
          </Text>
        ))}
      </Flex>

      {/* (1,0) row legend — right-aligned against the grid. */}
      <Flex direction="column" align="stretch" aria-hidden>
        {STAGE_ROWS.map((row, ri) => (
          <Flex key={ri} h={STAGE_CELL} align="center" pr="2">
            <Text
              w="full"
              textAlign="right"
              fontSize="xs"
              color="fg.muted"
              whiteSpace="nowrap"
            >
              {row.label}
            </Text>
          </Flex>
        ))}
      </Flex>

      {/* (1,1) the dot grid */}
      <Grid
        role="grid"
        aria-label="Bühne und Slot"
        templateColumns={`repeat(5, ${STAGE_CELL})`}
        gap="0"
        borderRadius="md"
      >
        {STAGE_ROWS.map((row, ri) => (
          <Box key={ri} role="row" display="contents">
            {STAGE_COLS.map((_, ci) => {
              const isSelected = selectedKeys.has(`${ri}:${ci}`);
              // Boundary edges form a single border around the whole cell block.
              const firstRow = ri === 0;
              const lastRow = ri === STAGE_ROWS.length - 1;
              const firstCol = ci === 0;
              const lastCol = ci === STAGE_COLS.length - 1;
              return (
                <Flex
                  key={ci}
                  className="group"
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-label={`${row.aria}, ${colLabel(ci)}`}
                  justify="center"
                  align="center"
                  boxSize={STAGE_CELL}
                  cursor="pointer"
                  borderColor="border"
                  borderTopWidth={firstRow ? '1px' : undefined}
                  borderBottomWidth={lastRow ? '1px' : undefined}
                  borderLeftWidth={firstCol ? '1px' : undefined}
                  borderRightWidth={lastCol ? '1px' : undefined}
                  borderTopLeftRadius={firstRow && firstCol ? 'md' : undefined}
                  borderTopRightRadius={firstRow && lastCol ? 'md' : undefined}
                  borderBottomLeftRadius={lastRow && firstCol ? 'md' : undefined}
                  borderBottomRightRadius={lastRow && lastCol ? 'md' : undefined}
                  onClick={() => toggle(ri, ci)}
                >
                  <Box
                    boxSize={isSelected ? '3' : '1'}
                    borderRadius="full"
                    bg={isSelected ? 'blue.solid' : 'gray.300'}
                    outline={isSelected ? '2px solid' : undefined}
                    outlineColor="blue.solid"
                    outlineOffset="2px"
                    _groupHover={
                      isSelected
                        ? undefined
                        : {
                            boxSize: '2',
                            bg: 'gray.400',
                            // Fast grow on hover-in…
                            transition:
                              'width 0.15s ease, height 0.15s ease, background 0.15s ease',
                          }
                    }
                    // Fast when selecting; slow shrink back on hover-out.
                    transition={
                      isSelected
                        ? 'width 0.15s ease, height 0.15s ease, background 0.15s ease, outline-color 0.15s ease'
                        : 'width 0.8s ease, height 0.8s ease, background 0.8s ease'
                    }
                  />
                </Flex>
              );
            })}
          </Box>
        ))}
      </Grid>
    </Grid>
  );
}
