const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Web Push helpers (RFC 8291 aes128gcm, no npm) ──
// Shared with party-chat-send

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(pad);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function base64UrlEncode(buf: Uint8Array): string {
  let binary = '';
  for (const b of buf) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function encodeLength(len: number): Uint8Array {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, len);
  return buf;
}

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<CryptoKey> {
  const key = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const prk = await crypto.subtle.sign('HMAC', key, ikm);
  return crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

async function hkdfExpand(prk: CryptoKey, info: Uint8Array, length: number): Promise<Uint8Array> {
  const result = new Uint8Array(length);
  let prev = new Uint8Array(0);
  let offset = 0;
  let counter = 1;
  while (offset < length) {
    const input = concat(prev, info, new Uint8Array([counter]));
    const output = new Uint8Array(await crypto.subtle.sign('HMAC', prk, input));
    const toCopy = Math.min(output.length, length - offset);
    result.set(output.subarray(0, toCopy), offset);
    prev = output;
    offset += toCopy;
    counter++;
  }
  return result;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const prk = await hkdfExtract(salt, ikm);
  return hkdfExpand(prk, info, length);
}

function createInfo(type: string, clientPublicKey: Uint8Array, serverPublicKey: Uint8Array): Uint8Array {
  const encoder = new TextEncoder();
  const typeBytes = encoder.encode(type);
  const nul = new Uint8Array([0]);
  return concat(
    encoder.encode('Content-Encoding: '),
    typeBytes,
    nul,
    encoder.encode('P-256'),
    nul,
    encodeLength(clientPublicKey.length),
    clientPublicKey,
    encodeLength(serverPublicKey.length),
    serverPublicKey,
  );
}

async function encryptPayload(
  clientPublicKeyBytes: Uint8Array,
  clientAuthBytes: Uint8Array,
  payload: string,
  serverKeys: CryptoKeyPair,
): Promise<Uint8Array> {
  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKeys.publicKey),
  );
  const clientPublicKey = await crypto.subtle.importKey(
    'raw', clientPublicKeyBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, [],
  );
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: clientPublicKey }, serverKeys.privateKey, 256),
  );
  const ikm_info = createInfo('auth', clientPublicKeyBytes, serverPublicKeyRaw);
  const ikm = await hkdf(clientAuthBytes, sharedSecret, ikm_info, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cekInfo = createInfo('aesgcm', clientPublicKeyBytes, serverPublicKeyRaw);
  const contentEncryptionKey = await hkdf(salt, ikm, cekInfo, 16);
  const nonceInfo = createInfo('nonce', clientPublicKeyBytes, serverPublicKeyRaw);
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);
  const encoder = new TextEncoder();
  const paddedPayload = concat(new Uint8Array([0, 0]), encoder.encode(payload));
  const encryptionKey = await crypto.subtle.importKey('raw', contentEncryptionKey, { name: 'AES-GCM' }, false, ['encrypt']);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, encryptionKey, paddedPayload),
  );
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([serverPublicKeyRaw.length]), serverPublicKeyRaw, encrypted);
}

