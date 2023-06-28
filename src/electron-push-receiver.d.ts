interface ElectronPushReceiver {
    START_NOTIFICATION_SERVICE: string;
    NOTIFICATION_SERVICE_STARTED: string;
    NOTIFICATION_SERVICE_ERROR: string;
    STOP_NOTIFICATION_SERVICE: string;
    NOTIFICATION_RECEIVED: string;
    TOKEN_UPDATED: string;
    setup: () => void;
}

declare const electronPushReceiver: ElectronPushReceiver;
export = electronPushReceiver;
