import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { LinkStatus } from "./checkout-links.server";

export const TAG_CURRENCIES = ["NGN", "USD", "EUR", "GBP", "GHS", "KES", "ZAR"] as const;
export const TAG_OP = "SMARTTAG";
export const TAG_CHARGE_OP = "SMARTTAG-CHARGE";
export const SOUNDBOX_OP = "SOUNDBOX";
export const SOUNDBOX_VOICES = ["English", "Pidgin", "Hausa", "Yorùbá", "Igbo"] as const;

export interface SmartTagView {
  handle: string;
  name: string;
  amount: number | null;
  currency: string;
  checkoutUrl: string | null;
  createdAt: string;
}

export interface TagChargeView {
  reference: string;
  url: string;
  amount: number;
  currency: string;
  handle: string;
  createdAt: string;
  status: LinkStatus;
}

export interface SoundboxView {
  deviceId: string;
  label: string;
  handle: string;
  voice: string;
  createdAt: string;
}

const HANDLE = /^[a-z0-9][a-z0-9-]{1,29}$/;

const createSchema = z.object({
  handle: z.string().trim().toLowerCase().regex(HANDLE, "Use 2-30 lowercase letters, numbers or dashes."),
  name: z.string().trim().min(2).max(80),
  amount: z.number().positive().max(1e9).optional(),
  currency: z.enum(TAG_CURRENCIES),
  email: z.string().email().max(160),
});

const chargeSchema = z.object({
  handle: z.string().trim().toLowerCase().regex(HANDLE),
  amount: z.number().positive().max(1e9),
  email: z.string().email().max(160).optional(),
  reference: z.string().regex(/^SLKTAG-[0-9a-fA-F-]{36}$/),
});

const DEVICE_ID = /^[A-Z0-9][A-Z0-9-]{3,23}$/;

const soundboxSchema = z.object({
  deviceId: z.string().trim().toUpperCase().regex(DEVICE_ID, "Use 4-24 capital letters, numbers or dashes."),
  label: z.string().trim().min(2).max(60),
  handle: z.string().trim().toLowerCase().regex(HANDLE),
  voice: z.enum(SOUNDBOX_VOICES),
});

const soundboxUpdateSchema = z.object({
  deviceId: z.string().trim().toUpperCase().regex(DEVICE_ID),
  label: z.string().trim().min(2).max(60),
  voice: z.enum(SOUNDBOX_VOICES),
});

const soundboxDeleteSchema = z.object({ deviceId: z.string().trim().toUpperCase().regex(DEVICE_ID) });

function parseTag(raw: string): SmartTagView | null {
  try {
    const v = JSON.parse(raw) as Partial<SmartTagView>;
    if (typeof v.handle !== "string" || typeof v.name !== "string" || typeof v.currency !== "string") return null;
    return {
      handle: v.handle,
      name: v.name,
      amount: typeof v.amount === "number" ? v.amount : null,
      currency: v.currency,
      checkoutUrl: typeof v.checkoutUrl === "string" ? v.checkoutUrl : null,
      createdAt: typeof v.createdAt === "string" ? v.createdAt : "",
    };
  } catch { return null; }
}

function parseSoundbox(raw: string): SoundboxView | null {
  try {
    const v = JSON.parse(raw) as Partial<SoundboxView>;
    if (typeof v.deviceId !== "string" || typeof v.label !== "string" || typeof v.handle !== "string") return null;
    return {
      deviceId: v.deviceId,
      label: v.label,
      handle: v.handle,
      voice: typeof v.voice === "string" ? v.voice : "English",
      createdAt: typeof v.createdAt === "string" ? v.createdAt : "",
    };
  } catch { return null; }
}

function parseCharge(raw: string): TagChargeView | null {
  try {
    const v = JSON.parse(raw) as Partial<TagChargeView>;
    if (typeof v.reference !== "string" || typeof v.url !== "string" || typeof v.amount !== "number" || typeof v.handle !== "string") return null;
    return {
      reference: v.reference, url: v.url, amount: v.amount,
      currency: typeof v.currency === "string" ? v.currency : "NGN",
      handle: v.handle,
      createdAt: typeof v.createdAt === "string" ? v.createdAt : "",
      status: "unknown",
    };
  } catch { return null; }
}

