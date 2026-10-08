const crypto = require('crypto');

const sessions = new Map();
const apiBaseUrl = (GetConvar('ob1_api_url', 'https://api.ob1.store') || '').replace(/\/+$/, '');
const hmacSecret = GetConvar('ob1_hmac_secret', '');

function canonicalize(value) {
    if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

function hmac(key, value) {
    return crypto.createHmac('sha256', key).update(value).digest('hex');
}

function request(method, route, body, headers = {}) {
    return new Promise((resolve, reject) => {
        const encoded = body === undefined ? '' : JSON.stringify(body);
        PerformHttpRequest(`${apiBaseUrl}${route}`, (status, responseBody, responseHeaders) => {
            let parsed = null;
            try { parsed = responseBody ? JSON.parse(responseBody) : null; } catch { }
            resolve({ status, body: parsed, headers: responseHeaders || {} });
        }, method, encoded, { ['Content-Type']: 'application/json', ...headers });
    });
}

function responseSignature(payload) {
    return hmac(hmacSecret, canonicalize(payload));
}

function verifyResponse(result) {
    if (!result || result.status < 200 || result.status >= 300 || !result.body?.payload || !result.body?.signature) return null;
    const expected = responseSignature(result.body.payload);
    const received = Buffer.from(result.body.signature, 'hex');
    return received.length === expected.length / 2 && crypto.timingSafeEqual(Buffer.from(expected, 'hex'), received) ? result.body.payload : null;
}

function clearSession(source) {
    sessions.delete(String(source));
}

onNet('ob1:remote:login', async (licenseKey, hwid) => {
    const source = String(global.source);
    if (typeof licenseKey !== 'string' || typeof hwid !== 'string' || licenseKey.length > 256 || hwid.length > 512) {
        emitNet('ob1:remote:auth', source, false);
        return;
    }

    const result = await request('POST', '/api/fivem/auth', { licenseKey, hwid });
    if (result.status < 200 || result.status >= 300 || !result.body?.token) {
        clearSession(source);
        emitNet('ob1:remote:auth', source, false);
        return;
    }

    sessions.set(source, { token: result.body.token, expiresAt: Date.now() + 14 * 60 * 1000 });
    emitNet('ob1:remote:auth', source, true);
});

onNet('ob1:remote:action', async (action, inputJson) => {
    const source = String(global.source);
    const session = sessions.get(source);
    if (!session || session.expiresAt <= Date.now() || typeof action !== 'string' || typeof inputJson !== 'string') {
        clearSession(source);
        emitNet('ob1:remote:action', source, false, '');
        return;
    }

    let input;
    try { input = JSON.parse(inputJson); } catch {
        emitNet('ob1:remote:action', source, false, '');
        return;
    }

    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Math.floor(Date.now() / 1000);
    const body = { action, input };
    const serializedBody = canonicalize(body);
    const canonical = ['POST', '/api/fivem/action', timestamp, nonce, serializedBody].join('\n');
    const result = await request('POST', '/api/fivem/action', body, {
        Authorization: `Bearer ${session.token}`,
        'X-Request-Nonce': nonce,
        'X-Request-Timestamp': String(timestamp),
        'X-Request-Signature': hmac(session.token, canonical)
    });
    const payload = verifyResponse(result);
    if (!payload) {
        emitNet('ob1:remote:action', source, false, '');
        return;
    }

    emitNet('ob1:remote:action', source, true, JSON.stringify(payload));
});

AddEventHandler('playerDropped', () => clearSession(String(global.source)));

if (!hmacSecret) {
    console.warn('[ob1_remote] ob1_hmac_secret is not configured; action responses will be rejected.');
}

const loaderSessions = new Map();
const loaderModId = GetConvar('ob1_mod_id', '');
const loaderLicenseKey = GetConvar('ob1_license_key', '');
const loaderResourceId = GetCurrentResourceName();

function decryptPayload(payload) {
    if (!payload || payload.resourceId !== loaderResourceId || payload.modId !== loaderModId || payload.algorithm !== 'aes-256-gcm') return null;
    const key = crypto.createHash('sha256').update(hmacSecret).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'));
    decipher.setAAD(Buffer.from(loaderResourceId + ':' + loaderModId));
    decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

async function loadDynamicPayload(source) {
    if (!loaderModId || !loaderLicenseKey || !hmacSecret) return false;
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Math.floor(Date.now() / 1000);
    const body = { resourceId: loaderResourceId, modId: loaderModId, licenseKey: loaderLicenseKey, nonce };
    const result = await request('POST', '/api/v1/mods/stream-payload', body, {
        'X-OB1-Timestamp': String(timestamp),
        'X-OB1-Signature': hmac(hmacSecret, timestamp + '\n' + JSON.stringify(body))
    });
    if (result.status < 200 || result.status >= 300 || !result.body?.payload || !result.body?.signature) return false;
    const expected = responseSignature(result.body.payload);
    const received = Buffer.from(result.body.signature, 'hex');
    if (received.length !== expected.length / 2 || !crypto.timingSafeEqual(Buffer.from(expected, 'hex'), received)) return false;
    const sourceCode = decryptPayload(result.body.payload);
    if (!sourceCode) return false;
    loaderSessions.set(String(source || 'server'), { expiresAt: Date.now() + 90_000 });
    emitNet('ob1:loader:payload', source || -1, sourceCode);
    return true;
}

on('onServerResourceStart', (resourceName) => {
    if (resourceName !== loaderResourceId) return;
    loadDynamicPayload();
});

onNet('ob1:loader:request', async () => {
    const source = String(global.source);
    const accepted = await loadDynamicPayload(source);
    if (!accepted) emitNet('ob1:loader:stop', source, 'authorization_failed');
});

on('playerDropped', () => loaderSessions.delete(String(global.source)));