// =====================================================
// IMPORTS & GLOBAL STATE
// =====================================================
import { loadSupabase } from "./supabase.js";
import { $, $all, toast, modal } from "./ui.js";
import { renderLogin, bindLogin, renderShell, bindShell, renderTab } from "./views.js";

let supa = null;
let state = {
  user: null,
  profile: null,
  tab: "home",
  groups: [],
  currentGroup: null,
  messages: [],
  files: [],
  members: [],
  shares: []
};

// =====================================================
// APP BOOTSTRAP (INIT & AUTH LISTENER)
// =====================================================
async function init(){
  supa = await loadSupabase();
  const { data: { session } } = await supa.auth.getSession();

  if (session?.user) {
    state.user = session.user;
    await loadProfile();
    renderApp();
    switchTab("home");
  } else {
    renderLoginView();
  }

  supa.auth.onAuthStateChange((_event, session)=>{
    if (session?.user) {
      state.user = session.user;
      loadProfile().then(()=>{
        renderApp();
        switchTab("home");
      });
    } else {
      state.user = null;
      document.body.innerHTML = renderLogin(onLogin);
      bindLogin(onLogin);
    }
  });
}

// =====================================================
// AUTH UI (LOGIN VIEW) + ACTIONS
// =====================================================
function renderLoginView(){
  document.body.innerHTML = renderLogin(onLogin);
  bindLogin(onLogin);
}

async function onLogin(email, password){
  try{
    const { error } = await supa.auth.signInWithPassword({ email, password });
    if (error) throw error;
    toast.show("Signed in");
  }catch(e){
    console.error("signIn error:", e);
    toast.show(e?.message || "Sign-in failed");
  }
}

async function signOut(){
  try {
    await supa.auth.signOut();
    toast.show("Signed out");
  } catch (e) {
    console.error("signOut error:", e);
    toast.show(e?.message || "Sign-out failed");
  }
}

// =====================================================
// PROFILE & ADMIN CHECK
// =====================================================
function isAdmin(){ return !!state.profile?.is_admin; }

async function loadProfile(){
  try{
    const { data, error } = await supa
      .from("profiles")
      .select("id, full_name, is_admin")
      .eq("id", state.user.id)
      .maybeSingle();
    if (error) throw error;
    state.profile = data || { id: state.user.id, full_name: state.user.email, is_admin: false };
  }catch(e){
    console.warn("loadProfile fallback:", e?.message);
    state.profile = { id: state.user.id, full_name: state.user.email, is_admin: false };
  }
}

// =====================================================
// APP SHELL RENDER
// =====================================================
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
  $("#btnGuide")?.addEventListener("click", ()=>{});
}

// =====================================================
// TAB SWITCH HANDLER
// =====================================================
async function switchTab(tab){
  state.tab = tab;

  // Highlight active in sidebar + bottom nav
  $all("[data-nav]").forEach(n => n.classList.toggle("active", n.dataset.nav === tab));

  // Render tab content
  $("#tabContent").innerHTML = renderTab(tab, state);

  // Generic nav inside content (tiles, back buttons)
  $all("[data-nav]").forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.nav)));

  // HOME
  if (tab === "home") {
    $("#btnCreateGroup")?.addEventListener("click", createGroup);
    $("#btnSend")?.addEventListener("click", sendMessage);
    $("#groupList")?.addEventListener("click", onGroupListClick);
    document.getElementById("qaInstall")?.addEventListener("click", installPWA);
    await loadGroups();
    return;
  }

  // CHATS
  if (tab === "chats") {
    $("#btnCreateGroup")?.addEventListener("click", createGroup);
    $("#btnSend")?.addEventListener("click", sendMessage);
    $("#groupList")?.addEventListener("click", onGroupListClick);
    await loadGroups();
    return;
  }

  // DOCS
  if (tab === "docs") {
    $("#btnUpload")?.addEventListener("click", uploadFile);
    $("#fileList")?.addEventListener("click", onFilesAction);
    await listFiles();
    return;
  }

  // MEMBERS
  if (tab === "members") {
    await loadMembers();
    return;
  }

  // SHARE
  if (tab === "share") {
    $("#btnMakeLink")?.addEventListener("click", makeShare);
    return;
  }

  // ADMIN
  if (tab === "admin") {
    $("#btnMakeAdmin")?.addEventListener("click", promoteAdmin);
    $("#btnOpenGuide")?.addEventListener("click", ()=> modal.open("#modalGuide"));
    return;
  }

  // Mobile dedicated chat screen
  if (tab === "chat_detail") {
    $("#btnSend")?.addEventListener("click", sendMessage);
    return;
  }
}

