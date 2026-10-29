import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { LINK_CURRENCIES } from "./checkout-links.server";

export interface ProductView {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  createdAt: string;
}

const PRODUCT_OP = "SLIKPAY product";
const productOp = (id: string) => `${PRODUCT_OP} ${id}`;

const productSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional(),
  price: z.number().positive().max(1e9),
  currency: z.enum(LINK_CURRENCIES),
});

function parseProduct(raw: string): ProductView | null {
  try {
    const v = JSON.parse(raw) as Partial<ProductView>;
    if (typeof v.id !== "string" || typeof v.name !== "string" || typeof v.price !== "number" || typeof v.currency !== "string") return null;
    return { id: v.id, name: v.name, description: typeof v.description === "string" ? v.description : null, price: v.price, currency: v.currency, createdAt: typeof v.createdAt === "string" ? v.createdAt : "" };
  } catch { return null; }
}

export const createProduct = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => productSchema.parse(d))
  .handler(async ({ data }): Promise<ProductView> => {
    const { bankingUser } = await import("./paddle.server");
    const { db, user, mode } = await bankingUser();
    const view: ProductView = { id: data.id, name: data.name, description: data.description ?? null, price: data.price, currency: data.currency, createdAt: new Date().toISOString() };
    const r = await db.from("paddle_resources").upsert({ user_id: user.id, mode, resource_id: JSON.stringify(view), operation: productOp(data.id) }, { onConflict: "mode,resource_id", ignoreDuplicates: true });
    if (r.error) throw new Error("Could not save this product. Try again.");
    return view;
  });

export const listProducts = createServerFn({ method: "POST" }).handler(async (): Promise<{ mode: string; products: ProductView[] }> => {
  const { bankingUser } = await import("./paddle.server");
  const { listDetails } = await import("./checkout-links.server");
  const { db, user, mode } = await bankingUser();
  const products = await listDetails(db, user.id, mode, PRODUCT_OP, parseProduct, 100);
  return { mode, products };
});

export const deleteProduct = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { bankingUser } = await import("./paddle.server");
    const { db, user, mode } = await bankingUser();
    const r = await db.from("paddle_resources").delete().eq("user_id", user.id).eq("mode", mode).eq("operation", productOp(data.id));
    if (r.error) throw new Error("Could not remove this product. Try again.");
    return { ok: true as const };
  });

const checkoutSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().max(160),
  name: z.string().trim().max(120).optional(),
  reference: z.string().regex(/^SLKPROD-[0-9a-fA-F-]{36}$/),
});

/** One-tap hosted checkout for a catalog product, sent to a specific customer. */
export const checkoutProduct = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => checkoutSchema.parse(d))
  .handler(async ({ data }): Promise<{ url: string; reference: string }> => {
    const { bankingUser } = await import("./paddle.server");
    const { hostedCheckout } = await import("./checkout-links.server");
    const { db, user, mode, review } = await bankingUser();
    if (mode === "live" && review !== "approved") throw new Error("Complete verification before creating live checkouts.");
    const row = await db.from("paddle_resources").select("resource_id").eq("user_id", user.id).eq("mode", mode).eq("operation", productOp(data.id)).maybeSingle();
    const product = row.data ? parseProduct(row.data.resource_id) : null;
    if (!product) throw new Error("That product doesn't belong to your catalog.");
    const { url } = await hostedCheckout(db, user, mode, {
      amount: product.price, currency: product.currency, email: data.email, name: data.name ?? product.name,
      reference: data.reference, operation: `SLIKPAY product-checkout ${data.reference}`,
    }, (u) => ({ reference: data.reference, url: u, productId: product.id, productName: product.name, price: product.price, currency: product.currency, email: data.email, createdAt: new Date().toISOString() }));
    return { url, reference: data.reference };
  });
