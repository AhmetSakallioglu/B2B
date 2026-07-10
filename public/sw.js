function resolveTargetUrl(rawUrl) {
  if (!rawUrl) {
    return new URL("/admin", self.location.origin).href;
  }

  try {
    return new URL(rawUrl, self.location.origin).href;
  } catch {
    return new URL("/admin", self.location.origin).href;
  }
}

function resolveTargetPath(targetUrl) {
  try {
    return new URL(targetUrl).pathname;
  } catch {
    return "/admin";
  }
}

self.addEventListener("push", (event) => {
  let payload = {
    title: "Cabinetto Admin",
    body: "You have a new admin notification.",
    icon: "/logo/cabinetto.png",
    tag: "cabinetto-admin",
    url: "/admin",
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = {
        title: parsed.title || payload.title,
        body: parsed.body || payload.body,
        icon: parsed.icon || payload.icon,
        tag: parsed.tag || payload.tag,
        url: parsed.url || payload.url,
      };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }

  const targetUrl = resolveTargetUrl(payload.url);

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      tag: payload.tag,
      data: { url: targetUrl },
      badge: payload.icon,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = resolveTargetUrl(event.notification.data?.url);
  const targetPath = resolveTargetPath(targetUrl);

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (resolveTargetPath(client.url) === targetPath && "focus" in client) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
