import { Assets } from "@helios-lang/ledger"
import {
    assets,
    config,
    dvpToken,
    portfolio,
    price,
    supply
} from "./asset-classes"

export function makeAssetsToken(id: number, n: number = 1) {
    return Assets.fromAssetClasses([[assets(id), n]])
}

export function makeConfigToken(n: number = 1) {
    return Assets.fromAssetClasses([[config, n]])
}

export function makeDvpTokens(n: number) {
    return Assets.fromAssetClasses([[dvpToken, n]])
}

export function makePortfolioToken(n: number = 1) {
    return Assets.fromAssetClasses([[portfolio, n]])
}

export function makePriceToken(n: number = 1) {
    return Assets.fromAssetClasses([[price, n]])
}
export function makeSupplyToken(n: number = 1) {
    return Assets.fromAssetClasses([[supply, n]])
}
