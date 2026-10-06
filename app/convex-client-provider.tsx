"use client";

import { useState, type ReactNode } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;

    if (!url) {
      throw new Error(
        "NEXT_PUBLIC_CONVEX_URL is not set. Run `npx convex dev` and add the generated Convex URL to .env.local.",
      );
    }

    return new ConvexReactClient(url);
  });

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
