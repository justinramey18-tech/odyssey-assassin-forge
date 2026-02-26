const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function b64urlEncode(buf: Uint8Array): string {
  let str = '';
  for (const byte of buf) str += String.fromCharCode(byte);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Generate ECDSA P-256 key pair for VAPID
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    );

    const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

    // Build uncompressed public key: 0x04 || x || y
    const xBytes = b64urlDecode(privateJwk.x!);
    const yBytes = b64urlDecode(privateJwk.y!);
    const publicKeyBytes = new Uint8Array(65);
    publicKeyBytes[0] = 0x04;
    publicKeyBytes.set(xBytes, 1);
    publicKeyBytes.set(yBytes, 33);

    const publicKey = b64urlEncode(publicKeyBytes);
    const privateKey = privateJwk.d!;

    return new Response(JSON.stringify({
      publicKey,
      privateKey,
      instructions: 'Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY as backend secrets. The publicKey also goes in client code.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function b64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - padded.length % 4) % 4;
  const b64 = padded + '='.repeat(pad);
  const binary = atob(b64);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
