import {createContext, useContext} from 'react';
import type {BookingRow} from '../../routes/crew.booking.$eventId';

// The booking table's rows, provided by the page to the detail modal so both
// show the same (optimistic) state. It lives outside the route file because
// the router code-splits the page component into its own chunk: a context
// defined there would exist twice, and the modal would read an empty default.
export const BookingRowsContext = createContext<BookingRow[]>([]);

// One row of the page's table, for the detail modal rendered inside it.
export function useBookingRow(applicationId: string) {
  return useContext(BookingRowsContext).find((r) => r.id === applicationId);
}
