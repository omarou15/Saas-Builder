import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "FYREN — Build it. Own it.",
  description:
    "FYREN is the AI app builder that deploys on YOUR infrastructure. GitHub, Vercel, Supabase — you own 100% of your code.",
  openGraph: {
    title: "FYREN — Build it. Own it.",
    description:
      "The AI app builder that deploys on your infra. Not ours.",
    siteName: "FYREN",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        // dark theme via variables below
        variables: {
          colorPrimary: "#f97316",
          colorBackground: "#0a0a0b",
          colorText: "#fafafa",
          colorInputBackground: "#141416",
          colorInputText: "#fafafa",
          borderRadius: "0.5rem",
          fontFamily: "var(--font-sans)",
        },
      }}
    >
      <html lang="en" className="dark">
        <body
          className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans antialiased`}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
