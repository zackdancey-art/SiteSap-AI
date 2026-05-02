import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;
  safeMessage: string;
  constructor(statusCode: number, safeMessage: string, message?: string) {
    super(message || safeMessage);
    this.statusCode = statusCode;
    this.safeMessage = safeMessage;
  }
}

export function jsonErrorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.safeMessage });
  }
  // eslint-disable-next-line no-console
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
}
