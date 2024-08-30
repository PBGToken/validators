import { IntLike } from "@helios-lang/codec-utils"
import { PermissiveType, StrictType } from "@helios-lang/contract-utils"
import { TimeLike } from "@helios-lang/ledger"
import contract from "pbg-token-validators-test-context"

export const castSupply = contract.supply_validator.Supply

export type SupplyType = PermissiveType<typeof castSupply>
type SupplyStrictType = StrictType<typeof castSupply>

type MakeSupplyProps = {
    nTokens?: IntLike
    startPrice?: [IntLike, IntLike]
    successFee?: {
        start_time?: TimeLike
        period?: IntLike
        periodId?: IntLike
    }
}

export function makeSupply(props?: MakeSupplyProps): SupplyStrictType {
    // use bigints so the result is close
    const startPrice = props?.startPrice ?? [100, 1]
    return {
        tick: 0n,
        n_tokens: BigInt(props?.nTokens ?? 1_000_000_000),
        n_vouchers: 0n,
        last_voucher_id: 0n,
        n_lovelace: 100_000_000_000n,
        management_fee_timestamp: 0,
        success_fee: {
            period_id: BigInt(props?.successFee?.periodId ?? 0),
            start_time: Number(props?.successFee?.start_time ?? 0),
            period: BigInt(
                props?.successFee?.period ?? 1000 * 60 * 60 * 24 * 365
            ),
            start_price: [BigInt(startPrice[0]), BigInt(startPrice[1])]
        }
    }
}