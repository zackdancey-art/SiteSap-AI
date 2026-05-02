import { Request, Response, NextFunction } from 'express';

export function logger(req: Request, _res: Response, next: NextFunction) {
  // Minimal logger for dev
  // eslint-disable-next-line no-console
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
}
