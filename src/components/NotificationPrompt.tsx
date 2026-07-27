"use client";

import { useEffect } from "react";

export function usePushNotifications() {
  useEffect(() => {
    const requestPermission = async () => {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        return;
      }

      const permission = Notification.permission;
      
      if (permission === "default") {
        try {
          const result = await Notification.requestPermission();
          if (result === "granted") {
            console.log("Notification permission granted");
          }
        } catch (error) {
          console.error("Notification permission error:", error);
        }
      }
    };

    requestPermission();
  }, []);
}

export default function NotificationPrompt() {
  usePushNotifications();
  return null;
}