// netlify/functions/invite-user.ts
import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }
    const { email, orgId, role = 'member', username, displayName } = JSON.parse(event.body || '{}')
    if (!email || !orgId) return { statusCode: 400, body: 'email and orgId required' }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: false, // you can flip to true if you want auto-confirm
    })
    if (error) throw error
    const userId = data.user?.id
    if (!userId) throw new Error('No user id returned')

    await supabaseAdmin.from('profiles').upsert({
      id: userId, username: username ?? email.split('@')[0], display_name: displayName ?? email
    })

    const { error: mErr } = await supabaseAdmin.from('memberships').upsert({
      org_id: orgId, user_id: userId, role
    })
    if (mErr) throw mErr

    return { statusCode: 200, body: JSON.stringify({ userId }) }
  } catch (e:any) {
    return { statusCode: 500, body: e.message || 'error' }
  }
}
