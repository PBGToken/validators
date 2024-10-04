import { PermissiveType, StrictType } from "@helios-lang/contract-utils"
import contract from "pbg-token-validators-test-context"
import { SuccessFeeType, castSuccessFee, makeSuccessFee } from "./SuccessFee"
import { IntLike, toInt } from "@helios-lang/codec-utils"
import { RatioType, castRatio } from "./Price"

export const castReimbursement = contract.ReimbursementModule.Reimbursement
export type ReimbursementType = PermissiveType<typeof castReimbursement>
type ReimbursementStrictType = StrictType<typeof castReimbursement>

export function makeReimbursement(props?: {
    nRemainingVouchers?: IntLike
    startPrice?: RatioType
    endPrice?: RatioType
    successFee?: SuccessFeeType
}): ReimbursementStrictType {
    return {
        n_remaining_vouchers: BigInt(props?.nRemainingVouchers ?? 0),
        start_price: castRatio.fromUplcData(
            castRatio.toUplcData(props?.startPrice ?? [100n, 1n])
        ),
        end_price: castRatio.fromUplcData(
            castRatio.toUplcData(props?.endPrice ?? [200n, 1n])
        ),
        success_fee: castSuccessFee.fromUplcData(
            castSuccessFee.toUplcData(props?.successFee ?? makeSuccessFee())
        )
    }
}
