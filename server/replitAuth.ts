import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

const DEFAULT_USERNAME = "vet";
const DEFAULT_PASSWORD = "vet";

const shouldUseSsl =
  process.env.PGSSLMODE === "require" ||
  process.env.DATABASE_URL?.includes("sslmode=require") ||
  process.env.NODE_ENV === "production";

function getConfiguredCredentials() {
  return {
    username: process.env.APP_USERNAME || DEFAULT_USERNAME,
    password: process.env.APP_PASSWORD || DEFAULT_PASSWORD,
  };
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET || "vetrecord-pro-session",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const configured = getConfiguredCredentials();
      const normalizedUsername = username.trim();
      const normalizedPassword = password.trim();
      if (normalizedUsername !== configured.username || normalizedPassword !== configured.password) {
        return done(null, false, { message: "Invalid credentials" });
      }

      const userId = "local-user";
      await storage.upsertUser({
        id: userId,
        email: username,
        firstName: "Vet",
        lastName: "User",
      });

      return done(null, { id: userId, email: normalizedUsername });
    })
  );

  passport.serializeUser((user: any, cb) => cb(null, user));
  passport.deserializeUser((user: any, cb) => cb(null, user));

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          return next(loginErr);
        }
        return res.json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    req.logout(() => {
      res.json({ message: "Logged out" });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  return next();
};
