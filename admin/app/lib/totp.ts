import crypto from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(encoded: string): Buffer {
  let bits = "";
  for (const char of encoded.toUpperCase().replace(/=+$/, "")) {
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateCode(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac("sha1", key);
  hmac.update(buffer);
  const hash = hmac.digest();

  const offset = hash[hash.length - 1] & 0x0f;
  const code =
    (((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff)) %
    1000000;

  return code.toString().padStart(6, "0");
}

/**
 * Verify a TOTP code against a secret.
 * Checks current time step and ±1 window to handle clock skew.
 */
export function verifyTOTP(token: string, secret: string): boolean {
  const timeStep = 30;
  const currentCounter = Math.floor(Date.now() / 1000 / timeStep);

  for (let i = -1; i <= 1; i++) {
    const code = generateCode(secret, currentCounter + i);
    if (code === token) return true;
  }
  return false;
}

/**
 * Generate the otpauth:// URI for adding to authenticator apps
 */
export function getTOTPUri(secret: string, label = "OB Admin"): string {
  return `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=OBAdmin&algorithm=SHA1&digits=6&period=30`;
}
