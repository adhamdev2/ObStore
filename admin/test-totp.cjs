const crypto = require("crypto");

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(encoded) {
  let bits = "";
  for (const char of encoded.toUpperCase().replace(/=+$/, "")) {
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateCode(secret, counter) {
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

function verifyTOTP(token, secret) {
  const timeStep = 30;
  const currentCounter = Math.floor(Date.now() / 1000 / timeStep);

  for (let i = -2; i <= 2; i++) {
    const code = generateCode(secret, currentCounter + i);
    console.log(`Window ${i}: ${code}`);
    if (code === token) return true;
  }
  return false;
}

const secret = "JVLWI3DMEBZGQ3LBNZSSA2LOMNXWY3DF";
console.log("Testing secret:", secret);
const timeStep = 30;
const currentCounter = Math.floor(Date.now() / 1000 / timeStep);
const currentCode = generateCode(secret, currentCounter);
console.log("Current expected code:", currentCode);
console.log("Verify result:", verifyTOTP(currentCode, secret));
