import { Handler } from '@netlify/functions'
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { createClient } from '@supabase/supabase-js'

const admin  = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const rpID   = process.env.RP_ID   || 'localhost'
const origin = process.env.ORIGIN || 'http://localhost:8888'

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }
  const { userId, response, deviceName } = JSON.parse(event.body || '{}')
  if (!userId || !response) return { statusCode: 400, body: 'userId and response required' }

  const { data: chalRow, error } = await admin
    .from('webauthn_challenges').select('challenge').eq('user_id', userId).single()
  if (error || !chalRow) return { statusCode: 400, body: 'challenge not found' }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: chalRow.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
  })
  if (!verification.verified || !verification.registrationInfo) {
    return { statusCode: 400, body: 'verification failed' }
  }

  // v10+: fields moved under registrationInfo.credential
  const { registrationInfo } = verification
  const { credential, credentialDeviceType, credentialBackedUp } = registrationInfo
  // credential.publicKey is Uint8Array; store as base64url for convenience
  const publicKeyB64Url = Buffer.from(credential.publicKey).toString('base64url')

  await admin.from('webauthn_credentials').upsert({
    user_id:     userId,
    credential_id: credential.id,           // Base64URL string
    public_key:    publicKeyB64Url,         // Base64URL of bytes
    counter:       credential.counter,
    transports:    credential.transports ?? null,
    device_name:   deviceName ?? `${credentialDeviceType}${credentialBackedUp ? ' (synced)' : ''}`
  })

  return { statusCode: 200, body: JSON.stringify({ ok: true }) }
}
