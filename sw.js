/* 树洞 Service Worker：静态缓存 + 离线兜底 + 推送监听（基础设施已就位） */
const CACHE = "shudong-v4";
const ASSETS = [
  "./", "./index.html", "./v2.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; /* Supabase 数据请求不拦截 */
  if (req.mode === "navigate") {
    /* 页面导航：网络优先，断网时用缓存 */
    e.respondWith(
      fetch(req)
        .then((res) => { const c = res.clone(); caches.open(CACHE).then((c2) => c2.put(req, c)); return res; })
        .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))
    );
    return;
  }
  /* 静态资源：缓存优先 */
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) { const c = res.clone(); caches.open(CACHE).then((c2) => c2.put(req, c)); }
          return res;
        })
    )
  );
});
/* 真·推送（手机通知）基础设施：等站长决定开启推送服务时使用 */
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch {}
  e.waitUntil(
    self.registration.showNotification(d.title || "树洞", {
      body: d.body || "有人来过树洞 🌙",
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      tag: d.tag || "shudong",
    })
  );
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then((ws) => (ws.length ? ws[0].focus() : self.clients.openWindow("./index.html")))
  );
});
