import { Handler } from '@netlify/functions'
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import { createClient } from '@supabase/supabase-js'

const admin  = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const rpID   = process.env.RP_ID   || 'localhost'
const origin = process.env.ORIGIN || 'http://localhost:8888'

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }
  const { userId, response } = JSON.parse(event.body || '{}')
  if (!userId || !response) return { statusCode: 400, body: 'userId and response required' }

  const { data: chalRow } = await admin
    .from('webauthn_challenges').select('challenge').eq('user_id', userId).single()
  if (!chalRow) return { statusCode: 400, body: 'challenge not found' }

  // Load stored passkey
  const { data: creds } = await admin
    .from('webauthn_credentials')
    .select('*')
    .eq('user_id', userId)

  const cred = (creds ?? []).find(c => c.credential_id === response.id)
  if (!cred) return { statusCode: 400, body: 'credential not found' }

  // v10+: use `credential` option, and publicKey must be Uint8Array
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: chalRow.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: cred.credential_id,                                   // Base64URL string
      publicKey: Buffer.from(cred.public_key, 'base64url'),     // Uint8Array acceptable
      counter: Number(cred.counter) || 0,
      transports: cred.transports ?? undefined,
    },
    requireUserVerification: true,
  })

  if (!verification.verified) return { statusCode: 400, body: 'verification failed' }

  // Update counter
  const { authenticationInfo } = verification
  await admin.from('webauthn_credentials')
    .update({ counter: authenticationInfo.newCounter })
    .eq('id', cred.id)

  return { statusCode: 200, body: JSON.stringify({ ok: true }) }
}
