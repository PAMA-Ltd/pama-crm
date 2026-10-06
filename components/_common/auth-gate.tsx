"use client";

import type { ReactNode } from "react";
import { SignInButton } from "@clerk/nextjs";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useQuery,
} from "convex/react";
import Button from "@/components/_ui/button";
import { getCrmAccessStatus } from "@/lib/convex/access";

function LoadingScreen() {
  return (
    <main className="bg-background text-foreground flex h-dvh items-center justify-center p-6">
      <p className="caption-style text-muted-foreground">Loading Pama CRM…</p>
    </main>
  );
}

function SignedInGate({ children }: { children: ReactNode }) {
  const access = useQuery(getCrmAccessStatus, {});

  if (access === undefined) {
    return <LoadingScreen />;
  }

  if (!access.authorized) {
    return (
      <main className="bg-background text-foreground flex h-dvh items-center justify-center p-6">
        <div className="border-border bg-card flex w-full max-w-md flex-col gap-3 rounded-xl border p-6">
          <h1>Access restricted</h1>
          <p className="text-muted-foreground text-sm">
            {access.email
              ? `${access.email} is signed in, but it is not on the Pama CRM access list.`
              : "This account does not have an email address that can be authorized."}
          </p>
        </div>
      </main>
    );
  }

  return children;
}

export default function AuthGate({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthLoading>
        <LoadingScreen />
      </AuthLoading>

      <Unauthenticated>
        <main className="bg-background text-foreground flex h-dvh items-center justify-center p-6">
          <div className="border-border bg-card flex w-full max-w-sm flex-col gap-5 rounded-xl border p-6">
            <div className="flex flex-col gap-1.5">
              <h1>Pama CRM</h1>
              <p className="text-muted-foreground text-sm">
                Sign in with an approved Pama account to continue.
              </p>
            </div>
            <SignInButton mode="modal">
              <Button variant="primary" size="md">
                Sign in
              </Button>
            </SignInButton>
          </div>
        </main>
      </Unauthenticated>

      <Authenticated>
        <SignedInGate>{children}</SignedInGate>
      </Authenticated>
    </>
  );
}
