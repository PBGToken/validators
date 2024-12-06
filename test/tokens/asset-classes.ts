import { type IntLike, encodeUtf8 } from "@helios-lang/codec-utils"
import { makeAssetClass } from "@helios-lang/ledger"
import {
    cip68_100_prefix,
    cip68_222_prefix,
    cip68_333_prefix,
    PREFIX
} from "../constants"
import { policy } from "../constants/policy"

export const config = makeAssetClass(policy, encodeUtf8(`${PREFIX} config`))
export const dvpToken = makeAssetClass(
    policy,
    cip68_333_prefix.concat(encodeUtf8(PREFIX))
)
export const metadata = makeAssetClass(
    policy,
    cip68_100_prefix.concat(encodeUtf8(PREFIX))
)
export const portfolio = makeAssetClass(
    policy,
    encodeUtf8(`${PREFIX} portfolio`)
)
export const price = makeAssetClass(policy, encodeUtf8(`${PREFIX} price`))
export const supply = makeAssetClass(policy, encodeUtf8(`${PREFIX} supply`))

export function assets(id: IntLike) {
    return makeAssetClass(policy, encodeUtf8(`${PREFIX} assets ${id}`))
}

export function reimbursement(id: IntLike) {
    return makeAssetClass(policy, encodeUtf8(`${PREFIX} reimbursement ${id}`))
}

export function voucher_ref(id: IntLike) {
    return makeAssetClass(
        policy,
        cip68_100_prefix.concat(encodeUtf8(`${PREFIX} voucher ${id}`))
    )
}

export function voucher_nft(id: IntLike) {
    return makeAssetClass(
        policy,
        cip68_222_prefix.concat(encodeUtf8(`${PREFIX} voucher ${Number(id)}`))
    )
}
