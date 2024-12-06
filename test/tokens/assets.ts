import { type IntLike } from "@helios-lang/codec-utils"
import { makeAssets } from "@helios-lang/ledger"
import {
    assets,
    config,
    dvpToken,
    metadata,
    portfolio,
    price,
    reimbursement,
    supply,
    voucher_nft,
    voucher_ref
} from "./asset-classes"

export function makeAssetsToken(id: IntLike, n: IntLike = 1) {
    return makeAssets([[assets(id), n]])
}

export function makeConfigToken(n: IntLike = 1) {
    return makeAssets([[config, n]])
}

export function makeDvpTokens(n: IntLike) {
    return makeAssets([[dvpToken, n]])
}

export function makeMetadataToken(n: IntLike = 1) {
    return makeAssets([[metadata, n]])
}

export function makePortfolioToken(n: IntLike = 1) {
    return makeAssets([[portfolio, n]])
}

export function makePriceToken(n: IntLike = 1) {
    return makeAssets([[price, n]])
}

export function makeReimbursementToken(id: IntLike = 0, n: IntLike = 1) {
    return makeAssets([[reimbursement(id), n]])
}

export function makeSupplyToken(n: IntLike = 1) {
    return makeAssets([[supply, n]])
}

export function makeVoucherRefToken(id: IntLike = 0, n: IntLike = 1) {
    return makeAssets([[voucher_ref(id), n]])
}

export function makeVoucherUserToken(id: IntLike = 0, n: IntLike = 1) {
    return makeAssets([[voucher_nft(id), n]])
}

export function makeVoucherPair(id: IntLike = 0, n: IntLike = 1) {
    return makeVoucherRefToken(id, n).add(makeVoucherUserToken(id, n))
}
