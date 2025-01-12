import { type IntLike } from "@helios-lang/codec-utils"
import {
    type PermissiveType,
    type StrictType
} from "@helios-lang/contract-utils"
import { makeDummyAddress, type ShelleyAddress } from "@helios-lang/ledger"
import { makeIntData, type UplcData } from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"

export const castMintOrder = contract.MintOrderModule.MintOrder
export type MintOrderType = PermissiveType<typeof castMintOrder>
type MintOrderStrictType = StrictType<typeof castMintOrder>

export const castMintOrderRedeemer = contract.mint_order_validator.Redeemer
export type MintOrderRedeemerType = PermissiveType<typeof castMintOrderRedeemer>

export function makeMintOrder(props?: {
    address?: ShelleyAddress<any>
    datum?: UplcData
    minTokens?: IntLike
    maxPriceAge?: IntLike
}): MintOrderStrictType {
    const address = props?.address ?? makeDummyAddress(false)
    const datum = props?.datum ?? makeIntData(0)
    const minTokens = BigInt(props?.minTokens ?? 100)
    const maxPriceAge = BigInt(props?.maxPriceAge ?? 12 * 60 * 60 * 1000)

    return {
        return_address: address,
        return_datum: datum,
        min_tokens: minTokens,
        max_price_age: maxPriceAge
    }
}
