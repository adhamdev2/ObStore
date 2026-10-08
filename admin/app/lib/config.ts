import fs from "fs";
import path from "path";

export interface MetaConfig {
  email: string;
  password: string;
  "2fa": boolean;
  "2fa_secret": string;
  jwt_secret: string;
}

export function getConfig(): MetaConfig {
  const configPath = path.join(process.cwd(), "meta.config.json");
  const raw = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(raw) as MetaConfig;
}
