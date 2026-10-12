import { ChainAdapter, ChainId } from "./types";
import { monadChain } from "./monad";
import { magicblockChain } from "./magicblock";

export function getChain(id: ChainId): ChainAdapter {
  return id === "magicblock" ? magicblockChain : monadChain;
}

export * from "./types";
