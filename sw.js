importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "AIzaSyBhzWWFFgrOH84J2RIW5o7l_8192iPtbOg",
  authDomain: "code-vibe-df610.firebaseapp.com",
  projectId: "code-vibe-df610",
  storageBucket: "code-vibe-df610.firebasestorage.app",
  messagingSenderId: "747762490655",
  appId: "1:747762490655:web:125516814620784cf3a42a"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification?.title || "MR GRAM", {
    body: payload.notification?.body || "Yangi xabar",
    icon: "/svg-icons/messenger.svg",
    badge: "/svg-icons/messenger.svg",
    vibrate: [200, 100, 200]
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});
