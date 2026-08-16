import {toaster} from '../chakra-snippets/toaster';

// Every failure in this section surfaces the same way: an error toast titled
// with what didn't work, described by whatever the thrown value says. The two
// callers that need the message on its own (to decide whether to toast at all)
// use errorMessage directly.

export const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

// Curried, because the common case is a react-query `onError` — passing the
// title alone keeps the mutation's error handling to one line, which is what
// makes forgetting it (and failing silently) less likely.
export const errorToast =
  (title: string) =>
  (e: unknown): void => {
    toaster.create({type: 'error', title, description: errorMessage(e)});
  };
