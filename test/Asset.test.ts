import { strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { AssetClass } from "@helios-lang/ledger"
import contract from "pbg-token-validators-test-context"
import { makeAsset, equalsAsset } from "./data"

const { "Asset::new": new_asset, "Asset::calc_value": calc_value } =
    contract.AssetModule

describe("AssetModule::Asset::new", () => {
    const ac = AssetClass.dummy(1)
    const expected = makeAsset({
        assetClass: ac,
        count: 0,
        countTick: 0,
        priceTimestamp: 0,
        price: [1, 1]
    })

    it("initializes Asset with unit price and zeroes for other fields", () => {
        const actual = new_asset.eval({
            asset_class: ac
        })

        equalsAsset(actual, expected)
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
