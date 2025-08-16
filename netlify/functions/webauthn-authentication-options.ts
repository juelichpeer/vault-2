import { Handler } from '@netlify/functions'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const rpID  = process.env.RP_ID || 'localhost'

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }
  const { userId } = JSON.parse(event.body || '{}')
  if (!userId) return { statusCode: 400, body: 'userId required' }

  const { data: creds } = await admin
    .from('webauthn_credentials')
    .select('credential_id, transports')
    .eq('user_id', userId)

  // v10+: allowCredentials expect id as Base64URL **string**
  const allowCredentials = (creds ?? []).map(c => ({
    id: c.credential_id,
    transports: c.transports ?? undefined,
  }))

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: 'required',
  })

  await admin.from('webauthn_challenges').upsert({ user_id: userId, challenge: options.challenge })
  return { statusCode: 200, body: JSON.stringify(options) }
}
