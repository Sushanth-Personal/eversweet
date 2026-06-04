import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://eversweet.in"),
  title: "Eversweet — Handcrafted Mochi, Kochi",
  description:
    "Fresh mochi made daily in our Kochi cloud kitchen. Matcha, strawberry, dark chocolate and more. Order online for same-day delivery.",
  openGraph: {
    title: "Eversweet Mochi",
    description: "Handcrafted mochi, fresh from our cloud kitchen in Kochi.",
    images: ["/og.jpg"],
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
      </head>
      <body>
        {children}
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "x1p719fafw");`}
        </Script>
      </body>
    </html>
  );
}
