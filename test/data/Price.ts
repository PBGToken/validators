import { IntLike } from "@helios-lang/codec-utils"
import { PermissiveType, StrictType } from "@helios-lang/contract-utils"
import { TimeLike, toTime } from "@helios-lang/ledger"
import contract from "pbg-token-validators-test-context"

export const castPrice = contract.PriceModule.Price
export type PriceType = PermissiveType<typeof castPrice>
type PriceStrictType = StrictType<typeof castPrice>

export const castRatio = contract.benchmark_delegate.$hash.context.redeemer
export type RatioType = [IntLike, IntLike]

export function makePrice(props?: {
    timestamp?: TimeLike
    top?: IntLike
    bottom?: IntLike
}): PriceStrictType {
    return {
        value: [BigInt(props?.top ?? 100), BigInt(props?.bottom ?? 1n)],
        timestamp: toTime(props?.timestamp ?? 0)
    }
}