function pemToArrayBuffer(pem: string): Uint8Array {
  if (!pem.includes('-----')) return base64UrlDecode(pem);
  const b64 = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s/g, '');
  const binary = atob(b64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function importVapidKeys(): Promise<{ publicKey: Uint8Array; privateKey: CryptoKey }> {
  const publicKeyB64 = Deno.env.get('VAPID_PUBLIC_KEY')!;
  const privateKeyB64 = Deno.env.get('VAPID_PRIVATE_KEY')!;
  const publicKey = base64UrlDecode(publicKeyB64);
  const privateKeyBytes = pemToArrayBuffer(privateKeyB64);
  const x = base64UrlEncode(publicKey.subarray(1, 33));
  const y = base64UrlEncode(publicKey.subarray(33, 65));
  const d = base64UrlEncode(privateKeyBytes);
  const privateKey = await crypto.subtle.importKey(
    'jwk', { kty: 'EC', crv: 'P-256', x, y, d, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'],
  );
  return { publicKey, privateKey };
}

async function createVapidAuthHeader(
  endpoint: string, vapidPublicKey: Uint8Array, vapidPrivateKey: CryptoKey,
): Promise<{ authorization: string; cryptoKey: string }> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify({ aud: audience, exp: now + 12 * 3600, sub: 'mailto:push@infinitypoolassassin.lovable.app' })),
  );
  const unsignedToken = `${header}.${payload}`;
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, vapidPrivateKey, new TextEncoder().encode(unsignedToken)),
  );
  let rawSig: Uint8Array;
  if (signature.length === 64) {
    rawSig = signature;
  } else {
    let offset = 2;
    const rLen = signature[offset + 1];
    const r = signature.subarray(offset + 2, offset + 2 + rLen);
    offset = offset + 2 + rLen;
    const sLen = signature[offset + 1];
    const s = signature.subarray(offset + 2, offset + 2 + sLen);
    rawSig = new Uint8Array(64);
    rawSig.set(r.length > 32 ? r.subarray(r.length - 32) : r, 32 - Math.min(r.length, 32));
    rawSig.set(s.length > 32 ? s.subarray(s.length - 32) : s, 64 - Math.min(s.length, 32));
  }
  const token = `${unsignedToken}.${base64UrlEncode(rawSig)}`;
  return {
    authorization: `vapid t=${token}, k=${base64UrlEncode(vapidPublicKey)}`,
    cryptoKey: `p256ecdsa=${base64UrlEncode(vapidPublicKey)}`,
  };
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payloadStr: string,
  vapidPublicKey: Uint8Array,
  vapidPrivateKey: CryptoKey,
): Promise<{ success: boolean; statusCode?: number; endpoint: string }> {
  try {
    const serverKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const encrypted = await encryptPayload(
      base64UrlDecode(subscription.p256dh), base64UrlDecode(subscription.auth), payloadStr, serverKeys,
    );
    const serverPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeys.publicKey));
    const vapidHeaders = await createVapidAuthHeader(subscription.endpoint, vapidPublicKey, vapidPrivateKey);
    const resp = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aesgcm',
        'Content-Length': String(encrypted.length),
        Authorization: vapidHeaders.authorization,
        'Crypto-Key': `${vapidHeaders.cryptoKey};dh=${base64UrlEncode(serverPublicKeyRaw)}`,
        TTL: '86400',
        Urgency: 'high',
      },
      body: encrypted,
    });
    if (resp.status === 410 || resp.status === 404) {
      return { success: false, statusCode: resp.status, endpoint: subscription.endpoint };
    }
    return { success: resp.ok, statusCode: resp.status, endpoint: subscription.endpoint };
  } catch (err) {
    console.error('Push send error for', subscription.endpoint, err);
    return { success: false, endpoint: subscription.endpoint };
  }
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { partyId, characterName, readyCount, totalCount } = await req.json();

    if (!partyId || !characterName || readyCount == null || totalCount == null) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all party members except sender
    const { data: members } = await supabase
      .from('party_members')
      .select('user_id')
      .eq('party_id', partyId)
      .neq('user_id', user.id);

    if (!members || members.length === 0) {
      return new Response(JSON.stringify({ ok: true, pushed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const memberUserIds = members.map((m) => m.user_id);

    // Get push subscriptions
    const { data: subscriptions } = await supabase
      .from('party_push_subscriptions')
      .select('endpoint, p256dh, auth, user_id')
      .in('user_id', memberUserIds)
      .eq('notifications_enabled', true);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ ok: true, pushed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build payload
    const allReady = readyCount >= totalCount && totalCount > 0;
    const title = allReady ? '🎯 All Players Ready!' : '⚔️ Party Ready Up';
    const body = allReady
      ? `All ${totalCount} players are ready!`
      : `${characterName} has readied up! (${readyCount}/${totalCount} ready)`;

    const vapid = await importVapidKeys();

    const payloadObj = {
      title,
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: allReady ? `all-ready-${Date.now()}` : `ready-up-${Date.now()}`,
      data: { url: '/', partyId },
    };
    const payloadStr = JSON.stringify(payloadObj);

    const results = await Promise.allSettled(
      subscriptions.map((sub) => sendWebPush(sub, payloadStr, vapid.publicKey, vapid.privateKey)),
    );

    // Clean up expired subscriptions
    const expiredEndpoints: string[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled' && !r.value.success && (r.value.statusCode === 410 || r.value.statusCode === 404)) {
        expiredEndpoints.push(r.value.endpoint);
      }
    }
    if (expiredEndpoints.length > 0) {
      await supabase.from('party_push_subscriptions').delete().in('endpoint', expiredEndpoints);
    }

    const successCount = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;

    return new Response(
      JSON.stringify({ ok: true, pushed: successCount, expired: expiredEndpoints.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('party-ready-notify error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
