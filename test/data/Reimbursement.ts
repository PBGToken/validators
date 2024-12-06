import { type IntLike } from "@helios-lang/codec-utils"
import { type PermissiveType, type StrictType } from "@helios-lang/contract-utils"
import contract from "pbg-token-validators-test-context"
import { SuccessFeeType, castSuccessFee, makeSuccessFee } from "./SuccessFee"
import { RatioType, castRatio } from "./Price"

export const castReimbursement = contract.ReimbursementModule.Reimbursement
export type ReimbursementType = PermissiveType<typeof castReimbursement>
type ReimbursementStrictType = StrictType<typeof castReimbursement>

export function makeExtractingReimbursement(props?: {
    nRemainingVouchers?: IntLike
    startPrice?: RatioType
    endPrice?: RatioType
    successFee?: SuccessFeeType
}): ReimbursementStrictType {
    return {
        start_price: castRatio.fromUplcData(
            castRatio.toUplcData(props?.startPrice ?? [100n, 1n])
        ),
        state: {
            Extracting: {
                n_remaining_vouchers: BigInt(props?.nRemainingVouchers ?? 0),

                end_price: castRatio.fromUplcData(
                    castRatio.toUplcData(props?.endPrice ?? [200n, 1n])
                ),
                success_fee: castSuccessFee.fromUplcData(
                    castSuccessFee.toUplcData(
                        props?.successFee ?? makeSuccessFee()
                    )
                )
            }
        }
    }
}

export function makeCollectingReimbursement(props?: {
    startPrice?: RatioType
}): ReimbursementStrictType {
    return {
        start_price: castRatio.fromUplcData(
            castRatio.toUplcData(props?.startPrice ?? [100n, 1n])
        ),
        state: {
            Collecting: {}
        }
    }
}
