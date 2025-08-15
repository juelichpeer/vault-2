// views.js — Home start + clean tab renders

// ---------- Login ----------
export function renderLogin(onLogin){
  return `
  <div class="main">
    <div class="card padded">
      <h2>VAULT — Sign in</h2>
      <p class="muted">Private access only.</p>
      <div class="col" style="max-width:380px">
        <input id="email" type="email" placeholder="Email"/>
        <input id="password" type="password" placeholder="Password"/>
        <button id="btnLogin" class="primary">Sign in</button>
      </div>
    </div>
  </div>`;
}
export function bindLogin(onLogin){
  const go = ()=> onLogin(
    document.getElementById("email").value.trim(),
    document.getElementById("password").value.trim()
  );
  document.getElementById("btnLogin").addEventListener("click", go);
  ["email","password"].forEach(id=>{
    const el = document.getElementById(id);
    el.addEventListener("keydown", e=> (e.key==="Enter") && go());
  });
}

// ---------- Shell ----------
export function renderShell(user, isAdmin){
  return `
  <header class="header">
    <div class="brand row">
      <img src="assets/logo.svg" width="90" height="28" alt="VAULT"/>
      <strong>Monarch Secure Suite</strong>
    </div>
    <div class="row">
      <span class="pill">User: ${user.email}</span>
      <span class="pill">Role: ${isAdmin ? "Admin" : "Member"}</span>
      <button id="btnGuide" class="ghost">Guide</button>
      <button id="btnSignOut">Sign out</button>
    </div>
  </header>

  <div class="main">
    <div class="card padded">
      <div class="tabs">
        <div class="tab" data-tab="home">Home</div>
        <div class="tab" data-tab="chats">Chats</div>
        <div class="tab" data-tab="docs">Documents</div>
        <div class="tab" data-tab="members">Members</div>
        <div class="tab" data-tab="share">Share</div>
        ${isAdmin ? `<div class="tab" data-tab="admin">Admin</div>` : ``}
      </div>
      <div id="tabContent"></div>
    </div>
  </div>`;
}

export function bindShell({ signOut, switchTab, newGroup, copyInvite }){
  document.querySelectorAll(".tab").forEach(t=>{
    t.addEventListener("click", ()=> switchTab(t.dataset.tab));
  });
  document.getElementById("btnSignOut")?.addEventListener("click", signOut);

  // Quick actions hooks (if present in current view)
  document.getElementById("qaNewGroup")?.addEventListener("click", newGroup);
  document.getElementById("qaInvite")?.addEventListener("click", copyInvite);
}

