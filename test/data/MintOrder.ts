import { IntLike } from "@helios-lang/codec-utils"
import { PermissiveType, StrictType } from "@helios-lang/contract-utils"
import { Address } from "@helios-lang/ledger"
import { IntData, UplcData } from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"

export const castMintOrder = contract.MintOrderModule.MintOrder
export type MintOrderType = PermissiveType<typeof castMintOrder>
type MintOrderStrictType = StrictType<typeof castMintOrder>

export const castMintOrderRedeemer = contract.mint_order_validator.Redeemer
export type MintOrderRedeemerType = PermissiveType<typeof castMintOrderRedeemer>

export function makeMintOrder(props?: {
    address?: Address
    datum?: UplcData
    minTokens?: IntLike
    maxPriceAge?: IntLike
}): MintOrderStrictType {
    const address = props?.address ?? Address.dummy(false)
    const datum = props?.datum ?? new IntData(0)
    const minTokens = BigInt(props?.minTokens ?? 100)
    const maxPriceAge = BigInt(props?.maxPriceAge ?? 12 * 60 * 60 * 1000)

    return {
        return_address: address,
        return_datum: datum,
        min_tokens: minTokens,
        max_price_age: maxPriceAge
    }
}
