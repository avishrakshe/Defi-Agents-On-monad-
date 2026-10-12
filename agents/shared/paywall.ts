import { Request, Response, NextFunction } from "express";
import { createX402Middleware } from "./x402Middleware";
import { createX402ErMiddleware } from "./x402ErMiddleware";

/**
 * Picks the payment rail per request: requests that came in under the MagicBlock mount (server.ts tags them) or a
 * standalone agent started with CHAIN=magicblock pay over the Ephemeral Rollup; everything else uses x402 EIP-3009 on Monad.
 */
export function createPaywall(agentSkill: string, resourceUrl: string) {
  const evm = createX402Middleware(agentSkill, resourceUrl);
  const er = createX402ErMiddleware(agentSkill, resourceUrl);
  return (req: Request, res: Response, next: NextFunction) => {
    const rail = (req as any).paymentRail || (process.env.CHAIN === "magicblock" ? "magicblock" : "monad");
    return rail === "magicblock" ? er(req, res, next) : evm(req, res, next);
  };
}
