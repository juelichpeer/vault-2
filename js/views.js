import { $, $all, toast, modal } from "./ui.js";

export function renderLogin(onLogin){
  return `
  <div class="container">
    <div class="card" style="max-width:480px; margin:80px auto; padding:20px">
      <div class="header-hero">
        <img src="assets/logo.svg" alt="VAULT" width="80" height="24"/>
        <div>
          <div class="h1">Welcome back</div>
          <div class="sub">Sign in to your private VAULT</div>
        </div>
      </div>
      <hr/>
      <div class="list">
        <label>Email<input id="email" type="email" placeholder="you@domain.com"/></label>
        <label>Password<input id="password" type="password" placeholder="••••••••"/></label>
        <button id="btnLogin">Sign in</button>
        <div class="small">No self sign-up. Ask your admin to create your account.</div>
      </div>
    </div>
  </div>`;
}

export function bindLogin(handler){
  $("#btnLogin")?.addEventListener("click", ()=>{
    const email = $("#email").value.trim();
    const password = $("#password").value;
    handler(email, password);
  });
}

export function renderShell(user, isAdmin){
  return `
  <div class="nav">
    <div class="row">
      <img src="assets/logo.svg" width="90" height="28"/>
      <span class="badge">Monarch Secure Suite</span>
    </div>
    <div class="row">
      ${isAdmin ? `<span class="pill">Admin</span>`:``}
      <button id="btnGuide">Guide</button>
      <button id="btnSignOut">Sign out</button>
    </div>
  </div>
  <div class="container">
    <div class="grid">
      <div class="g-span-8">
        <div class="card" style="padding:16px">
          <div class="spread">
            <div>
              <div class="h1">Dashboard</div>
              <div class="sub">Central hub for chat, docs, members & sharing</div>
            </div>
            <div class="kpis">
              <div class="kpi">User: <b>${user?.email||""}</b></div>
              ${isAdmin ? `<div class="kpi">Role: <b>Admin</b></div>`:`<div class="kpi">Role: <b>Member</b></div>`}
            </div>
          </div>
          <div class="tabbar" style="margin-top:12px">
            <div class="tab active" data-tab="chats">💬 Chats</div>
            <div class="tab" data-tab="docs">📄 Documents</div>
            <div class="tab" data-tab="members">🧭 Members</div>
            <div class="tab" data-tab="share">🔗 Share</div>
            ${isAdmin ? `<div class="tab" data-tab="admin">🛡️ Admin</div>`:``}
          </div>
          <div id="tabContent" style="margin-top:14px"></div>
        </div>
      </div>
      <div class="g-span-4">
        <div class="card gradient" style="padding:16px">
          <div class="h2">Quick Actions</div>
          <div class="list">
            <button id="qaNewGroup">New group</button>
            <button id="qaUploadDoc">Upload document</button>
            <button id="qaInvite">Copy invite note</button>
          </div>
        </div>
        <div class="card" style="padding:16px; margin-top:16px">
          <div class="h2">Activity</div>
          <div class="sub">Recent events (realtime once DB exists)</div>
          <div class="list" id="activity">
            <div class="item"><span>Nothing yet.</span><span class="pill">—</span></div>
          </div>
        </div>
      </div>
    </div>
    <div class="footer">VAULT © ${new Date().getFullYear()} — Private & Secure</div>
  </div>

  <div id="modalGuide" class="modal-backdrop">
    <div class="card modal">
      <div class="h2">First-run Guide</div>
      <div class="sub">Admin do this once in Supabase:</div>
      <ul class="list">
        <li class="item"><span>Create tables: profiles, groups, group_members, messages</span><span class="pill">10 min</span></li>
        <li class="item"><span>Create storage bucket: vault-docs (private)</span><span class="pill">2 min</span></li>
        <li class="item"><span>Enable Realtime on messages</span><span class="pill">1 min</span></li>
        <li class="item"><span>Set RLS policies (see README-SETUP.md)</span><span class="pill">5 min</span></li>
      </ul>
      <div class="row" style="justify-content:flex-end">
        <button onclick="document.querySelector('#modalGuide').style.display='none'">Close</button>
      </div>
    </div>
  </div>
  `;
}

