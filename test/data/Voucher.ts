import { type IntLike } from "@helios-lang/codec-utils"
import { type PermissiveType, type StrictType } from "@helios-lang/contract-utils"
import { makeDummyAddress, type ShelleyAddress } from "@helios-lang/ledger"
import { makeIntData, type UplcData } from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"
import { RatioType } from "./Price"

export const castVoucher = contract.VoucherModule.Voucher
export const castVoucherWrapper = contract.VoucherModule.VoucherWrapper
export type VoucherType = PermissiveType<typeof castVoucher>
export type VoucherWrapperType = PermissiveType<typeof castVoucherWrapper>
type VoucherStrictType = StrictType<typeof castVoucher>

export function makeVoucher(props?: {
    address?: ShelleyAddress<any>
    datum?: UplcData
    periodId?: IntLike
    price?: RatioType
    tokens?: IntLike
}): VoucherStrictType {
    return {
        return_address: props?.address ?? makeDummyAddress(false),
        return_datum: props?.datum ?? makeIntData(0),
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

export function wrapVoucher(voucher: VoucherType): VoucherWrapperType {
    return {
        Cip68: {
            voucher,
            version: 1,
            extra: {
                Unused: {}
            }
        }
    }
}
