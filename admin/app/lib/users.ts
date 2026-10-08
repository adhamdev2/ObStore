import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface User {
  id: string;
  email: string;
  password: string;
  twofa_secret: string;
  created_at: string;
}

const USERS_FILE = path.join(process.cwd(), "users.json");

export function getUsers(): User[] {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    const raw = fs.readFileSync(USERS_FILE, "utf-8");
    const data = JSON.parse(raw);
    return data.users || [];
  } catch {
    return [];
  }
}

export function saveUsers(users: User[]) {
  fs.writeFileSync(USERS_FILE, JSON.stringify({ users }, null, 2), "utf-8");
}

export function findUserByEmail(email: string): User | undefined {
  return getUsers().find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function createUser(
  email: string,
  password: string,
  twofaSecret: string
): User {
  const users = getUsers();
  const user: User = {
    id: crypto.randomUUID(),
    email,
    password,
    twofa_secret: twofaSecret,
    created_at: new Date().toISOString(),
  };
  users.push(user);
  saveUsers(users);
  return user;
}

export function deleteUser(id: string): boolean {
  const users = getUsers();
  const filtered = users.filter((u) => u.id !== id);
  if (filtered.length === users.length) return false;
  saveUsers(filtered);
  return true;
}

export function generateSecret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let secret = "";
  const bytes = crypto.randomBytes(20);
  for (let i = 0; i < 32; i++) {
    secret += chars[bytes[i % 20] % 32];
  }
  return secret;
}
