import { Response } from 'express';
import { AuthedRequest } from './auth/middleware';

/**
 * Thrown by `findOwnedOrThrow` when the requested record doesn't exist or isn't owned by the
 * current user. Route handlers should be wrapped in `withNotFoundHandling` so this turns into a
 * 404 JSON response with the given message.
 */
export class NotFoundError extends Error {}

/**
 * Loads a record via `finder` and verifies it belongs to `userId`, throwing a `NotFoundError`
 * (caught by `withNotFoundHandling`) if it's missing or owned by someone else. Replaces the
 * repeated `findUnique` + ownership check + 404 boilerplate found across the route handlers.
 */
export async function findOwnedOrThrow<T extends { userId: string }>(
  finder: () => Promise<T | null>,
  userId: string | undefined,
  notFoundMessage: string
): Promise<T> {
  const record = await finder();
  if (!record || record.userId !== userId) {
    throw new NotFoundError(notFoundMessage);
  }
  return record;
}

/**
 * Wraps an Express handler so a `NotFoundError` thrown anywhere inside it (typically via
 * `findOwnedOrThrow`) is turned into a 404 JSON response instead of propagating as a 500.
 */
export function withNotFoundHandling<Req extends AuthedRequest = AuthedRequest>(
  handler: (req: Req, res: Response) => Promise<void | Response>
): (req: Req, res: Response) => Promise<void | Response> {
  return async (req, res) => {
    try {
      return await handler(req, res);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return res.status(404).json({ error: err.message });
      }
      throw err;
    }
  };
}
