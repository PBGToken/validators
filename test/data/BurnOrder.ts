import { IntLike } from "@helios-lang/codec-utils"
import { PermissiveType, StrictType } from "@helios-lang/contract-utils"
import { Address, Value } from "@helios-lang/ledger"
import { IntData, UplcData } from "@helios-lang/uplc"
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
    address?: Address
    lovelace?: IntLike
    datum?: UplcData
    value?: Value
    maxPriceAge?: IntLike
}): BurnOrderStrictType {
    const returnAddress = props?.address ?? Address.dummy(false)
    const returnDatum = props?.datum ?? new IntData(0)
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