export function bindShell(on){
  $("#btnSignOut")?.addEventListener("click", on.signOut);
  $("#btnGuide")?.addEventListener("click", ()=> modal.open("#modalGuide"));
  $all(".tab").forEach(t=> t.addEventListener("click", ()=> on.switchTab(t.dataset.tab)));
  $("#qaNewGroup")?.addEventListener("click", on.newGroup);
  $("#qaUploadDoc")?.addEventListener("click", ()=> on.switchTab("docs"));
  $("#qaInvite")?.addEventListener("click", on.copyInvite);
}

export function renderTab(tab, state){
  if(tab==="chats"){
    return `
      <div class="grid">
        <div class="g-span-4">
          <div class="card" style="padding:12px">
            <div class="spread"><div class="h2">Groups</div><button id="btnCreateGroup">New</button></div>
            <div id="groupList" class="list">${state.groups.length? state.groups.map(g=>`
              <div class="item"><span>${g.name}</span><button class="pill" data-gid="${g.id}" data-act="openGroup">Open</button></div>
            `).join(""): `<div class="item"><span>No groups yet.</span><span class="pill">Create one</span></div>`}</div>
          </div>
        </div>
        <div class="g-span-8">
          <div class="card" style="padding:12px; min-height:300px">
            <div class="spread"><div class="h2">Chat</div><div class="pill">${state.currentGroup?.name || "No group selected"}</div></div>
            <div id="chatArea" class="list" style="height:260px; overflow:auto; margin-top:8px">
              ${state.messages.length? state.messages.map(m=>`
                <div class="item"><span>${m.sender||"?"}: ${m.content}</span><span class="small">${m.created_at||""}</span></div>
              `).join(""):`<div class="item"><span>No messages.</span><span class="pill">—</span></div>`}
            </div>
            <div class="row" style="margin-top:10px">
              <input id="msg" placeholder="Type message..."/>
              <button id="btnSend">Send</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  if(tab==="docs"){
    return `
      <div class="card" style="padding:12px">
        <div class="spread">
          <div class="h2">Documents</div>
          <div class="sub">Private bucket: <b>vault-docs</b></div>
        </div>
        <div class="row" style="margin:10px 0">
          <input id="file" type="file"/>
          <button id="btnUpload">Upload</button>
        </div>
        <div class="list" id="fileList">
          ${state.files.length ? state.files.map(f=>`
            <div class="item">
              <span>${f.name}</span>
              <span class="row">
                <button class="pill" data-key="${f.key}" data-act="share">Share</button>
                <button class="pill" data-key="${f.key}" data-act="download">Download</button>
                <button class="pill" data-key="${f.key}" data-act="delete">Delete</button>
              </span>
            </div>
          `).join("") : `<div class="item"><span>No files yet.</span><span class="pill">—</span></div>`}
        </div>
      </div>
    `;
  }
  if(tab==="members"){
    return `
      <div class="card" style="padding:12px">
        <div class="spread"><div class="h2">Members</div><div class="sub">Location sharing (placeholder)</div></div>
        <div class="list">
          ${state.members.length? state.members.map(m=>`
            <div class="item"><span>${m.full_name||m.email}</span><span class="pill">${m.last_seen||"—"}</span></div>
          `).join(""):`<div class="item"><span>No members found.</span><span class="pill">—</span></div>`}
        </div>
      </div>
    `;
  }
  if(tab==="share"){
    return `
      <div class="card" style="padding:12px">
        <div class="h2">Share via temporary link</div>
        <div class="sub">Create time-limited signed URLs. Optionally add a one-time code.</div>
        <div class="row" style="margin:10px 0">
          <input id="sharePath" placeholder="storage object path e.g. docs/filename.pdf"/>
          <select id="expiry"><option value="3600">1 hour</option><option value="86400">24 hours</option></select>
          <button id="btnMakeLink">Generate</button>
        </div>
        <div class="list" id="shareList"></div>
      </div>
    `;
  }
  if(tab==="admin"){
    return `
      <div class="card" style="padding:12px">
        <div class="h2">Admin Controls</div>
        <div class="sub">Manage users, groups, and policies (DB-side). This UI lets you toggle flags.</div>
        <div class="row" style="margin:10px 0">
          <input id="adminUserEmail" placeholder="user email to promote"/>
          <button id="btnMakeAdmin">Make Admin</button>
        </div>
        <div class="list">
          <div class="item"><span>Setup checklist</span><button class="pill" id="btnOpenGuide">Open</button></div>
        </div>
      </div>
    `;
  }
  return `<div class="card" style="padding:12px">Unknown tab</div>`;
}