// ---------- Tabs ----------
export function renderTab(tab, state){
  if(tab === "home"){
    return `
    <!-- Mobile start: menu tiles -->
    <div class="only-mobile">
      <h2 style="margin:2px 0 10px">Dashboard</h2>
      <div class="tiles">
        <div class="tile" data-nav="chats">💬 Chats</div>
        <div class="tile" data-nav="docs">📄 Documents</div>
        <div class="tile" data-nav="members">👤 Members</div>
        <div class="tile" data-nav="share">🔗 Share</div>
        ${state.profile?.is_admin ? `<div class="tile" data-nav="admin">🛡 Admin</div>` : ``}
      </div>
    </div>

    <!-- Desktop start: three-column cards -->
    <div class="only-desktop home-grid">
      <div class="card padded">
        <div class="section-title">
          <span>Groups</span>
          <button id="btnCreateGroup" class="primary">New</button>
        </div>
        <div id="groupList" class="list">
          ${renderGroups(state.groups)}
        </div>
      </div>

      <div class="card padded">
        <div class="section-title">
          <span>Chat</span>
          <span class="pill">${state.currentGroup?.name || "No group selected"}</span>
        </div>
        <div id="messageList">
          ${renderMessages(state.messages)}
        </div>
        <div class="row" style="margin-top:10px">
          <input id="msg" placeholder="Type message..."/>
          <button id="btnSend" class="primary">Send</button>
        </div>
      </div>

      <div class="card padded">
        <div class="section-title"><span>Quick Actions</span></div>
        <div class="col">
          <button id="qaNewGroup">New group</button>
          <button data-nav="docs">Upload document</button>
          <button id="qaInvite">Copy invite note</button>
        </div>
        <div class="section-title" style="margin-top:14px"><span>Activity</span></div>
        <div class="muted">Realtime feed will show here later.</div>
      </div>
    </div>`;
  }

  if(tab === "chats"){
    return `
    <div class="col" style="gap:14px">
      <div class="card padded">
        <div class="section-title">
          <span>Groups</span>
          <button id="btnCreateGroup" class="primary">New</button>
        </div>
        <div id="groupList" class="list">
          ${renderGroups(state.groups)}
        </div>
      </div>

      <div class="card padded">
        <div class="section-title">
          <span>Chat</span>
          <span class="pill">${state.currentGroup?.name || "No group selected"}</span>
        </div>
        <div id="messageList">
          ${renderMessages(state.messages)}
        </div>
        <div class="row" style="margin-top:10px">
          <input id="msg" placeholder="Type message..."/>
          <button id="btnSend" class="primary">Send</button>
        </div>
      </div>
    </div>`;
  }

  if(tab === "docs"){
    return `
    <div class="card padded">
      <div class="section-title">
        <span>Documents</span>
        <span class="pill">Private bucket: <strong>vault-docs</strong></span>
      </div>
      <div class="row">
        <input id="file" type="file"/>
        <button id="btnUpload" class="primary">Upload</button>
      </div>
      <div id="fileList" class="list files" style="margin-top:12px">
        ${renderFiles(state.files)}
      </div>
    </div>`;
  }

  if(tab === "members"){
    return `
    <div class="card padded">
      <div class="section-title"><span>Members</span></div>
      <div id="memberList" class="list">
        ${(state.members||[]).map(m=>`
          <div class="item">
            <div class="meta">
              <div class="title">${m.full_name||m.id.slice(0,6)}</div>
              <div class="sub">${m.id}</div>
            </div>
          </div>`).join("") || `<div class="muted">No members yet.</div>`}
      </div>
    </div>`;
  }

  if(tab === "share"){
    return `
    <div class="card padded">
      <div class="section-title"><span>Create a private link</span></div>
      <div class="col">
        <input id="sharePath" placeholder="Exact storage path e.g. my.pdf"/>
        <div class="row">
          <input id="expiry" type="number" min="60" value="3600" style="max-width:180px"/>
          <span class="pill">seconds</span>
          <button id="btnMakeLink" class="primary">Create link</button>
        </div>
      </div>
      <div id="shareList" class="list" style="margin-top:12px"></div>
    </div>`;
  }

  if(tab === "admin"){
    return `
    <div class="card padded">
      <div class="section-title"><span>Admin</span></div>
      <div class="col" style="max-width:420px">
        <input id="adminUserEmail" type="email" placeholder="Promote user by email"/>
        <button id="btnMakeAdmin" class="primary">Make admin</button>
        <button id="btnOpenGuide" class="ghost">Open guide</button>
      </div>
    </div>`;
  }

  return `<div class="muted">Unknown tab.</div>`;
}

// ---------- Small render helpers ----------
function renderGroups(groups){
  if(!groups || !groups.length) return `<div class="muted">No groups yet. Create one.</div>`;
  return groups.map(g=>`
    <div class="item">
      <div class="meta">
        <div class="title">${g.name}</div>
        <div class="sub">${new Date(g.created_at||Date.now()).toLocaleString()}</div>
      </div>
      <button class="btn" data-act="openGroup" data-gid="${g.id}">Open</button>
    </div>`).join("");
}

function renderMessages(msgs){
  if(!msgs || !msgs.length) return `<div class="muted">No messages.</div>`;
  return msgs.map(m=>`
    <div class="msg ${m.sender_id === 'me' ? 'me' : ''}">
      <div class="bubble">
        <div><strong>${m.sender||"user"}</strong>: ${escapeHtml(m.content)}</div>
        <div class="time">${new Date(m.created_at).toLocaleString()}</div>
      </div>
    </div>`).join("");
}

function renderFiles(files){
  if(!files || !files.length) return `<div class="muted">No documents yet.</div>`;
  return files.map(f=>`
    <div class="item" data-key="${f.key}">
      <div class="meta">
        <div class="title">${f.name}</div>
      </div>
      <div class="row">
        <button class="btn" data-act="share" data-key="${f.key}">Share</button>
        <button class="btn" data-act="download" data-key="${f.key}">Download</button>
        <button class="btn danger" data-act="delete" data-key="${f.key}">Delete</button>
      </div>
    </div>`).join("");
}

function escapeHtml(s=""){ return s.replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m])); }
