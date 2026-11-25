export interface OneSignalClient {
  init(options: {
    appId: string;
    serviceWorkerPath: string;
    serviceWorkerParam: { scope: string };
    welcomeNotification: { disable: boolean };
  }): Promise<void>;
  login(externalId: string): Promise<void>;
  User: {
    PushSubscription: {
      optedIn: boolean;
      optIn(): Promise<void> | void;
      optOut(): Promise<void> | void;
    };
  };
  Notifications: {
    isPushSupported(): boolean;
    permission: boolean;
  };
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(client: OneSignalClient) => void>;
  }
}

let oneSignalPromise: Promise<OneSignalClient> | null = null;

export function initializeOneSignal(): Promise<OneSignalClient> {
  const appId = import.meta.env.VITE_ONESIGNAL_APP_ID;
  if (!appId) return Promise.reject(new Error("OneSignal non configurato."));
  if (oneSignalPromise) return oneSignalPromise;

  oneSignalPromise = new Promise((resolve, reject) => {
    const deferred = window.OneSignalDeferred ?? [];
    window.OneSignalDeferred = deferred;
    deferred.push(async (client) => {
      try {
        await client.init({
          appId,
          serviceWorkerPath: "push/onesignal/OneSignalSDKWorker.js",
          serviceWorkerParam: { scope: "/push/onesignal/" },
          welcomeNotification: { disable: true },
        });
        resolve(client);
      } catch (error) {
        oneSignalPromise = null;
        reject(error);
      }
    });

    if (!document.querySelector('script[data-onesignal-sdk="true"]')) {
      const script = document.createElement("script");
      script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
      script.defer = true;
      script.dataset.onesignalSdk = "true";
      script.onerror = () => {
        oneSignalPromise = null;
        script.remove();
        reject(new Error("Impossibile caricare OneSignal."));
      };
      document.head.appendChild(script);
    }
  });

  return oneSignalPromise;
}
