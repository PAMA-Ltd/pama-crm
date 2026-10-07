import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import { Geist } from "next/font/google";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, pageMetadata } from "@/lib/seo";
import ScrollToTop from "@/components/_common/scroll-to-top";
import { ConvexClientProvider } from "@/app/convex-client-provider";
import { SIDEBAR_WIDTH_SCRIPT } from "@/lib/sidebar";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  ...pageMetadata({
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    path: "/",
  }),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={geist.variable}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `history.scrollRestoration="manual";${SIDEBAR_WIDTH_SCRIPT}`,
          }}
        />
      </head>
      <body className="relative z-0 font-sans antialiased">
        <ClerkProvider appearance={{ theme: shadcn }}>
          <ConvexClientProvider>
            <ScrollToTop />
            {children}
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
