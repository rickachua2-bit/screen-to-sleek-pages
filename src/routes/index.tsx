import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/auth" });
  },
  head: () => ({
    meta: [
      { title: "Slikpay — Business & Personal Banking" },
      { name: "description", content: "Slikpay: merchant settlement, NUBANs, virtual dollar cards and instant transfers." },
      { property: "og:title", content: "Slikpay — Business & Personal Banking" },
      { property: "og:description", content: "Merchant console and personal wallet in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
