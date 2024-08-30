import { AssetClass } from "@helios-lang/ledger"
import {
    cip68_100_prefix,
    cip68_222_prefix,
    cip68_333_prefix
} from "../constants/cip68"
import { policy } from "../constants/policy"
import { encodeUtf8 } from "@helios-lang/codec-utils"

export const config = new AssetClass(policy, encodeUtf8("config"))
export const dvpToken = new AssetClass(policy, cip68_333_prefix)
export const metadata = new AssetClass(policy, cip68_100_prefix)
export const portfolio = new AssetClass(policy, encodeUtf8("portfolio"))
export const price = new AssetClass(policy, encodeUtf8("price"))
export const supply = new AssetClass(policy, encodeUtf8("supply"))

export function assets(id: number) {
    return new AssetClass(policy, encodeUtf8(`assets ${id}`))
}

export function reimbursement(id: number) {
    return new AssetClass(policy, encodeUtf8(`reimbursement ${id}`))
}

export function voucher_ref(id: number) {
    return new AssetClass(
        policy,
        cip68_100_prefix.concat(encodeUtf8(`voucher ${id}`))
    )
}

export function voucher_nft(id: number) {
    return new AssetClass(
        policy,
        cip68_222_prefix.concat(encodeUtf8(`voucher ${id}`))
    )
}
