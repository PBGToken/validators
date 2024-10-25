import { strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { AssetClass } from "@helios-lang/ledger"
import contract from "pbg-token-validators-test-context"
import { makeAsset, equalsAsset } from "./data"

const {
    "Asset::new": new_asset,
    "Asset::convert_asset_to_lovelace": convert_asset_to_lovelace,
    "Asset::calc_value": calc_value
} = contract.AssetModule

describe("AssetModule::Asset::new", () => {
    const ac = AssetClass.dummy(1)
    const expected = makeAsset({
        assetClass: ac,
        count: 0,
        priceTimestamp: 0,
        price: [0, 1]
    })

    it("initializes Asset with unit price and zeroes for other fields", () => {
        const actual = new_asset.eval({
            asset_class: ac
        })

        equalsAsset(actual, expected)
    })
})

describe("AssetModule::Asset::convert_asset_to_lovelace", () => {
    it("rounds down price correctly", () => {
        strictEqual(
            convert_asset_to_lovelace.eval({
                self: makeAsset({
                    assetClass: AssetClass.dummy(1),
                    count: 1_000_000_000n,
                    price: [100, 99]
                }),
                qty: 1_000_000_000n
            }),
            1010101010n
        )
    })

    it("throws an error if price denominator is zero", () => {
        throws(() => {
            convert_asset_to_lovelace.eval({
                self: makeAsset({
                    price: [100, 0]
                }),
                qty: 1n
            })
        })
    })
})

describe("AssetModule::Asset::calc_value", () => {
    it("rounds down price correctly", () => {
        strictEqual(
            calc_value.eval({
                self: makeAsset({
                    assetClass: AssetClass.dummy(1),
                    count: 1_000_000_000n,
                    price: [100, 99]
                })
            }),
            1010101010n
        )
    })

    it("throws an error if price denominator is zero", () => {
        throws(() => {
            calc_value.eval({
                self: makeAsset({
                    price: [100, 0]
                })
            })
        })
    })
})
