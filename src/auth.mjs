import crypto from "node:crypto";

export function hashText(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export function createUser(db, { name, isGuest, passwordHash }) {
  const id = crypto.randomUUID();
  const user = {
    id,
    name,
    isGuest,
    passwordHash,
    characterIds: [],
    createdAt: new Date().toISOString()
  };
  db.users[id] = user;
  return user;
}

export function issueSession(db, userId) {
  const token = crypto.randomUUID();
  db.sessions[token] = {
    token,
    userId,
    createdAt: new Date().toISOString()
  };
  return {
    token,
    user: sanitizeUser(db.users[userId])
  };
}

export function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    isGuest: user.isGuest,
    characterIds: user.characterIds,
    createdAt: user.createdAt
  };
}

export function findUserByName(db, name) {
  return Object.values(db.users).find((user) => user.name === name);
}

export function getSession(db, req) {
  const token = req.headers["x-session-token"];
  if (!token || typeof token !== "string") {
    return null;
  }

  const rawSession = db.sessions[token];
  if (!rawSession) {
    return null;
  }

  return {
    token,
    user: sanitizeUser(db.users[rawSession.userId])
  };
}

export function requireSession(db, req, res) {
  const session = getSession(db, req);
  if (!session) {
    res.status(401).json({ error: "请先登录或进入游客模式。" });
    return null;
  }
  return session;
}
