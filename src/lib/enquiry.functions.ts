import { createServerFn } from "@tanstack/react-start";

const RESEND_URL = "https://api.resend.com/emails";
const FROM = "Slikcash <info@slikcash.com>";
const TO = "info@slikcash.com";

interface EnquiryInput {
  name: string;
  email: string;
  topic: string;
  message: string;
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export const sendEnquiry = createServerFn({ method: "POST" })
  .inputValidator((input: EnquiryInput) => input)
  .handler(async ({ data }) => {
    const name = clean(data?.name, 120);
    const email = clean(data?.email, 200);
    const topic = clean(data?.topic, 80) || "General support";
    const message = clean(data?.message, 4000);
    if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Please provide your name, a valid email and a message.");
    }
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("Email is not configured yet.");

    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        reply_to: email,
        subject: `[Slikcash ${topic}] ${name}`,
        text: [`Name: ${name}`, `Email: ${email}`, `Topic: ${topic}`, "", message].join("\n"),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Resend enquiry failed [${res.status}]: ${body}`);
      throw new Error("We couldn't send your message just now — please try again or email support@slikcash.com directly.");
    }
    return { sent: true };
  });