function onGroupListClick(e){
  const btn = e.target.closest("[data-act='openGroup']");
  if (!btn) return;
  const gid = btn.getAttribute("data-gid");
  openGroupById(gid);
}

async function openGroupById(gid){
  state.currentGroup = (state.groups || []).find(g => g.id === gid) || null;
  await loadMessages();
  if (window.innerWidth < 980) {
    await switchTab("chat_detail"); // mobile full-screen chat
  } else {
    $("#tabContent").innerHTML = renderTab(state.tab, state);
    $("#btnSend")?.addEventListener("click", sendMessage);
  }
}

// =====================================================
// CHATS → GROUPS (LIST/CREATE)
// =====================================================
async function loadGroups(){
  try{
    const { data, error } = await supa
      .from("groups")
      .select("id,name,created_at")
      .order("created_at", { ascending:false });
    if (error) throw error;
    state.groups = data || [];
  }catch(e){
    console.error("loadGroups error:", e);
    state.groups = [];
  }

  $("#tabContent").innerHTML = renderTab(state.tab, state);
  $("#btnCreateGroup")?.addEventListener("click", createGroup);
  $("#btnSend")?.addEventListener("click", sendMessage);
  $("#groupList")?.addEventListener("click", onGroupListClick);
}

async function createGroup(){
  const name = prompt("Group name?");
  if (!name) return;
  try{
    const { error } = await supa
      .from("groups")
      .insert({ name, created_by: state.user.id })
      .select()
      .single();
    if (error) throw error;
    toast.show("Group created");
    await loadGroups();
  }catch(e){
    console.error("createGroup error:", e);
    toast.show(e?.message || "Create failed");
  }
}

// =====================================================
// CHATS → MESSAGES (LIST/SEND)
// =====================================================
async function loadMessages(){
  if (!state.currentGroup) return;
  try{
    const { data, error } = await supa
      .from("messages")
      .select("id, content, created_at, sender_id")
      .eq("group_id", state.currentGroup.id)
      .order("created_at", { ascending:true });
    if (error) throw error;
    state.messages = (data || []).map(m=> ({ ...m, sender: m.sender_id?.slice(0,6) }));
  }catch(e){
    console.error("loadMessages error:", e);
    state.messages = [];
  }

  $("#tabContent").innerHTML = renderTab(state.tab, state);
  $("#btnCreateGroup")?.addEventListener("click", createGroup);
  $("#btnSend")?.addEventListener("click", sendMessage);
  $("#groupList")?.addEventListener("click", onGroupListClick);
}

async function sendMessage(){
  const input = $("#msg");
  const content = input?.value?.trim();
  if (!content || !state.currentGroup) return;
  try{
    const { error } = await supa
      .from("messages")
      .insert({ group_id: state.currentGroup.id, sender_id: state.user.id, content });
    if (error) throw error;
    if (input) input.value = "";
    await loadMessages();
  }catch(e){
    console.error("sendMessage error:", e);
    toast.show(e?.message || "Send failed");
  }
}

// =====================================================
// DOCUMENTS (LIST/UPLOAD/SHARE/DOWNLOAD/DELETE)
// =====================================================
async function listFiles(){
  try{
    const { data, error } = await supa.storage
      .from("vault-docs")
      .list("", { limit: 100, sortBy: { column: "created_at", order: "desc" }});
    if (error) throw error;
    state.files = (data || []).map(f=> ({ name: f.name, key: f.name }));
  }catch(e){
    console.error("listFiles error:", e);
    state.files = [];
  }

  $("#tabContent").innerHTML = renderTab("docs", state);
  $("#btnUpload")?.addEventListener("click", uploadFile);
  $("#fileList")?.addEventListener("click", onFilesAction);
}

async function uploadFile(){
  const f = $("#file")?.files?.[0];
  if (!f) { toast.show("Pick a file first"); return; }
  try{
    const path = f.name;
    const { error } = await supa.storage.from("vault-docs").upload(path, f, { upsert: true });
    if (error) throw error;
    toast.show("Uploaded");
    await listFiles();
  }catch(e){
    console.error("uploadFile error:", e);
    toast.show(e?.message || "Upload failed");
  }
}

