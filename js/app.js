import { loadSupabase } from "./supabase.js";
import { $, $all, toast, modal } from "./ui.js";
import { renderLogin, bindLogin, renderShell, bindShell, renderTab } from "./views.js";

let supa = null;
let state = {
  user: null,
  profile: null,
  tab: "chats",
  groups: [],
  currentGroup: null,
  messages: [],
  files: [],
  members: [],
  shares: []
};

async function init(){
  supa = await loadSupabase();
  const { data: { session } } = await supa.auth.getSession();
  if(session?.user){
    state.user = session.user;
    await loadProfile();
    renderApp();
    switchTab("chats");
  }else{
    renderLoginView();
  }
  // auth listener
  supa.auth.onAuthStateChange((_event, session)=>{
    if(session?.user){
      state.user = session.user;
      loadProfile().then(()=>{
        renderApp();
        switchTab("chats");
      });
    }else{
      state.user = null;
      document.body.innerHTML = renderLogin(onLogin);
      bindLogin(onLogin);
    }
  });
}

function renderLoginView(){
  document.body.innerHTML = renderLogin(onLogin);
  bindLogin(onLogin);
}

async function onLogin(email, password){
  try{
    const { data, error } = await supa.auth.signInWithPassword({ email, password });
    if(error) throw error;
    toast.show("Signed in");
  }catch(e){
    toast.show(e.message || "Sign-in failed");
  }
}

function isAdmin(){ return !!state.profile?.is_admin; }

async function loadProfile(){
  try{
    const { data, error } = await supa.from("profiles").select("id, full_name, is_admin").eq("id", state.user.id).maybeSingle();
    if(error) throw error;
    state.profile = data || { id: state.user.id, full_name: state.user.email, is_admin: false };
  }catch(e){
    // Table may not exist yet
    state.profile = { id: state.user.id, full_name: state.user.email, is_admin: false };
  }
}

function renderApp(){
  document.body.innerHTML = `
    ${renderShell(state.user, isAdmin())}
    <div id="toast" class="toast"></div>
  `;
  bindShell({
    signOut,
    switchTab,
    newGroup: ()=> $("#btnCreateGroup")?.click(),
    copyInvite: copyInvite
  });
  // Show guide modal first time for admins
  $("#btnGuide")?.addEventListener("click", ()=>{});
}

async function signOut(){
  await supa.auth.signOut();
  toast.show("Signed out");
}

async function switchTab(tab){
  state.tab = tab;
  $("#tabContent").innerHTML = renderTab(tab, state);
  $all(".tab").forEach(t=> t.classList.toggle("active", t.dataset.tab===tab));

  if(tab === "chats"){
    $("#btnCreateGroup")?.addEventListener("click", createGroup);
    $("#btnSend")?.addEventListener("click", sendMessage);
    $("#chatArea")?.addEventListener("click", (e)=>{});
    await loadGroups();
  }
  if(tab === "docs"){
    $("#btnUpload")?.addEventListener("click", uploadFile);
    $("#fileList")?.addEventListener("click", onFilesAction);
    await listFiles();
  }
  if(tab === "members"){
    await loadMembers();
  }
  if(tab === "share"){
    $("#btnMakeLink")?.addEventListener("click", makeShare);
  }
  if(tab === "admin"){
    $("#btnMakeAdmin")?.addEventListener("click", promoteAdmin);
    $("#btnOpenGuide")?.addEventListener("click", ()=> modal.open("#modalGuide"));
  }
}

async function loadGroups(){
  try{
    const { data, error } = await supa.from("groups").select("id,name").order("created_at", { ascending:false });
    if(error) throw error;
    state.groups = data || [];
  }catch(e){
    state.groups = [];
  }
  $("#tabContent").innerHTML = renderTab("chats", state);
  $("#btnCreateGroup")?.addEventListener("click", createGroup);
  $("#btnSend")?.addEventListener("click", sendMessage);
  $("#groupList")?.addEventListener("click", (e)=>{
    const btn = e.target.closest("[data-act='openGroup']");
    if(btn){
      const gid = btn.getAttribute("data-gid");
      state.currentGroup = state.groups.find(g=> g.id===gid);
      loadMessages();
    }
  });
}

async function createGroup(){
  const name = prompt("Group name?");
  if(!name) return;
  try{
    const { data, error } = await supa.from("groups").insert({ name, created_by: state.user.id }).select().single();
    if(error) throw error;
    toast.show("Group created");
    await loadGroups();
  }catch(e){
    toast.show("Create failed (tables/policies missing?)");
  }
}

async function loadMessages(){
  if(!state.currentGroup){ return; }
  try{
    const { data, error } = await supa.from("messages").select("id, content, created_at, sender_id").eq("group_id", state.currentGroup.id).order("created_at", { ascending:true });
    if(error) throw error;
    state.messages = (data||[]).map(m=> ({ ...m, sender: m.sender_id?.slice(0,6) }));
  }catch(e){
    state.messages = [];
  }
  $("#tabContent").innerHTML = renderTab("chats", state);
  $("#btnCreateGroup")?.addEventListener("click", createGroup);
  $("#btnSend")?.addEventListener("click", sendMessage);
}