/** Public tag URL customers can be shown; charges resolve to real hosted checkout pages. */
export function tagUrl(handle: string): string {
  return `https://pay.slikpay.africa/@${handle}`;
}

export const createSmartTag = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data }): Promise<SmartTagView> => {
    const { bankingUser } = await import("./paddle.server");
    const { hostedCheckout } = await import("./checkout-links.server");
    const { db, user, mode, review } = await bankingUser();
    if (mode === "live" && review !== "approved") throw new Error("Complete verification before creating live SmartTags.");
    // Handles are unique per mode across the platform.
    const taken = await db.from("paddle_resources").select("user_id").eq("mode", mode).eq("operation", `${TAG_OP} ${data.handle}`).maybeSingle();
    if (taken.error) throw new Error("Could not check that tag name. Try again.");
    if (taken.data) throw new Error("That tag name is already taken. Choose another.");
    let checkoutUrl: string | null = null;
    if (data.amount) {
      // Fixed-amount tags get a real hosted checkout up front so the QR works immediately.
      const ref = `SLKTAG-${crypto.randomUUID()}`;
      const r = await hostedCheckout(db, user, mode, {
        amount: data.amount, currency: data.currency, email: data.email, name: data.name,
        reference: ref, operation: `${TAG_CHARGE_OP} ${ref}`,
      }, (u) => ({ reference: ref, url: u, amount: data.amount, currency: data.currency, handle: data.handle, createdAt: new Date().toISOString() }));
      checkoutUrl = r.url;
    }
    const row = await db.from("paddle_resources").insert({
      user_id: user.id, mode, operation: `${TAG_OP} ${data.handle}`,
      resource_id: JSON.stringify({ handle: data.handle, name: data.name, amount: data.amount ?? null, currency: data.currency, checkoutUrl, createdAt: new Date().toISOString() }),
    });
    if (row.error) throw new Error("The tag could not be saved. Try again.");
    return { handle: data.handle, name: data.name, amount: data.amount ?? null, currency: data.currency, checkoutUrl, createdAt: new Date().toISOString() };
  });

export const listSmartTags = createServerFn({ method: "POST" }).handler(async (): Promise<{ mode: string; tags: SmartTagView[]; charges: TagChargeView[] }> => {
  const { bankingUser } = await import("./paddle.server");
  const { listDetails, verifyStatus } = await import("./checkout-links.server");
  const { db, user, mode } = await bankingUser();
  const tags = await listDetails(db, user.id, mode, TAG_OP, parseTag, 50);
  const charges = await listDetails(db, user.id, mode, TAG_CHARGE_OP, parseCharge, 50);
  await Promise.all(charges.map(async (c) => { c.status = await verifyStatus(mode, c.reference); }));
  return { mode, tags, charges };
});

/** Creates a fresh hosted checkout for an open-amount tag; replaying the same reference reuses it. */
export const chargeSmartTag = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => chargeSchema.parse(d))
  .handler(async ({ data }): Promise<TagChargeView> => {
    const { bankingUser } = await import("./paddle.server");
    const { hostedCheckout } = await import("./checkout-links.server");
    const { db, user, mode, review } = await bankingUser();
    if (mode === "live" && review !== "approved") throw new Error("Complete verification before charging live SmartTags.");
    const tag = await db.from("paddle_resources").select("resource_id").eq("user_id", user.id).eq("mode", mode).eq("operation", `${TAG_OP} ${data.handle}`).maybeSingle();
    if (tag.error || !tag.data) throw new Error("That SmartTag was not found on this account.");
    const parsed = parseTag(tag.data.resource_id);
    if (!parsed) throw new Error("That SmartTag record is damaged. Contact support.");
    const { url } = await hostedCheckout(db, user, mode, {
      amount: data.amount, currency: parsed.currency, email: data.email ?? `${data.handle}@tag.slikpay.africa`, name: parsed.name,
      reference: data.reference, operation: `${TAG_CHARGE_OP} ${data.reference}`,
    }, (u) => ({ reference: data.reference, url: u, amount: data.amount, currency: parsed.currency, handle: data.handle, createdAt: new Date().toISOString() }));
    return { reference: data.reference, url, amount: data.amount, currency: parsed.currency, handle: data.handle, createdAt: new Date().toISOString(), status: "awaiting" };
  });

