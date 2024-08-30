import { deepEqual, strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { AssetClass, Assets, Value } from "@helios-lang/ledger"
import { IntData } from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"
import { scripts } from "./constants"
import { makeConfig } from "./data"
import { spendAssets, spendPrice, spendVault } from "./tx"
const { diff, diff_lovelace, nothing_spent, VAULT_DATUM } = contract.Vault

describe("Vault::VAULT_DATUM", () => {
    it("is empty bytearray", () => {
        deepEqual(VAULT_DATUM.eval({}), [])
    })
})

describe("Vault::nothing_spent", () => {
    it("false if vault asset is spent", () => {
        const ctx = spendVault({})

        scripts.forEach((currentScript) => {
            strictEqual(
                nothing_spent.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctx
                }),
                false
            )
        })
    })

    it("false if asset group is spent", () => {
        const ctx = spendAssets({ id: 0 })

        scripts.forEach((currentScript) => {
            strictEqual(
                nothing_spent.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctx
                }),
                false
            )
        })
    })

    it("true if nothing from vault is spent", () => {
        const ctx = spendPrice({})

        scripts.forEach((currentScript) => {
            strictEqual(
                nothing_spent.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctx
                }),
                true
            )
        })
    })
})

describe("Vault::diff", () => {
    it("is 0 if no real change", () => {
        const ctx = spendVault({})

        scripts.forEach((currentScript) => {
            const v = diff.eval({
                $currentScript: currentScript,
                $scriptContext: ctx
            })

            strictEqual(v.isEqual(new Value(0)), true)
        })
    })

    it("can sum over multiple inputs and outputs", () => {
        const ctx = spendVault({
            inputValue: [
                new Value(1_000_000),
                new Value(2_000_000),
                new Value(10_000_000)
            ],
            outputValue: [new Value(15_000_000), new Value(2_000_000)]
        })

        scripts.forEach((currentScript) => {
            const v = diff.eval({
                $currentScript: currentScript,
                $scriptContext: ctx
            })

            strictEqual(v.isEqual(new Value(4_000_000)), true)
        })
    })

    it("fails for outputs sent back to vault with wrong datum", () => {
        const ctx = spendVault({
            inputValue: new Value(2_000_000),
            outputDatum: new IntData(0),
            outputValue: new Value(2_000_000)
        })

        scripts.forEach((currentScript) => {
            throws(() => {
                diff.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctx
                })
            })
        })
    })

    it("is negative tokens taken out (i.e. value into transaction)", () => {
        const ac = AssetClass.dummy()

        const ctx = spendVault({
            inputValue: new Value(
                0,
                Assets.fromAssetClasses([[ac, 1_000_000n]])
            ),
            outputValue: new Value(0)
        })

        scripts.forEach((currentScript) => {
            const v = diff.eval({
                $currentScript: currentScript,
                $scriptContext: ctx
            })

            strictEqual(v.assets.getQuantity(ac), -1_000_000n)
        })
    })
})

describe("Vault::diff_lovelace", () => {
    describe("correctly sums pure lovelace without asset counters", () => {
        return
        const ctx = spendVault({
            inputValue: new Value(1_000_000),
            outputValue: new Value(10_000_000),
            config: makeConfig({}),
            inputAssetGroups: [
                [
                    {
                        asset_class: AssetClass.ADA,
                        count: 0,
                        count_tick: 0,
                        price: [1, 1],
                        price_timestamp: 0
                    }
                ]
            ],
            outputAssetGroups: [
                [
                    {
                        asset_class: AssetClass.ADA,
                        count: 9_000_000,
                        count_tick: 0,
                        price: [1, 1],
                        price_timestamp: 0
                    }
                ]
            ]
        })

        scripts.slice(0, 1).forEach((currentScript) => {
            it(`in ${currentScript}`, () => {
                strictEqual(
                    diff_lovelace.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        ptrs: [
                            {
                                group_index: 0,
                                asset_class_index: 0
                            }
                        ]
                    }),
                    10_000_000
                )
            })
        })
    })
})
