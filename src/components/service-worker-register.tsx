"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const warmShoppingPageCache = () => {
      if (/^\/weeks\/[^/]+\/shopping\/?$/.test(window.location.pathname)) {
        fetch(window.location.href, {
          cache: "reload",
          credentials: "same-origin",
        }).catch(() => {
          // The IndexedDB snapshot still supports the already-open page.
        });
      }
    };

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => navigator.serviceWorker.ready)
        .then(warmShoppingPageCache)
        .catch(() => {
          // Offline shopping still works online without service worker support.
        });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register, { once: true });

    return () => {
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}
