import type { RequestHandler } from "express";
import { verifySessionToken, type AuthenticatedUser } from "../lib/session";

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
    }
  }
}

const authRequired: RequestHandler = (req, res, next) => {
  const user = verifySessionToken(req.cookies?.trustshield_session);
  if (!user) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }
  req.authUser = user;
  next();
};

export default authRequired;