async function sendMessage(){
  const input = $("#msg");
  const content = input.value.trim();
  if(!content || !state.currentGroup) return;
  try{
    const { error } = await supa.from("messages").insert({ group_id: state.currentGroup.id, sender_id: state.user.id, content });
    if(error) throw error;
    input.value = "";
    await loadMessages();
  }catch(e){
    toast.show("Send failed (tables/policies missing?)");
  }
}

async function listFiles(){
  try{
    const { data, error } = await supa.storage.from("vault-docs").list("", { limit: 100, sortBy: { column: "created_at", order: "desc" }});
    if(error) throw error;
    state.files = (data||[]).map(f=> ({ name: f.name, key: f.name }));
  }catch(e){
    state.files = [];
  }
  $("#tabContent").innerHTML = renderTab("docs", state);
  $("#btnUpload")?.addEventListener("click", uploadFile);
  $("#fileList")?.addEventListener("click", onFilesAction);
}

async function uploadFile(){
  const f = $("#file").files?.[0];
  if(!f){ toast.show("Pick a file first"); return; }
  try{
    const path = f.name;
    const { error } = await supa.storage.from("vault-docs").upload(path, f, { upsert: true });
    if(error) throw error;
    toast.show("Uploaded");
    await listFiles();
  }catch(e){
    toast.show("Upload failed (bucket/policies missing?)");
  }
}

async function onFilesAction(e){
  const btn = e.target.closest("[data-act]");
  if(!btn) return;
  const key = btn.getAttribute("data-key");
  const act = btn.getAttribute("data-act");
  if(act==="share"){
    const { data, error } = await supa.storage.from("vault-docs").createSignedUrl(key, 3600);
    if(error){ toast.show("Failed to sign"); return; }
    const url = data?.signedUrl;
    const code = Math.random().toString(36).slice(2,8).toUpperCase();
    const payload = `Link: ${url}\nCode: ${code}\nExpires: 1h`;
    navigator.clipboard.writeText(payload);
    toast.show("Signed link + code copied");
  }
  if(act==="download"){
    const { data, error } = await supa.storage.from("vault-docs").createSignedUrl(key, 600);
    if(error){ toast.show("Failed to sign"); return; }
    window.open(data.signedUrl, "_blank");
  }
  if(act==="delete"){
    if(!confirm("Delete this file?")) return;
    const { error } = await supa.storage.from("vault-docs").remove([key]);
    if(error){ toast.show("Delete failed"); return; }
    toast.show("Deleted");
    await listFiles();
  }
}

async function loadMembers(){
  try{
    const { data, error } = await supa.from("profiles").select("id, full_name").limit(100);
    if(error) throw error;
    state.members = (data||[]);
  }catch(e){
    state.members = [];
  }
  $("#tabContent").innerHTML = renderTab("members", state);
}

async function makeShare(){
  const path = $("#sharePath").value.trim();
  const seconds = parseInt($("#expiry").value || "3600", 10);
  if(!path){ toast.show("Enter a storage object path"); return; }
  try{
    const { data, error } = await supa.storage.from("vault-docs").createSignedUrl(path, seconds);
    if(error) throw error;
    const code = Math.random().toString(36).slice(2,8).toUpperCase();
    const payload = `Link: ${data.signedUrl}\nCode: ${code}\nExpires in: ${seconds}s`;
    navigator.clipboard.writeText(payload);
    const entry = { path, url: data.signedUrl, code, seconds };
    state.shares.unshift(entry);
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `<span>${path}</span><span class="pill small">Copied</span>`;
    $("#shareList").prepend(el);
    toast.show("Share link copied");
  }catch(e){
    toast.show("Failed to create signed URL (bucket/policies?)");
  }
}

async function promoteAdmin(){
  const email = $("#adminUserEmail").value.trim();
  if(!email) return toast.show("Enter an email");
  try{
    // NOTE: Requires RLS policy allowing admin to update others
    const { data: me } = await supa.from("profiles").select("is_admin").eq("id", state.user.id).maybeSingle();
    if(!me?.is_admin){ return toast.show("Admin only action"); }
    const { data, error } = await supa.from("profiles").update({ is_admin: true }).eq("id", supa.sql`(select id from auth.users where email=${email})`);
    if(error) throw error;
    toast.show("Promoted (if user exists)");
  }catch(e){
    toast.show("Update failed (policy?)");
  }
}

function copyInvite(){
  const txt = `Hey, welcome to VAULT.\nAsk the admin to create your account.\nThen sign in at our private URL.\nSecurity rules: no sharing passwords, use 2FA.`;
  navigator.clipboard.writeText(txt);
  toast.show("Invite note copied");
}

// initial render placeholder
document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh">
  <div class="card" style="padding:20px">
    <div class="row"><img src="assets/logo.svg" width="90" height="28"/><span class="pill">Loading</span></div>
  </div>
</div>`;

init();
