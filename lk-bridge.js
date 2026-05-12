/**
 * LeapKids LMS Bridge — lk-bridge.js
 * Shared by all pages: website, student LMS, and admin dashboard.
 * Uses localStorage + BroadcastChannel to sync data in real-time
 * across all open tabs/pages on the same origin.
 */
(function () {
  'use strict';

  const KEYS = {
    announcements : 'lk_announcements',
    certificates  : 'lk_certificates',
    notifications : 'lk_student_notifications',
    settings      : 'lk_platform_settings',
    pricing       : 'lk_pricing',
    programs      : 'lk_programs_active',
  };

  // ─── read/write helpers ───────────────────────────────────────────────────
  function read(key) {
    try { const v = localStorage.getItem(KEYS[key] || key); return v ? JSON.parse(v) : null; }
    catch { return null; }
  }
  function write(key, data) {
    try { localStorage.setItem(KEYS[key] || key, JSON.stringify(data)); }
    catch {}
  }

  // ─── BroadcastChannel ────────────────────────────────────────────────────
  let bc = null;
  try { bc = new BroadcastChannel('leapkids'); } catch {}

  function broadcast(type, data) {
    if (bc) try { bc.postMessage({ type, data, ts: Date.now() }); } catch {}
  }

  // ─── Public API ──────────────────────────────────────────────────────────
  window.LKBridge = {
    read,
    write,
    broadcast,

    // Student LMS helpers
    getAnnouncements() { return read('announcements') || []; },
    getCertificates()  { return read('certificates')  || []; },
    getNotifications() { return read('notifications') || []; },
    getSettings()      { return read('settings')      || {}; },
    getPricing()       { return read('pricing')       || { Starter:999, Explorer:1999, Innovator:2999 }; },

    // Admin push helpers
    pushAnnouncement(ann) {
      const list = this.getAnnouncements();
      ann.id  = ann.id  || 'a' + Date.now();
      ann.ts  = ann.ts  || new Date().toISOString();
      ann.new = true;
      list.unshift(ann);
      write('announcements', list);
      // Also push as a student notification
      const notifs = this.getNotifications();
      notifs.unshift({ id:'n'+Date.now(), type:'announcement', title: ann.title, body: ann.msg || ann.body || '', ts: ann.ts, read: false });
      write('notifications', notifs);
      broadcast('announcements', list);
      broadcast('notifications', notifs);
    },

    pushCertificate(cert) {
      const list = this.getCertificates();
      cert.id  = cert.id  || 'c' + Date.now();
      cert.ts  = cert.ts  || new Date().toISOString();
      cert.new = true;
      list.unshift(cert);
      write('certificates', list);
      // Student notification
      const notifs = this.getNotifications();
      notifs.unshift({ id:'n'+Date.now(), type:'certificate', title:'🎓 New Certificate!', body: cert.type==='badge' ? `You earned: ${cert.level}` : `Congratulations! ${cert.program} — ${cert.level}`, ts: cert.ts, read: false });
      write('notifications', notifs);
      broadcast('certificates', list);
      broadcast('notifications', notifs);
    },

    pushSettings(s) {
      write('settings', { ...this.getSettings(), ...s });
      broadcast('settings', this.getSettings());
    },

    pushPricing(p) {
      write('pricing', { ...this.getPricing(), ...p });
      broadcast('pricing', this.getPricing());
    },

    // Listen for admin changes and run callback
    onUpdate(callback) {
      if (bc) bc.onmessage = e => callback(e.data.type, e.data.data);
      window.addEventListener('storage', e => {
        const map = Object.fromEntries(Object.entries(KEYS).map(([k,v]) => [v,k]));
        if (map[e.key]) callback(map[e.key], JSON.parse(e.newValue || 'null'));
      });
    },

    // Count unread notifications
    unreadCount() { return this.getNotifications().filter(n => !n.read).length; },

    // Mark all read
    markAllRead() {
      const n = this.getNotifications().map(x => ({ ...x, read: true }));
      write('notifications', n);
      broadcast('notifications', n);
    },
  };
})();
