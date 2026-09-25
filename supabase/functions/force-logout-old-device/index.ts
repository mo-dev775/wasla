import { createClient } from 'jsr:@supabase/supabase-js@2'

async function getAccessToken(): Promise<string> {
  const clientEmail = Deno.env.get('FCM_CLIENT_EMAIL')!
  const privateKeyRaw = Deno.env.get('FCM_PRIVATE_KEY')!.replace(/\\n/g, '\n')

  const pem = privateKeyRaw
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')
  const binaryKey = Uint8Array.from(atob(pem), c => c.charCodeAt(0))

  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claims = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }

  const b64url = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const unsigned = `${b64url(header)}.${b64url(claims)}`
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)
  )
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const jwt = `${unsigned}.${sigB64}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  })
  const data = await res.json()
  return data.access_token
}

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { user_id, new_device_id } = await req.json()

  const { data: user, error: findErr } = await supabase
    .from('users')
    .select('active_device_id, fcm_token')
    .eq('id', user_id)
    .single()

  if (findErr || !user) {
    return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 })
  }

  const oldDeviceId = user.active_device_id
  const oldFcmToken = user.fcm_token
  const newSessionToken = crypto.randomUUID()

  await supabase
    .from('users')
    .update({ active_device_id: new_device_id, session_token: newSessionToken })
    .eq('id', user_id)

  if (oldDeviceId && oldDeviceId !== new_device_id && oldFcmToken) {
    const accessToken = await getAccessToken()
    const projectId = Deno.env.get('FCM_PROJECT_ID')!

    await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: {
          token: oldFcmToken,
          data: { type: 'FORCE_LOGOUT' }
        }
      })
    })
  }

  return new Response(JSON.stringify({ session_token: newSessionToken }), { status: 200 })
})