async function onFilesAction(e){
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const key = btn.getAttribute("data-key");
  const act = btn.getAttribute("data-act");

  // SHARE (via Netlify function)
  if (act === "share") {
    try {
      const code = prompt("Set an access code (e.g. 6 letters/numbers):")?.trim();
      if (!code) { toast.show("No code set"); return; }

      const { data: { session } } = await supa.auth.getSession();
      const token = session?.access_token;
      if (!token) { toast.show("Sign in again"); return; }

      const seconds = 3600;
      const resp = await fetch("/.netlify/functions/createShare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ path: key, seconds, code })
      });
      const out = await resp.json();
      if (!resp.ok) throw new Error(out.error || "Failed to create share");

      const viewerUrl = out.viewerUrl;
      const payload = `Open: ${viewerUrl}\nCode: ${code}\nExpires in: 1h`;
      if (navigator.clipboard && window.isSecureContext) {
        try { await navigator.clipboard.writeText(payload); } catch {}
      }
      alert(`✔ Share link created\n\n${viewerUrl}\n\nCode: ${code}`);
      toast.show("Share link ready");
    } catch (err) {
      console.error("create gated share error:", err);
      toast.show(err?.message || "Share failed");
    }
    return;
  }

  // DOWNLOAD
  if (act === "download") {
    const { data, error } = await supa.storage.from("vault-docs").createSignedUrl(key, 600);
    if (error) { console.error("download sign error:", error); toast.show(error.message || "Failed to sign"); return; }
    window.open(data.signedUrl, "_blank");
    return;
  }

  // DELETE
  if (act === "delete") {
    if (!confirm("Delete this file?")) return;
    const { error } = await supa.storage.from("vault-docs").remove([key]);
    if (error) { console.error("delete file error:", error); toast.show(error.message || "Delete failed"); return; }
    toast.show("Deleted");
    await listFiles();
  }
}

// =====================================================
// MEMBERS (LIST)
// =====================================================
async function loadMembers(){
  try{
    const { data, error } = await supa
      .from("profiles")
      .select("id, full_name")
      .limit(100);
    if (error) throw error;
    state.members = (data || []);
  }catch(e){
    console.error("loadMembers error:", e);
    state.members = [];
  }
  $("#tabContent").innerHTML = renderTab("members", state);
}

// =====================================================
// SHARE TAB (MANUAL SIGNED URL BY PATH)
// =====================================================
async function makeShare(){
  const path = $("#sharePath").value.trim();
  const seconds = parseInt($("#expiry").value || "3600", 10);
  if (!path) { toast.show("Enter a storage object path"); return; }
  try{
    const { data, error } = await supa.storage.from("vault-docs").createSignedUrl(path, seconds);
    if (error) throw error;

    const code = Math.random().toString(36).slice(2,8).toUpperCase();
    const payload = `Link: ${data.signedUrl}\nCode: ${code}\nExpires in: ${seconds}s`;
    await navigator.clipboard.writeText(payload);

    const entry = { path, url: data.signedUrl, code, seconds };
    state.shares.unshift(entry);

    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `<span>${path}</span><span class="pill small">Copied</span>`;
    $("#shareList").prepend(el);

    toast.show("Share link copied");
  }catch(e){
    console.error("makeShare error:", e);
    toast.show(e?.message || "Failed to create signed URL");
  }
}

// =====================================================
// ADMIN (PROMOTE USER PLACEHOLDER)
// =====================================================
async function promoteAdmin(){
  const email = $("#adminUserEmail").value.trim();
  if (!email) return toast.show("Enter an email");
  try{
    const { data: me } = await supa
      .from("profiles")
      .select("is_admin")
      .eq("id", state.user.id)
      .maybeSingle();
    if (!me?.is_admin) { return toast.show("Admin only action"); }

    // Security: promotions should be done server-side.
    toast.show("Use Supabase SQL to promote users (frontend blocked).");
  }catch(e){
    console.error("promoteAdmin error:", e);
    toast.show(e?.message || "Update failed");
  }
}

// =====================================================
// UTILITIES
// =====================================================
async function copyToClipboard(text){
  if (navigator.clipboard && window.isSecureContext) {
    try { await navigator.clipboard.writeText(text); return true; } catch {}
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

function copyInvite(){
  const txt = `Hey, welcome to VAULT.\nAsk the admin to create your account.\nThen sign in at our private URL.\nSecurity rules: no sharing passwords, use 2FA.`;
  navigator.clipboard.writeText(txt);
  toast.show("Invite note copied");
}

// =====================================================
// INITIAL PLACEHOLDER & APP START
// =====================================================
document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh">
  <div class="card" style="padding:20px">
    <div class="row"><img src="/assets/logo.svg" width="90" height="28"/><span class="pill">Loading</span></div>
  </div>
</div>`;

init();

// =====================================================
// PWA INSTALL HANDLER (Desktop + Android; iOS uses "Add to Home Screen")
// =====================================================
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();            // stop the auto prompt
  deferredInstallPrompt = e;     // store it for our button
});

async function installPWA(){
  if (!deferredInstallPrompt) {
    alert('On iPhone: Share → "Add to Home Screen". On desktop: click the browser install icon.');
    return;
  }
  deferredInstallPrompt.prompt();
  try { await deferredInstallPrompt.userChoice; } catch {}
  deferredInstallPrompt = null;
}
