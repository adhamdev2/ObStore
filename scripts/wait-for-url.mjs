import http from "node:http";
import https from "node:https";

const target = process.argv[2];
const timeoutMs = Number(process.argv[3] ?? 60000);
const intervalMs = 1000;

if (!target) {
  console.error("Usage: node scripts/wait-for-url.mjs <url> [timeoutMs]");
  process.exit(1);
}

const startedAt = Date.now();

function ping(url) {
  const client = url.startsWith("https:") ? https : http;

  return new Promise((resolve) => {
    const request = client.get(url, (response) => {
      response.resume();
      resolve(response.statusCode && response.statusCode < 500);
    });

    request.on("error", () => resolve(false));
    request.setTimeout(3000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForUrl() {
  while (Date.now() - startedAt < timeoutMs) {
    if (await ping(target)) {
      console.log(`Server is ready at ${target}`);
      process.exit(0);
    }

    console.log(`Waiting for ${target}...`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  console.error(`Timed out waiting for ${target} after ${timeoutMs}ms`);
  process.exit(1);
}

waitForUrl();
