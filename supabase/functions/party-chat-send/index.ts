import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ---- Base64url helpers ----
function b64urlEncode(buf: Uint8Array): string {
  let str = '';
  for (const byte of buf) str += String.fromCharCode(byte);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - padded.length % 4) % 4;
  const b64 = padded + '='.repeat(pad);
  const binary = atob(b64);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { result.set(a, offset); offset += a.length; }
  return result;
}

// ---- VAPID JWT (ES256) ----
async function createVapidJwt(
  audience: string, subject: string,
  publicKeyB64: string, privateKeyD: string,
): Promise<string> {
  const pubBytes = b64urlDecode(publicKeyB64);
  const x = b64urlEncode(pubBytes.slice(1, 33));
  const y = b64urlEncode(pubBytes.slice(33, 65));

  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x, y, d: privateKeyD },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign'],
  );

  const header = b64urlEncode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64urlEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 43200,
    sub: subject,
  })));

  const data = new TextEncoder().encode(`${header}.${claims}`);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, data));

  return `${header}.${claims}.${b64urlEncode(sig)}`;
}

// ---- Web Push Encryption (RFC 8291 / aes128gcm) ----
async function encryptPayload(
  plaintext: Uint8Array,
  clientPublicKeyB64: string,
  clientAuthB64: string,
): Promise<Uint8Array> {
  const clientPubKeyBytes = b64urlDecode(clientPublicKeyB64);
  const clientAuth = b64urlDecode(clientAuthB64);

  // Import client's ECDH public key
  const clientPubKey = await crypto.subtle.importKey(
    'raw', clientPubKeyBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, [],
  );

  // Generate ephemeral ECDH key pair
  const ephemeral = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'],
  );
  const ephPubBytes = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey));

  // ECDH shared secret
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientPubKey }, ephemeral.privateKey, 256,
  ));

  // key_info = "WebPush: info\0" || ua_public || as_public
  const keyInfo = concat(
    new TextEncoder().encode('WebPush: info\0'),
    clientPubKeyBytes,
    ephPubBytes,
  );

  // Step 1: HKDF(salt=auth, IKM=sharedSecret, info=keyInfo) → IKM
  const hkdfKey1 = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveBits']);
  const ikm = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', salt: clientAuth, info: keyInfo, hash: 'SHA-256' }, hkdfKey1, 256,
  ));

  // Random salt for content encryption
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Step 2: HKDF(salt=salt, IKM=ikm) → CEK and nonce
  const hkdfKey2 = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const cekBits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', salt, info: new TextEncoder().encode('Content-Encoding: aes128gcm\0'), hash: 'SHA-256' }, hkdfKey2, 128,
  ));
  const nonce = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', salt, info: new TextEncoder().encode('Content-Encoding: nonce\0'), hash: 'SHA-256' }, hkdfKey2, 96,
  ));

  // Pad plaintext with delimiter 0x02 (last record)
  const padded = concat(plaintext, new Uint8Array([2]));

  // Encrypt with AES-128-GCM
  const cek = await crypto.subtle.importKey('raw', cekBits, 'AES-GCM', false, ['encrypt']);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce }, cek, padded,
  ));

  // Build aes128gcm header: salt(16) || rs(4) || idlen(1) || keyid(65)
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);

  return concat(salt, rs, new Uint8Array([65]), ephPubBytes, encrypted);
}

// ---- Send a single Web Push notification ----
async function sendWebPush(
  endpoint: string, p256dh: string, auth: string,
  payload: string,
  vapidPublicKey: string, vapidPrivateKey: string,
  vapidSubject: string,
): Promise<Response> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await createVapidJwt(audience, vapidSubject, vapidPublicKey, vapidPrivateKey);

  const encrypted = await encryptPayload(
    new TextEncoder().encode(payload), p256dh, auth,
  );

  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'TTL': '86400',
      'Urgency': 'high',
    },
    body: encrypted,
  });
}

// ---- Main handler ----
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

  // Authenticate user
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const adminClient = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { partyId, message, senderName, replyToId, imageUrl } = body;

    if (!partyId || !message || !senderName) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders });
    }

    // Verify party membership
    const { data: membership } = await adminClient
      .from('party_members')
      .select('id')
      .eq('party_id', partyId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Not a party member' }), { status: 403, headers: corsHeaders });
    }

    // Insert message
    const insertData: Record<string, unknown> = {
      party_id: partyId,
      user_id: user.id,
      sender_name: senderName,
      message: message.slice(0, 500),
    };
    if (replyToId) insertData.reply_to_id = replyToId;
    if (imageUrl) insertData.image_url = imageUrl;

    const { data: insertedMessage, error: insertError } = await adminClient
      .from('party_messages')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to send message' }), { status: 500, headers: corsHeaders });
    }

    // Send push notifications to all party members (including sender for cross-device)
    if (vapidPublicKey && vapidPrivateKey) {
      const memberUserIds = (await adminClient
        .from('party_members')
        .select('user_id')
        .eq('party_id', partyId))
        .data?.map((m: { user_id: string }) => m.user_id) || [];

      if (memberUserIds.length > 0) {
        const { data: subscriptions } = await adminClient
          .from('party_push_subscriptions')
          .select('*')
          .in('user_id', memberUserIds)
          .eq('notifications_enabled', true);

        if (subscriptions && subscriptions.length > 0) {
          const vapidSubject = 'mailto:notifications@assassinsledger.app';
          const payload = JSON.stringify({
            title: `💬 ${senderName}`,
            body: message.slice(0, 200),
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            tag: `chat-${partyId}-${Date.now()}`,
            data: { partyId, url: '/?panel=party&chat=1' },
          });

          const pushResults = await Promise.allSettled(
            subscriptions.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
              try {
                const res = await sendWebPush(
                  sub.endpoint, sub.p256dh, sub.auth,
                  payload, vapidPublicKey, vapidPrivateKey, vapidSubject,
                );

                // Prune invalid subscriptions
                if (res.status === 404 || res.status === 410) {
                  console.log(`Removing stale subscription ${sub.id}`);
                  await adminClient
                    .from('party_push_subscriptions')
                    .delete()
                    .eq('id', sub.id);
                }

                return { endpoint: sub.endpoint, status: res.status };
              } catch (err) {
                console.error(`Push failed for ${sub.endpoint}:`, err);
                return { endpoint: sub.endpoint, error: String(err) };
              }
            }),
          );

          console.log('Push results:', JSON.stringify(pushResults.map(r =>
            r.status === 'fulfilled' ? r.value : { error: String(r.reason) }
          )));
        }
      }
    } else {
      console.warn('VAPID keys not configured — skipping push notifications');
    }

    return new Response(
      JSON.stringify({ message: insertedMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('party-chat-send error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: corsHeaders });
  }
});
