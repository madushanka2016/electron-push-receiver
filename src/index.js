const { register, listen } = require('push-receiver-v2');
const { ipcMain } = require('electron');
const Store = require('electron-store');
const {
  START_NOTIFICATION_SERVICE,
  NOTIFICATION_SERVICE_STARTED,
  NOTIFICATION_SERVICE_ERROR,
  STOP_NOTIFICATION_SERVICE,
  NOTIFICATION_RECEIVED,
  TOKEN_UPDATED,
} = require('./constants');

const store = new Store();

module.exports = {
  START_NOTIFICATION_SERVICE,
  NOTIFICATION_SERVICE_STARTED,
  NOTIFICATION_SERVICE_ERROR,
  STOP_NOTIFICATION_SERVICE,
  NOTIFICATION_RECEIVED,
  TOKEN_UPDATED,
  setup,
};

// To be sure that start is called only once
let started = false;

//  used as a ref to client instance
let client;

// used as a ref to username for electron store
let userId;

// To be call from the main process
function setup() {
  // Will be called by the renderer process
  ipcMain.on(START_NOTIFICATION_SERVICE, async ({ sender: webContents }, { firebaseConfig, user }) => {
    userId = user;
    // Retrieve saved credentials
    let credentials = store.get(`${userId}-credentials`);
    // Retrieve saved senderId
    const savedSenderId = store.get(`${userId}-senderId`);
    if (started) {
      webContents.send(NOTIFICATION_SERVICE_STARTED, (credentials.fcm || {}).token);
      return;
    }
    started = true;
    try {
      // Retrieve saved persistentId : avoid receiving all already received notifications on start
      const persistentIds = store.get(`${userId}-persistentIds`) || [];
      // Register if no credentials or if senderId has changed
      if (!credentials || savedSenderId !== firebaseConfig.senderId) {
        credentials = await register(firebaseConfig);
        // Save credentials for later use
        store.set(`${userId}-credentials`, credentials);
        // Save senderId
        store.set(`${userId}-senderId`, firebaseConfig.senderId);
        // Notify the renderer process that the FCM token has changed
        webContents.send(TOKEN_UPDATED, credentials.fcm.token);
      }
      // Listen for GCM/FCM notifications
      client = await listen(
        Object.assign({}, credentials, { persistentIds }),
        onNotification(webContents),
      );
      // Notify the renderer process that we are listening for notifications
      webContents.send(NOTIFICATION_SERVICE_STARTED, credentials.fcm.token);
    } catch (e) {
      console.error('PUSH_RECEIVER:::Error while starting the service', e);
      // Forward error to the renderer process
      webContents.send(NOTIFICATION_SERVICE_ERROR, e.message);
    }
  });

  ipcMain.on(STOP_NOTIFICATION_SERVICE, () => {
    // destroy push notifications service
    if (client !== undefined) {
      client.destroy();
    }
    started = false;
  });
}

// Will be called on new notification
function onNotification(webContents) {
  return ({ notification, persistentId }) => {
    const persistentIds = store.get(`${userId}-persistentIds`) || [];
    // Update persistentId
    store.set(`${userId}-persistentIds`, [...persistentIds, persistentId]);
    // Notify the renderer process that a new notification has been received
    // And check if window is not destroyed for darwin Apps
    if (!webContents.isDestroyed()) {
      webContents.send(NOTIFICATION_RECEIVED, notification);
    } else {
      console.warn('PUSH_RECEIVER:::Web Content is destroyed. Message will not be sent');
    }
  };
}
