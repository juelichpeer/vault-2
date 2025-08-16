import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = (await fetch('/.netlify/functions/env-url').then(r=>r.ok?r.text():null).catch(()=>null)) || (window.SUPABASE_URL || '')
const SUPABASE_ANON = (await fetch('/.netlify/functions/env-anon').then(r=>r.ok?r.text():null).catch(()=>null)) || (window.SUPABASE_ANON || '')

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

const els = (ids)=>Object.fromEntries(ids.map(id=>[id, document.getElementById(id)]))
const { loginCard, dashCard, meEmail, orgId, chatId, btnLogin, email, password, btnLogout, inviteEmail, inviteRole, btnInvite, inviteMsg, status } =
  els(['loginCard','dashCard','meEmail','orgId','chatId','btnLogin','email','password','btnLogout','inviteEmail','inviteRole','btnInvite','inviteMsg','status'])

function setStatus(msg, ok=true){ status.textContent = msg; status.className = ok ? 'pill ok' : 'pill bad' }

async function showUI(){
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    loginCard.classList.remove('hide'); dashCard.classList.add('hide'); setStatus('Logged out', false); return
  }
  loginCard.classList.add('hide'); dashCard.classList.remove('hide')
  meEmail.textContent = session.user.email

  // grab first org for this user
  const { data: mships, error } = await supabase.from('memberships').select('org_id,role').eq('user_id', session.user.id).limit(1)
  if (error || !mships || !mships.length) { setStatus('No org membership found', false); return }
  const org = mships[0].org_id
  orgId.textContent = org

  // latest chat in org (OPTIONAL)
  const { data: chats } = await supabase.from('chats').select('id').eq('org_id', org).order('created_at', { ascending:false }).limit(1)
  if (chats && chats.length) chatId.textContent = chats[0].id

  setStatus('Ready')
}

btnLogin.onclick = async () => {
  setStatus('Logging in…')
  const { error } = await supabase.auth.signInWithPassword({ email: email.value.trim(), password: password.value })
  if (error) { setStatus(error.message, false); return }
  await showUI()
}

btnLogout.onclick = async () => {
  await supabase.auth.signOut(); await showUI()
}

btnInvite.onclick = async () => {
  inviteMsg.textContent = 'Inviting…'
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return inviteMsg.textContent = 'Login first'

  const org = orgId.textContent
  const res = await fetch('/.netlify/functions/invite-user', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ email: inviteEmail.value.trim(), orgId: org, role: inviteRole.value })
  })
  if (!res.ok) { inviteMsg.textContent = await res.text(); setStatus('Invite failed', false); return }
  const { userId } = await res.json()
  inviteMsg.textContent = `Invited: ${userId}`
  setStatus('Invite sent')
}

showUI()
