import { PermissiveType, StrictType } from "@helios-lang/contract-utils"
import contract from "pbg-token-validators-test-context"

export const castPrice = contract.PriceModule.Price
export type PriceType = PermissiveType<typeof castPrice>
type PriceStrictType = StrictType<typeof castPrice>

export function makePrice(): PriceStrictType {
    return {
        value: [100n, 1n],
        timestamp: 0
    }
}
