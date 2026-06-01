import {createMiddleware} from '@tanstack/react-start';

/**
 * Error shared by all `/api/*` route handlers.
 *
 * Throw an `ApiError` anywhere downstream of `apiErrorBoundary` to return a
 * specific HTTP status. Anything else becomes a 500.
 */
export class ApiError extends Error {
  code: number;
  originalError?: Error;

  constructor(code: number, message: string, originalError?: Error) {
    super(message);
    this.code = code;
    this.originalError = originalError;
    this.name = 'ApiError';
    // needed for instanceof checks after transpilation
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Request middleware that maps a thrown `ApiError` to its HTTP status and any
 * other error to a logged 500. Put it first in a route's `server.middleware`
 * so it wraps both the other middleware and the handler. Reusable by any API
 * route regardless of how it authenticates.
 */
export const apiErrorBoundary = createMiddleware({type: 'request'}).server(
  async ({next}) => {
    try {
      return await next();
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.originalError) {
          console.error(e.originalError);
        }
        return new Response(e.message, {status: e.code});
      }
      console.error(e);
      return new Response('Internal Server Error', {status: 500});
    }
  },
);
