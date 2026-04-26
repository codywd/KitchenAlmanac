"use client";

import { useEffect, useState } from "react";

export function OnlineOnlySubmitButton({
  children,
  className,
  pending,
}: {
  children: React.ReactNode;
  className?: string;
  pending?: boolean;
}) {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    function updateOnlineState() {
      setOnline(navigator.onLine);
    }

    updateOnlineState();
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);

    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  return (
    <button
      className={className}
      disabled={pending || !online}
      title={online ? undefined : "Pantry changes need a connection."}
    >
      {children}
    </button>
  );
}
