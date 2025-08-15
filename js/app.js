// =====================================================
// SECTION: IMPORTS & GLOBAL STATE
// =====================================================
import { loadSupabase } from "./supabase.js";
import { $, $all, toast, modal } from "./ui.js";
import { renderLogin, bindLogin, renderShell, bindShell, renderTab } from "./views.js";

let supa = null;
let state = {
  user: null,
  profile: null,
  tab: "home",            // default: HOME
  groups: [],
  currentGroup: null,
  messages: [],
  files: [],
  members: [],
  shares: []
};

// =====================================================
// SECTION: APP BOOTSTRAP (INIT & AUTH LISTENER)
// =====================================================
async function init(){
  supa = await loadSupabase();
  const { data: { session } } = await supa.auth.getSession();

  if (session?.user) {
    state.user = session.user;
    await loadProfile();
    renderApp();
    switchTab("home");     // go to HOME after load
  } else {
    renderLoginView();
  }

  supa.auth.onAuthStateChange((_event, session)=>{
    if (session?.user) {
      state.user = session.user;
      loadProfile().then(()=>{
        renderApp();
        switchTab("home"); // go to HOME after login
      });
    } else {
      state.user = null;
      document.body.innerHTML = renderLogin(onLogin);
      bindLogin(onLogin);
    }
  });
}

// =====================================================
// SECTION: AUTH UI (LOGIN VIEW)
// =====================================================
function renderLoginView(){
  document.body.innerHTML = renderLogin(onLogin);
  bindLogin(onLogin);
}

// =====================================================
// SECTION: AUTH ACTIONS (SIGN IN / OUT)
// =====================================================
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
// SECTION: PROFILE & ADMIN CHECK
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
    console.warn("loadProfile fallback (likely missing table/policy):", e?.message);
    state.profile = { id: state.user.id, full_name: state.user.email, is_admin: false };
  }
}

// =====================================================
// SECTION: APP SHELL RENDER & TAB WIRING
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
// SECTION: TAB SWITCH HANDLER
// =====================================================
async function switchTab(tab){
  state.tab = tab;

  // highlight active in sidebar + bottom nav
  $all("[data-nav]").forEach(n => n.classList.toggle("active", n.dataset.nav === tab));

  // render current tab + highlight any top pills
  $("#tabContent").innerHTML = renderTab(tab, state);
  $all(".tab").forEach(t=> t.classList.toggle("active", t.dataset.tab === tab));

  // ----- HOME (tiles + small dashboard) -----
  if (tab === "home") {
    // tiles nav
    $all("[data-nav]").forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.nav)));
    // quick actions in home grid
    $("#btnCreateGroup")?.addEventListener("click", createGroup);
    $("#btnSend")?.addEventListener("click", sendMessage);
    $("#groupList")?.addEventListener("click", (e)=>{
      const btn = e.target.closest("[data-act='openGroup']") || e.target.closest(".chatrow");
      if(!btn) return;
      const gid = btn.getAttribute("data-gid");
      openGroupById(gid);
    });
    await loadGroups();
  }

  // ----- CHATS -----
  if (tab === "chats") {
    $("#btnCreateGroup")?.addEventListener("click", createGroup);
    $("#btnSend")?.addEventListener("click", sendMessage);
    $("#chatArea")?.addEventListener("click", (e)=>{});
    $("#groupList")?.addEventListener("click", (e)=>{
      const btn = e.target.closest("[data-act='openGroup']") || e.target.closest(".chatrow");
      if(!btn) return;
      const gid = btn.getAttribute("data-gid");
      openGroupById(gid);
    });
    await loadGroups();
  }

  // ----- MOBILE CHAT DETAIL (WhatsApp-like) -----
  if (tab === "chat_detail") {
    $("#btnBackChats")?.addEventListener("click", ()=> switchTab("chats"));
    $("#btnSend")?.addEventListener("click", sendMessage);
  }

  // ----- DOCUMENTS -----
  if (tab === "docs") {
    $("#btnUpload")?.addEventListener("click", uploadFile);
    $("#fileList")?.addEventListener("click", onFilesAction);
    await listFiles();
  }

  // ----- MEMBERS -----
  if (tab === "members") {
    await loadMembers();
  }

  // ----- SHARE -----
  if (tab === "share") {
    $("#btnMakeLink")?.addEventListener("click", makeShare);
  }

  // ----- ADMIN -----
  if (tab === "admin") {
    $("#btnMakeAdmin")?.addEventListener("click", promoteAdmin);
    $("#btnOpenGuide")?.addEventListener("click", ()=> modal.open("#modalGuide"));
  }
}

// =====================================================
// SECTION: CHATS → OPEN GROUP (mobile full-screen / desktop inline)
// =====================================================
async function openGroupById(gid){
  state.currentGroup = (state.groups || []).find(g => g.id === gid) || null;
  await loadMessages();
  if (window.innerWidth < 980) {
    // WhatsApp-like: dedicated screen on mobile
    await switchTab("chat_detail");
  } else {
    // Desktop: keep current tab (home or chats) with messages pane updated
    if (state.tab !== "home" && state.tab !== "chats") {
      await switchTab("chats");
    } else {
      $("#tabContent").innerHTML = renderTab(state.tab, state);
      $("#btnSend")?.addEventListener("click", sendMessage);
    }
  }
}

