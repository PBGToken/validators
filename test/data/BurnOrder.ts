import { type IntLike } from "@helios-lang/codec-utils"
import {
    type PermissiveType,
    type StrictType
} from "@helios-lang/contract-utils"
import {
    type ShelleyAddress,
    makeDummyAddress,
    Value
} from "@helios-lang/ledger"
import { makeIntData, UplcData } from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"

export const castBurnOrder = contract.BurnOrderModule.BurnOrder
export type BurnOrderType = PermissiveType<typeof castBurnOrder>
type BurnOrderStrictType = StrictType<typeof castBurnOrder>
type BurnOrderReturnValueType = StrictType<
    typeof contract.BurnOrderModule.BurnOrderReturnValue
>

export const castBurnOrderRedeemer = contract.burn_order_validator.Redeemer
export type BurnOrderRedeemerType = PermissiveType<typeof castBurnOrderRedeemer>

export function makeBurnOrder(props?: {
    address?: ShelleyAddress<any>
    lovelace?: IntLike
    datum?: UplcData
    value?: Value
    maxPriceAge?: IntLike
}): BurnOrderStrictType {
    const returnAddress = props?.address ?? makeDummyAddress(false)
    const returnDatum = props?.datum ?? makeIntData(0)
    const minReturnValue: BurnOrderReturnValueType = props?.lovelace
        ? {
              L: {
                  lovelace: BigInt(props.lovelace)
              }
          }
        : props?.value
          ? {
                V: {
                    value: props.value
                }
            }
          : {
                L: {
                    lovelace: 2_000_000n
                }
            }
    const maxPriceAge = BigInt(props?.maxPriceAge ?? 12 * 60 * 60 * 1000)

    return {
        return_address: returnAddress,
        return_datum: returnDatum,
        min_return_value: minReturnValue,
        max_price_age: maxPriceAge
    }
}
