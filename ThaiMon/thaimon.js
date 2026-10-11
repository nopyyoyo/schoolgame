/* ThaiMon shared library — Supabase client, auth, hashing, session */
window.ThaiMon = (function () {
  'use strict';

  var SUPABASE_URL = 'https://pbomxjysvrfycanjfizx.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_NUyKjkiIxycpTFnPXjRrag_aLqpwuvk';

  var sb = null;
  function client() {
    if (!sb) {
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return sb;
  }

  /* ---------- password hashing (SHA-256 + salt, via Web Crypto) ---------- */
  function makeSalt() {
    var arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  async function hashPassword(password, salt) {
    var data = new TextEncoder().encode(salt + '::' + password);
    var digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  /* ---------- session (sessionStorage — safer on shared devices) ---------- */
  var SESSION_KEY = 'thaimon_player_id';
  function setSession(playerId) {
    sessionStorage.setItem(SESSION_KEY, playerId);
  }
  function getSession() {
    return sessionStorage.getItem(SESSION_KEY);
  }
  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }
  function requireSession() {
    var pid = getSession();
    if (!pid) {
      window.location.href = 'index.html';
      return null;
    }
    return pid;
  }

  /* ---------- player API ---------- */
  async function getPlayer(playerId) {
    var res = await client().from('thaimon_players').select('*').eq('id', playerId).single();
    if (res.error) throw res.error;
    return res.data;
  }

  async function signup(username, password, inviteCode) {
    username = (username || '').trim();
    inviteCode = (inviteCode || '').trim();
    if (username.length < 3 || username.length > 20) throw new Error('ชื่อผู้ใช้ต้องมี 3–20 ตัวอักษร');
    if (password.length < 4) throw new Error('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร');

    // username taken?
    var existing = await client().from('thaimon_players').select('id').eq('username', username).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) throw new Error('ชื่อผู้ใช้นี้มีคนใช้แล้ว');

    // invite code valid & unused?
    var code = await client().from('thaimon_invite_codes').select('code, used_by, reusable, active').eq('code', inviteCode).maybeSingle();
    if (code.error) throw code.error;
    if (!code.data) throw new Error('รหัสเชิญไม่ถูกต้อง');
    if (code.data.reusable) {
      if (!code.data.active) throw new Error('รหัสเชิญนี้ถูกปิดใช้งาน');
      // reusable: stays valid for the next player
    } else {
      if (code.data.used_by) throw new Error('รหัสเชิญนี้ถูกใช้ไปแล้ว');
    }

    // create player
    var salt = makeSalt();
    var hash = await hashPassword(password, salt);
    var ins = await client().from('thaimon_players').insert({
      username: username,
      password_hash: hash,
      password_salt: salt,
      display_name: username,
      pokeballs: 0,
      gachapons: 0
    }).select('id').single();
    if (ins.error) throw ins.error;

    // mark invite code used (one-time codes only)
    if (!code.data.reusable) {
      var upd = await client().from('thaimon_invite_codes').update({
        used_by: ins.data.id,
        used_at: new Date().toISOString()
      }).eq('code', inviteCode);
      if (upd.error) throw upd.error;
    }

    // grant default avatars (boy/girl) and set boy as the starting avatar
    var avs = await client().from('thaimon_avatars').select('id').eq('is_default', true);
    if (avs.error) throw avs.error;
    var rows = (avs.data || []).map(function (a) {
      return { player_id: ins.data.id, avatar_id: a.id };
    });
    if (rows.length) {
      var g = await client().from('thaimon_player_avatars').insert(rows);
      if (g.error) throw g.error;
      var d = await client().from('thaimon_players').update({ avatar_id: 'boy' }).eq('id', ins.data.id);
      if (d.error) throw d.error;
    }

    setSession(ins.data.id);
    return ins.data.id;
  }

  async function signin(username, password) {
    username = (username || '').trim();
    var res = await client().from('thaimon_players').select('id, password_hash, password_salt').eq('username', username).maybeSingle();
    if (res.error) throw res.error;
    if (!res.data) throw new Error('ไม่พบชื่อผู้ใช้นี้');
    var hash = await hashPassword(password, res.data.password_salt);
    if (hash !== res.data.password_hash) throw new Error('รหัสผ่านไม่ถูกต้อง');
    setSession(res.data.id);
    return res.data.id;
  }

  /* Show on-screen help to re-enable a blocked microphone.
     Resolves true if the user wants to retry, false if they give up. */
  function showMicHelp() {
    return new Promise(function (resolve) {
      var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      var steps = isIOS
        ? '<b>วิธีเปิดบน iPhone:</b><br>' +
          '1. เปิดแอป <b>"การตั้งค่า"</b> ของ iPhone<br>' +
          '2. เลือก <b>Safari</b> → <b>ไมโครโฟน</b><br>' +
          '3. เลือก <b>"อนุญาต"</b><br>' +
          '4. กลับมา Safari กด "🔄 ลองอีกครั้ง" ด้านล่าง'
        : '<b>วิธีเปิด:</b><br>' +
          '1. แตะไอคอน 🎚️ <b>ด้านซ้ายของแถบที่อยู่</b><br>' +
          '&nbsp;&nbsp;&nbsp;&nbsp;(ไอคอนเล็กๆ ข้างหน้าชื่อเว็บด้านบน)<br>' +
          '2. เลือก "การตั้งค่าไซต์"<br>' +
          '3. แตะ "ไมโครโฟน" แล้วเลือก "อนุญาต"<br>' +
          '4. กลับมาที่หน้านี้ กด "🔄 ลองอีกครั้ง" ด้านล่าง';
      var ov = document.createElement('div');
      ov.setAttribute('style',
        'position:fixed;inset:0;z-index:99;background:rgba(30,15,45,.88);' +
        'display:grid;place-items:center;padding:20px;');
      ov.innerHTML =
        '<div style="background:#fffdf4;border-radius:20px;border:4px solid #e45826;' +
        'padding:20px 18px;max-width:340px;width:100%;text-align:center;' +
        'font-family:Tahoma,sans-serif;color:#14213d">' +
        '<div style="font-size:2.6rem">🎤</div>' +
        '<div style="font-size:1.2rem;font-weight:bold;margin:.3rem 0">ไมโครโฟนถูกปิดอยู่</div>' +
        '<div style="font-size:.92rem;color:#52647a;text-align:left;line-height:1.9">' +
        steps +
        '</div>' +
        '<div style="display:flex;gap:10px;justify-content:center;margin-top:14px">' +
        '<button id="micRetryBtn" type="button" style="font-family:inherit;font-weight:bold;font-size:1rem;' +
        'background:#2e7d32;color:#fff;border:none;border-radius:999px;padding:.6rem 1.4rem;cursor:pointer">🔄 ลองอีกครั้ง</button>' +
        '<button id="micCloseBtn" type="button" style="font-family:inherit;font-weight:bold;font-size:1rem;' +
        'background:#9e9e9e;color:#fff;border:none;border-radius:999px;padding:.6rem 1.4rem;cursor:pointer">ปิด</button>' +
        '</div></div>';
      document.body.appendChild(ov);
      ov.querySelector('#micRetryBtn').addEventListener('click', function () {
        ov.remove();
        resolve(true);
      });
      ov.querySelector('#micCloseBtn').addEventListener('click', function () {
        ov.remove();
        resolve(false);
      });
    });
  }

  return {
    client: client,
    hashPassword: hashPassword,
    makeSalt: makeSalt,
    setSession: setSession,
    getSession: getSession,
    clearSession: clearSession,
    requireSession: requireSession,
    getPlayer: getPlayer,
    signup: signup,
    signin: signin,
    showMicHelp: showMicHelp
  };
})();
