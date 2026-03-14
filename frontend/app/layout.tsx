import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Art Protocol OS",
  description: "AI Agency Operations System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <script src="https://checkout.razorpay.com/v1/checkout.js" async />
      </head>
      <body className="bg-[#0a0a0a] text-[#f0f0f0] min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
