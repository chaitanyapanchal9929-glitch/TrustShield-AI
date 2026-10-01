import type { RequestHandler } from "express";

type WindowRecord = { count: number; resetsAt: number };
const windows = new Map<string, WindowRecord>();

export function rateLimit(name: string, maxRequests: number, windowMs: number): RequestHandler {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${name}:${req.ip ?? req.socket.remoteAddress ?? "unknown"}`;
    const current = windows.get(key);

    if (!current || current.resetsAt <= now) {
      windows.set(key, { count: 1, resetsAt: now + windowMs });
      next();
      return;
    }

    if (current.count >= maxRequests) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((current.resetsAt - now) / 1000))));
      res.status(429).json({ error: "Too many requests. Please wait and try again." });
      return;
    }

    current.count += 1;
    next();

    if (windows.size > 5000) {
      for (const [entryKey, entry] of windows) {
        if (entry.resetsAt <= now) windows.delete(entryKey);
      }
    }
  };
}