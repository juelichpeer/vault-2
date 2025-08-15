// views.js — Mobile WhatsApp-like shell + Desktop GitHub-like shell

// ---------- Login ----------
export function renderLogin(onLogin){
  return `
  <div class="main">
    <div class="card padded" style="max-width:420px;margin:40px auto">
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

// ---------- Shell (Desktop: GitHub-like; Mobile: WhatsApp-like) ----------
export function renderShell(user, isAdmin){
  return `
  <!-- DESKTOP TOPBAR (GitHub-like) -->
  <header class="topbar only-desktop">
    <div class="row">
      <img src="assets/logo.svg" width="90" height="28" alt="VAULT"/>
      <strong>Monarch Secure Suite</strong>
    </div>
    <div class="row" style="gap:10px">
      <input class="topsearch" placeholder="Search… (not wired yet)"/>
      <span class="pill">${user.email}</span>
      <span class="pill">${isAdmin ? "Admin" : "Member"}</span>
      <button id="btnGuide" class="ghost">Guide</button>
      <button id="btnSignOut">Sign out</button>
    </div>
  </header>

  <!-- MOBILE HEADER (WhatsApp-like) -->
  <header class="m-header only-mobile">
    <div class="row">
      <img src="assets/logo.svg" width="80" height="24" alt="VAULT"/>
      <strong>VAULT</strong>
    </div>
    <div class="row">
      <button id="btnGuide" class="ghost">Guide</button>
      <button id="btnSignOut">Sign out</button>
    </div>
  </header>

  <!-- LAYOUT: sidebar + content on desktop -->
  <div class="layout">
    <aside class="sidebar only-desktop">
      <div class="nav-title">Menu</div>
      <div class="nav-item" data-nav="home">Home</div>
      <div class="nav-item" data-nav="chats">Chats</div>
      <div class="nav-item" data-nav="docs">Documents</div>
      <div class="nav-item" data-nav="members">Members</div>
      <div class="nav-item" data-nav="share">Share</div>
      ${isAdmin ? `<div class="nav-item" data-nav="admin">Admin</div>` : ``}
    </aside>

    <main class="content">
      <div id="tabContent"></div>
    </main>
  </div>

  <!-- MOBILE BOTTOM NAV (WhatsApp-like) -->
  <nav class="bottom-nav only-mobile">
    <button class="bn-item" data-nav="home">🏠<span>Home</span></button>
    <button class="bn-item" data-nav="chats">💬<span>Chats</span></button>
    <button class="bn-item" data-nav="docs">📄<span>Docs</span></button>
    <button class="bn-item" data-nav="members">👤<span>Members</span></button>
    <button class="bn-item" data-nav="share">🔗<span>Share</span></button>
    ${isAdmin ? `<button class="bn-item" data-nav="admin">🛡<span>Admin</span></button>` : ``}
  </nav>
  `;
}

export function bindShell({ signOut, switchTab, newGroup, copyInvite }){
  document.getElementById("btnSignOut")?.addEventListener("click", signOut);

  // All nav buttons (sidebar + bottom)
  document.querySelectorAll("[data-nav]").forEach(n=>{
    n.addEventListener("click", ()=> switchTab(n.dataset.nav));
  });

  // Quick actions (optional in some tabs)
  document.getElementById("qaNewGroup")?.addEventListener("click", newGroup);
  document.getElementById("qaInvite")?.addEventListener("click", copyInvite);
}

// ---------- Tabs ----------
export function renderTab(tab, state){
  if(tab === "home"){
    // Desktop: 3-column cards; Mobile: big tiles launcher
    return `
    <div class="only-mobile tiles">
      <button class="tile" data-nav="chats">💬 Chats</button>
      <button class="tile" data-nav="docs">📄 Documents</button>
      <button class="tile" data-nav="members">👤 Members</button>
      <button class="tile" data-nav="share">🔗 Share</button>
      ${state.profile?.is_admin ? `<button class="tile" data-nav="admin">🛡 Admin</button>` : ``}
    </div>

    <div class="only-desktop home-grid">
      <div class="card padded">
        <div class="section-title"><span>Groups</span><button id="btnCreateGroup" class="primary">New</button></div>
        <div id="groupList" class="list">${renderGroups(state.groups)}</div>
      </div>
      <div class="card padded">
        <div class="section-title"><span>Chat</span><span class="pill">${state.currentGroup?.name || "No group"}</span></div>
        <div id="messageList">${renderMessages(state.messages)}</div>
        <div class="row" style="margin-top:10px">
          <input id="msg" placeholder="Type message…"/><button id="btnSend" class="primary">Send</button>
        </div>
      </div>
      <div class="card padded">
        <div class="section-title"><span>Quick Actions</span></div>
        <div class="col">
          <button id="qaNewGroup">New group</button>
          <button data-nav="docs">Upload document</button>
          <button id="qaInvite">Copy invite note</button>
        </div>
      </div>
    </div>`;
  }

  if(tab === "chat_detail"){
    // Mobile-only full-screen chat (WhatsApp-style)
    return `
    <div class="only-mobile col" style="gap:12px">
      <div class="row">
        <button id="btnBackChats" class="btn">← Back</button>
        <span class="pill">${state.currentGroup?.name || "Chat"}</span>
      </div>
      <div class="card padded">
        <div id="messageList">
          ${renderMessages(state.messages)}
        </div>
        <div class="row" style="margin-top:10px">
          <input id="msg" placeholder="Type message…"/>
          <button id="btnSend" class="primary">Send</button>
        </div>
      </div>
    </div>`;
  }

  if(tab === "chats"){
    // Mobile feel: list first, then chat area
    return `
    <div class="col" style="gap:12px">
      <div class="card padded">
        <div class="section-title"><span>Chats</span><button id="btnCreateGroup" class="primary">New</button></div>
        <div id="groupList" class="chatlist">${renderChatList(state.groups, state.currentGroup)}</div>
      </div>
      <div class="card padded">
        <div class="section-title"><span>Conversation</span><span class="pill">${state.currentGroup?.name || "No group selected"}</span></div>
        <div id="messageList">${renderMessages(state.messages)}</div>
        <div class="row" style="margin-top:10px">
          <input id="msg" placeholder="Type message…"/><button id="btnSend" class="primary">Send</button>
        </div>
      </div>
    </div>`;
  }

  if(tab === "docs"){
    return `
    <div class="card padded">
      <div class="section-title"><span>Documents</span><span class="pill">vault-docs</span></div>
      <div class="row"><input id="file" type="file"/><button id="btnUpload" class="primary">Upload</button></div>
      <div id="fileList" class="list files" style="margin-top:12px">${renderFiles(state.files)}</div>
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
        <input id="sharePath" placeholder="Exact storage path e.g. file.pdf"/>
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
    <div class="card padded" style="max-width:520px">
      <div class="section-title"><span>Admin</span></div>
      <div class="col">
        <input id="adminUserEmail" type="email" placeholder="Promote user by email"/>
        <button id="btnMakeAdmin" class="primary">Make admin</button>
        <button id="btnOpenGuide" class="ghost">Open guide</button>
      </div>
    </div>`;
  }

  return `<div class="muted">Unknown tab.</div>`;
}

// ---------- small render helpers ----------
function renderGroups(groups){
  if(!groups || !groups.length) return `<div class="muted">No groups yet.</div>`;
  return groups.map(g=>`
    <div class="item">
      <div class="meta">
        <div class="title">${g.name}</div>
        <div class="sub">${new Date(g.created_at||Date.now()).toLocaleString()}</div>
      </div>
      <button class="btn" data-act="openGroup" data-gid="${g.id}">Open</button>
    </div>`).join("");
}

function renderChatList(groups, current){
  if(!groups || !groups.length) return `<div class="muted">No chats yet.</div>`;
  return groups.map(g=>`
    <div class="chatrow ${current?.id===g.id ? "active" : ""}" data-act="openGroup" data-gid="${g.id}">
      <div class="avatar">G</div>
      <div class="meta">
        <div class="title">${g.name}</div>
        <div class="sub">${new Date(g.created_at||Date.now()).toLocaleString()}</div>
      </div>
    </div>`).join("");
}

function renderMessages(msgs){
  if(!msgs || !msgs.length) return `<div class="muted">No messages.</div>`;
  return msgs.map(m=>`
    <div class="msg">
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
      <div class="meta"><div class="title">${f.name}</div></div>
      <div class="row">
        <button class="btn" data-act="share" data-key="${f.key}">Share</button>
        <button class="btn" data-act="download" data-key="${f.key}">Download</button>
        <button class="btn danger" data-act="delete" data-key="${f.key}">Delete</button>
      </div>
    </div>`).join("");
}

function escapeHtml(s=""){ return s.replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m])); }
