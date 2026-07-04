// Shared constants + types for the "Bühne" stage-assignment matrix, used by both
// the interactive editor (StageMatrix) and the read-only table cell
// (StageMatrixReadonly).
//
// The matrix is a 3-row × 5-col grid: rows are time slots (früh / mitte /
// spät-headliner), columns are the three stages interleaved with an "either of
// the two neighbours" column between each pair. A selection is a single cell.

// Only the first/last slots are labelled; the middle one is left blank. `aria`
// keeps an accessible name for every row regardless of the visible label.
// NOTE: array positions are persisted as BandApplication.stageRow — append only,
// never reorder, or existing rows silently remap to a different slot.
export const STAGE_ROWS = [
  {label: 'früh', aria: 'Früh'},
  {label: '', aria: 'Mitte'},
  {label: 'spät', aria: 'Spät (Headliner)'},
];

// '' columns sit between two stages and mean "either of the neighbours".
// Soft hyphens (­) let the long names break across two lines in the narrow
// column headers.
// NOTE: array positions are persisted as BandApplication.stageColumn — append
// only, never reorder (see STAGE_ROWS).
export const STAGE_COLS = ['Große Bühne', '', 'Kult­bühne', '', 'Wald­bühne'];

// Square cell size for the interactive grid: equal column width and row height
// makes the dot-to-dot pitch identical horizontally and vertically.
export const STAGE_CELL = '2.75rem';

export type StageCell = {row: number; col: number};
export type StageValue = StageCell | null;

// Every cell of the grid, for the filter's "select all".
export const ALL_STAGE_CELLS: StageCell[] = STAGE_ROWS.flatMap((_, row) =>
  STAGE_COLS.map((__, col) => ({row, col})),
);

// Build a StageValue from the two nullable persisted columns (both set → a cell,
// either null → no selection). Used wherever stageRow/stageColumn are read back.
export const toStageValue = (
  row: number | null,
  col: number | null,
): StageValue => (row != null && col != null ? {row, col} : null);

// Accessible label for a column, spelling out the "between" columns.
export function colLabel(ci: number): string {
  return STAGE_COLS[ci] || `${STAGE_COLS[ci - 1]} oder ${STAGE_COLS[ci + 1]}`;
}

// Human-readable "slot · stage" for a selected cell (soft hyphens stripped),
// e.g. "Spät (Headliner) · Kultbühne". Used for the read-only cell's tooltip.
export function stageLabel(v: {row: number; col: number}): string {
  return `${STAGE_ROWS[v.row].aria} · ${colLabel(v.col).replace(/­/g, '')}`;
}
