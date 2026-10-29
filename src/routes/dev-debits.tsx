import { createFileRoute } from "@tanstack/react-router";
import { DirectDebits } from "@/components/slikpay/DirectDebits";

export const Route = createFileRoute("/dev-debits")({
  component: () => <main className="mx-auto max-w-6xl p-6"><DirectDebits preview={{ debits: [] }} /></main>,
});
