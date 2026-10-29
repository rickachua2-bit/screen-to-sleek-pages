import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { cryptoOfframpPreview } from "./crypto-offramp";

export const getCryptoOfframpPreview = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => z.object({ coin: z.enum(["USDT", "USDC"]), amount: z.number().positive().max(1e12) }).parse(value))
  .handler(async ({ data }) => {
    const { bankingUser, callPaddle } = await import("./paddle.server");
    const ctx = await bankingUser();
    const response = await callPaddle(ctx.mode, "GET", "/v1/crypto/rates");
    return cryptoOfframpPreview(response.data, data.coin, data.amount);
  });