// =====================================================
// SECTION: CHATS → GROUPS (LIST/CREATE)
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

  // re-render current tab (home or chats)
  $("#tabContent").innerHTML = renderTab(state.tab, state);
  $("#btnCreateGroup")?.addEventListener("click", createGroup);
  $("#btnSend")?.addEventListener("click", sendMessage);
  $("#groupList")?.addEventListener("click", (e)=>{
    const btn = e.target.closest("[data-act='openGroup']") || e.target.closest(".chatrow");
    if (!btn) return;
    const gid = btn.getAttribute("data-gid");
    openGroupById(gid);
  });
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
// SECTION: CHATS → MESSAGES (LIST/SEND)
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

  // re-render current tab (keeps Home dashboard if you're on Home)
  $("#tabContent").innerHTML = renderTab(state.tab, state);
  $("#btnCreateGroup")?.addEventListener("click", createGroup);
  $("#btnSend")?.addEventListener("click", sendMessage);
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
// SECTION: DOCUMENTS (LIST/UPLOAD/SHARE/DOWNLOAD/DELETE)
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

  // ---------- SHARE (Create code-gated viewer link) ----------
  if (act === "share") {
    try {
      const code = prompt("Set an access code (e.g. 6 letters/numbers):")?.trim();
      if (!code) { toast.show("No code set"); return; }

      const { data: { session } } = await supa.auth.getSession();
      const token = session?.access_token;
      if (!token) { toast.show("Sign in again"); return; }

      const seconds = 3600; // 1 hour window to redeem
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
        try { await navigator.clipboard.writeText(payload); } catch {/* ignore */}
      }
      alert(`✔ Share link created\n\n${viewerUrl}\n\nCode: ${code}\n(also copied if your browser allows)`);
      toast.show("Share link ready");
    } catch (err) {
      console.error("create gated share error:", err);
      toast.show(err?.message || "Share failed");
    }
    return;
  }

  // ---------- DOWNLOAD ----------
  if (act === "download") {
    const { data, error } = await supa.storage.from("vault-docs").createSignedUrl(key, 600);
    if (error) {
      console.error("download sign error:", error);
      toast.show(error.message || "Failed to sign");
      return;
    }
    window.open(data.signedUrl, "_blank");
    return;
  }

  // ---------- DELETE ----------
  if (act === "delete") {
    if (!confirm("Delete this file?")) return;
    const { error } = await supa.storage.from("vault-docs").remove([key]);
    if (error) {
      console.error("delete file error:", error);
      toast.show(error.message || "Delete failed");
      return;
    }
    toast.show("Deleted");
    await listFiles();
  }
}

// =====================================================
// SECTION: MEMBERS (LIST)
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
// SECTION: SHARE TAB (MANUAL SIGNED URL BY PATH)
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
// SECTION: ADMIN (PROMOTE USER PLACEHOLDER)
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

    // Security: promotions should be done via SQL/Edge Function (server-side).
    toast.show("Use Supabase SQL to promote users (frontend blocked).");
  }catch(e){
    console.error("promoteAdmin error:", e);
    toast.show(e?.message || "Update failed");
  }
}

// =====================================================
// SECTION: UTILITY — COPY TO CLIPBOARD (WITH SAFARI FALLBACK)
// =====================================================
async function copyToClipboard(text){
  if (navigator.clipboard && window.isSecureContext) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch(_) { /* fall back */ }
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

// =====================================================
// SECTION: UTILITIES (INVITE COPY)
// =====================================================
function copyInvite(){
  const txt = `Hey, welcome to VAULT.\nAsk the admin to create your account.\nThen sign in at our private URL.\nSecurity rules: no sharing passwords, use 2FA.`;
  navigator.clipboard.writeText(txt);
  toast.show("Invite note copied");
}
// ---- Push subscription (client side) ----
import { VAPID_PUBLIC_KEY } from "./config.js";

function urlBase64ToUint8Array(base64String){
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64); const out = new Uint8Array(raw.length);
  for (let i=0;i<raw.length;i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function enableNotifications(){
  try{
    if (!('serviceWorker' in navigator)) return toast.show("SW unsupported");
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return toast.show("Notifications blocked");

    const reg = await navigator.serviceWorker.ready;
    if (!VAPID_PUBLIC_KEY){ return toast.show("Set VAPID_PUBLIC_KEY in js/config.js"); }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    const payload = {
      user_id: state.user.id,
      endpoint: sub.endpoint,
      keys: sub.toJSON().keys
    };
    const { error } = await supa.from('push_subscriptions').upsert(payload, { onConflict: 'endpoint' });
    if (error) throw error;

    toast.show("Notifications enabled");
  }catch(e){
    console.error("enableNotifications:", e);
    toast.show(e?.message || "Enable failed");
  }
}


// =====================================================
// SECTION: INITIAL PLACEHOLDER & APP START
// =====================================================
document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh">
  <div class="card" style="padding:20px">
    <div class="row"><img src="assets/logo.svg" width="90" height="28"/><span class="pill">Loading</span></div>
  </div>
</div>`;

init();
