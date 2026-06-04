import {ApiError} from './apiError.server';

/**
 * Parse a request's JSON body into `T`, throwing `ApiError(400)` on malformed
 * input so the `apiErrorBoundary` middleware turns it into a clean 400.
 */
export async function readJsonPayload<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch (e) {
    throw new ApiError(400, 'Bad Request', e as Error);
  }
}
