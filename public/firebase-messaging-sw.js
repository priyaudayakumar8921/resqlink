importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDCaT1VnbnOFiL8Tv4cyW3Zr2vpfNDf0GQ",
  authDomain: "resqlinkk.firebaseapp.com",
  projectId: "resqlinkk",
  storageBucket: "resqlinkk.firebasestorage.app",
  messagingSenderId: "711107693837",
  appId: "1:711107693837:web:cf573124ea72167240f444"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/vite.svg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