/** Registers a soundbox device against one of the user's SmartTags. Device IDs are unique per mode. */
export const registerSoundbox = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => soundboxSchema.parse(d))
  .handler(async ({ data }): Promise<SoundboxView> => {
    const { bankingUser } = await import("./paddle.server");
    const { db, user, mode } = await bankingUser();
    const tag = await db.from("paddle_resources").select("resource_id").eq("user_id", user.id).eq("mode", mode).eq("operation", `${TAG_OP} ${data.handle}`).maybeSingle();
    if (tag.error || !tag.data) throw new Error("That SmartTag was not found on this account.");
    const taken = await db.from("paddle_resources").select("user_id").eq("mode", mode).eq("operation", `${SOUNDBOX_OP} ${data.deviceId}`).maybeSingle();
    if (taken.error) throw new Error("Could not check that device ID. Try again.");
    if (taken.data) throw new Error("That device ID is already registered. Check the device label and try again.");
    const view: SoundboxView = { deviceId: data.deviceId, label: data.label, handle: data.handle, voice: data.voice, createdAt: new Date().toISOString() };
    const row = await db.from("paddle_resources").insert({
      user_id: user.id, mode, operation: `${SOUNDBOX_OP} ${data.deviceId}`, resource_id: JSON.stringify(view),
    });
    if (row.error) throw new Error("The soundbox could not be saved. Try again.");
    return view;
  });

export const listSoundboxes = createServerFn({ method: "POST" }).handler(async (): Promise<{ soundboxes: SoundboxView[] }> => {
  const { bankingUser } = await import("./paddle.server");
  const { listDetails } = await import("./checkout-links.server");
  const { db, user, mode } = await bankingUser();
  const soundboxes = await listDetails(db, user.id, mode, SOUNDBOX_OP, parseSoundbox, 50);
  return { soundboxes };
});

/** Renames a soundbox or changes its announcement voice; the linked tag and device ID stay fixed. */
export const updateSoundbox = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => soundboxUpdateSchema.parse(d))
  .handler(async ({ data }): Promise<SoundboxView> => {
    const { bankingUser } = await import("./paddle.server");
    const { db, user, mode } = await bankingUser();
    const existing = await db.from("paddle_resources").select("resource_id").eq("user_id", user.id).eq("mode", mode).eq("operation", `${SOUNDBOX_OP} ${data.deviceId}`).maybeSingle();
    if (existing.error || !existing.data) throw new Error("That soundbox was not found on this account.");
    const parsed = parseSoundbox(existing.data.resource_id);
    if (!parsed) throw new Error("That soundbox record is damaged. Contact support.");
    const view: SoundboxView = { ...parsed, label: data.label, voice: data.voice };
    const row = await db.from("paddle_resources").update({ resource_id: JSON.stringify(view) }).eq("user_id", user.id).eq("mode", mode).eq("operation", `${SOUNDBOX_OP} ${data.deviceId}`);
    if (row.error) throw new Error("The soundbox could not be updated. Try again.");
    return view;
  });

export const unlinkSoundbox = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => soundboxDeleteSchema.parse(d))
  .handler(async ({ data }): Promise<{ deviceId: string }> => {
    const { bankingUser } = await import("./paddle.server");
    const { db, user, mode } = await bankingUser();
    const row = await db.from("paddle_resources").delete().eq("user_id", user.id).eq("mode", mode).eq("operation", `${SOUNDBOX_OP} ${data.deviceId}`);
    if (row.error) throw new Error("The soundbox could not be unlinked. Try again.");
    return { deviceId: data.deviceId };
  });
