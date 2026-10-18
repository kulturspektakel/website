// Mean of a set of 1–4 ratings, or null when there are none. Shared by the
// booking table's rows and the detail modal's history timeline so the "average
// rating" rule stays defined in one place.
export function meanRating(items: {rating: number}[]): number | null {
  return items.length
    ? items.reduce((sum, r) => sum + r.rating, 0) / items.length
    : null;
}
