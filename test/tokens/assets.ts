import { Assets } from "@helios-lang/ledger"
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
import { IntLike } from "@helios-lang/codec-utils"

export function makeAssetsToken(id: IntLike, n: IntLike = 1) {
    return Assets.fromAssetClasses([[assets(id), n]])
}

export function makeConfigToken(n: IntLike = 1) {
    return Assets.fromAssetClasses([[config, n]])
}

export function makeDvpTokens(n: IntLike) {
    return Assets.fromAssetClasses([[dvpToken, n]])
}

export function makeMetadataToken(n: IntLike = 1) {
    return Assets.fromAssetClasses([[metadata, n]])
}

export function makePortfolioToken(n: IntLike = 1) {
    return Assets.fromAssetClasses([[portfolio, n]])
}

export function makePriceToken(n: IntLike = 1) {
    return Assets.fromAssetClasses([[price, n]])
}

export function makeReimbursementToken(id: IntLike = 0, n: IntLike = 1) {
    return Assets.fromAssetClasses([[reimbursement(id), n]])
}

export function makeSupplyToken(n: IntLike = 1) {
    return Assets.fromAssetClasses([[supply, n]])
}

export function makeVoucherRefToken(id: IntLike = 0, n: IntLike = 1) {
    return Assets.fromAssetClasses([[voucher_ref(id), n]])
}

export function makeVoucherUserToken(id: IntLike = 0, n: IntLike = 1) {
    return Assets.fromAssetClasses([[voucher_nft(id), n]])
}

export function makeVoucherPair(id: number = 0, n: IntLike = 1) {
    return makeVoucherRefToken(id, n).add(makeVoucherUserToken(id, n))
}
