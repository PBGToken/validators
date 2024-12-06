import { type IntLike } from "@helios-lang/codec-utils"
import { type PermissiveType, type StrictType } from "@helios-lang/contract-utils"
import { type TimeLike, toTime } from "@helios-lang/ledger"
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
    ratio?: RatioType
}): PriceStrictType {
    return {
        value: props?.ratio
            ? [BigInt(props.ratio[0]), BigInt(props.ratio[1])]
            : [BigInt(props?.top ?? 100), BigInt(props?.bottom ?? 1n)],
        timestamp: toTime(props?.timestamp ?? 0)
    }
}
