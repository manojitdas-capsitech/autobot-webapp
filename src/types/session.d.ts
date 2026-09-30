import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    oauthState?: string;
    flash?: { type: 'error' | 'ok'; message: string };
  }
}

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

export {};
