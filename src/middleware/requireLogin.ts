import { NextFunction, Request, Response } from 'express';

export function requireLogin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.redirect('/login');
    return;
  }
  next();
}
