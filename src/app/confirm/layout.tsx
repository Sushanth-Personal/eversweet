import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Confirm your Eversweet order",
  description: "Click here to confirm your box, flavours and delivery details.",
  openGraph: {
    title: "Confirm your Eversweet order",
    description: "Click here to choose your box, flavours and delivery details.",
    url: "/confirm",
    siteName: "Eversweet",
    type: "website",
    images: [
      {
        url: "/confirm/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Eversweet — Click here to confirm your order",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Confirm your Eversweet order",
    description: "Click here to choose your box, flavours and delivery details.",
    images: ["/confirm/opengraph-image"],
  },
};

export default function ConfirmLayout({ children }: { children: React.ReactNode }) {
  return children;
}
