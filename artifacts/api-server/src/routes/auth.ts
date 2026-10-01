import bcrypt from "bcryptjs";
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  GetCurrentUserResponse,
  LoginAccountBody,
  LoginAccountResponse,
  RegisterAccountBody,
  RegisterAccountResponse,
} from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import authRequired from "../middlewares/authenticate";
import { rateLimit } from "../middlewares/rate-limit";
import { clearSessionCookie, setSessionCookie } from "../lib/session";

const router: IRouter = Router();
const registrationLimit = rateLimit("register", 8, 15 * 60 * 1000);
const loginLimit = rateLimit("login", 12, 15 * 60 * 1000);

router.post("/auth/register", registrationLimit, async (req, res): Promise<void> => {
  const parsed = RegisterAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a name, a valid email, and a password of at least 10 characters." });
    return;
  }

  const name = parsed.data.name.trim();
  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password;
  if (name.length < 2 || Buffer.byteLength(password, "utf8") > 72) {
    res.status(400).json({ error: "Check your name and use a password of at most 72 UTF-8 bytes." });
    return;
  }

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  let user: typeof usersTable.$inferSelect;
  try {
    [user] = await db
      .insert(usersTable)
      .values({ name, email, passwordHash })
      .returning();
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json({ error: "An account with this email already exists." });
      return;
    }
    throw error;
  }

  const publicUser = { id: user.id, name: user.name, email: user.email };
  setSessionCookie(res, publicUser);
  res.status(201).json(RegisterAccountResponse.parse(publicUser));
});

router.post("/auth/login", loginLimit, async (req, res): Promise<void> => {
  const parsed = LoginAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid email and password." });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  const passwordMatches =
    user && Buffer.byteLength(parsed.data.password, "utf8") <= 72
      ? await bcrypt.compare(parsed.data.password, user.passwordHash)
      : false;
  if (!user || !passwordMatches) {
    res.status(401).json({ error: "Email or password is incorrect." });
    return;
  }

  const publicUser = { id: user.id, name: user.name, email: user.email };
  setSessionCookie(res, publicUser);
  res.json(LoginAccountResponse.parse(publicUser));
});

router.get("/auth/me", authRequired, (req, res): void => {
  res.json(
    GetCurrentUserResponse.parse({
      id: req.authUser!.id,
      name: req.authUser!.name,
      email: req.authUser!.email,
    }),
  );
});

router.post("/auth/logout", (_req, res): void => {
  clearSessionCookie(res);
  res.sendStatus(204);
});

export default router;