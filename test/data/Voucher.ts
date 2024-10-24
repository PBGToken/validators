import { IntLike } from "@helios-lang/codec-utils"
import { PermissiveType, StrictType } from "@helios-lang/contract-utils"
import { Address } from "@helios-lang/ledger"
import { IntData, UplcData } from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"
import { RatioType } from "./Price"

export const castVoucher = contract.VoucherModule.Voucher
export type VoucherType = PermissiveType<typeof castVoucher>
type VoucherStrictType = StrictType<typeof castVoucher>

export function makeVoucher(props?: {
    address?: Address<any, any>
    datum?: UplcData
    periodId?: IntLike
    price?: RatioType
    tokens?: IntLike
}): VoucherStrictType {
    return {
        return_address: props?.address ?? Address.dummy(false),
        return_datum: props?.datum ?? new IntData(0),
        tokens: BigInt(props?.tokens ?? 0),
        price: props?.price
            ? [BigInt(props.price[0]), BigInt(props.price[1])]
            : [100n, 1n],
        period_id: BigInt(props?.periodId ?? 0),
        name: "DVP Voucher",
        description:
            "Part of the end-of-year success fee will be reimbursement",
        image: "https://www.example.com/image.png",
        url: "https://www.example.com/"
    }
}
