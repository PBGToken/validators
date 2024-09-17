import { deepEqual, strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { Address, AssetClass, Assets, Value } from "@helios-lang/ledger"
import { IntData } from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"
import {
    directPolicyScripts,
    indirectPolicyScripts,
    scripts
} from "./constants"
import { RatioType, makeAsset, makeAssetGroup, makeConfig } from "./data"
import { ScriptContextBuilder, withScripts } from "./tx"
import { makeAssetsToken, makeConfigToken } from "./tokens"

const {
    VAULT_DATUM,
    nothing_spent,
    diff,
    diff_lovelace,
    diff_counted,
    counters_are_consistent
} = contract.Vault

describe("Vault::VAULT_DATUM", () => {
    it("equal to empty bytearray", () => {
        deepEqual(VAULT_DATUM.eval({}), [])
    })
})

describe("Vault::nothing_spent", () => {
    it("false if vault asset is spent", () => {
        new ScriptContextBuilder()
            .takeFromVault({ value: new Value(2_000_000n) })
            .use((ctx) => {
                directPolicyScripts.forEach((currentScript) => {
                    strictEqual(
                        nothing_spent.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }),
                        false
                    )
                })
            })

        new ScriptContextBuilder()
            .takeFromVault({ value: new Value(2_000_000n) })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                indirectPolicyScripts.forEach((currentScript) => {
                    strictEqual(
                        nothing_spent.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }),
                        false
                    )
                })
            })
    })

    it("false if asset group is spent", () => {
        const assets = [makeAsset()]

        new ScriptContextBuilder()
            .addAssetGroupThread({
                id: 0,
                inputAssets: assets,
                outputAssets: assets,
                redeemer: {
                    Count: { supply_ptr: 0 }
                }
            })
            .use((ctx) => {
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
    })

    it("true if nothing from vault is spent", () => {
        new ScriptContextBuilder()
            .addPriceThread({ redeemer: new IntData(0) })
            .use((ctx) => {
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
})

describe("Vault::diff", () => {
    describe("pure lovelace diff", () => {
        const configureParentContext = (props?: {
            omitDummyPolicyRedeemer?: boolean
        }) => {
            const scb = new ScriptContextBuilder()
                .takeFromVault({ value: new Value(2_000_000) })
                .sendToVault({ value: new Value(2_000_000) })

            if (!props?.omitDummyPolicyRedeemer) {
                scb.redeemDummyTokenWithDvpPolicy()
            }

            return scb
        }

        describe("@ validators that don't have direct access to the policy", () => {
            const configureContext = withScripts(
                configureParentContext,
                indirectPolicyScripts
            )

            it("retruns zero if no real change", () => {
                configureContext().use((currentScript, ctx) => {
                    const v = diff.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    })

                    strictEqual(v.isEqual(new Value(0)), true)
                })
            })

            it("throws an error if the current input doesn't contain a policy token", () => {
                configureContext({ omitDummyPolicyRedeemer: true }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            diff.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                        })
                    }
                )
            })
        })

        describe("@ validators that have direct access to the policy", () => {
            const configureContext = withScripts(
                configureParentContext,
                directPolicyScripts
            )

            it("returns zero if no real change", () => {
                configureContext({ omitDummyPolicyRedeemer: true }).use(
                    (currentScript, ctx) => {
                        const v = diff.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })

                        strictEqual(v.isEqual(new Value(0)), true)
                    }
                )
            })
        })

        describe("@ all validators", () => {
            it("returns the correct sum over multiple inputs and outputs", () => {
                new ScriptContextBuilder()
                    .takeFromVault({ value: new Value(1_000_000) })
                    .takeFromVault({ value: new Value(2_000_000) })
                    .takeFromVault({ value: new Value(10_000_000) })
                    .sendToVault({ value: new Value(15_000_000) })
                    .sendToVault({ value: new Value(2_000_000) })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            const v = diff.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })

                            strictEqual(v.isEqual(new Value(4_000_000)), true)
                        })
                    })
            })

            it("ignores outputs sent to vault with multiple assets", () => {
                new ScriptContextBuilder()
                    .takeFromVault({ value: new Value(1_000_000) })
                    .takeFromVault({ value: new Value(2_000_000) })
                    .takeFromVault({ value: new Value(10_000_000) })
                    .sendToVault({
                        value: new Value(
                            15_000_000,
                            Assets.fromAssetClasses([
                                [AssetClass.dummy(0), 10],
                                [AssetClass.dummy(1), 20]
                            ])
                        )
                    })
                    .sendToVault({
                        value: new Value(
                            2_000_000,
                            Assets.fromAssetClasses([[AssetClass.dummy(0), 10]])
                        )
                    })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            const v = diff.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })

                            strictEqual(
                                v.isEqual(
                                    new Value(
                                        -11_000_000,
                                        Assets.fromAssetClasses([
                                            [AssetClass.dummy(0), 10]
                                        ])
                                    )
                                ),
                                true
                            )
                        })
                    })
            })

            it("throws an error for outputs sent back to vault with wrong datum", () => {
                new ScriptContextBuilder()
                    .takeFromVault({ value: new Value(2_000_000) })
                    .sendToVault({
                        datum: new IntData(0),
                        value: new Value(2_000_000)
                    })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            throws(() => {
                                diff.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx
                                })
                            })
                        })
                    })
            })

            it("returns a negative asset value if assets are taken out (i.e. value into transaction)", () => {
                const ac = AssetClass.dummy()

                new ScriptContextBuilder()
                    .takeFromVault({
                        value: new Value(
                            0,
                            Assets.fromAssetClasses([[ac, 1_000_000n]])
                        )
                    })
                    .sendToVault({ value: new Value(0) })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            const v = diff.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })

                            strictEqual(v.assets.getQuantity(ac), -1_000_000n)
                        })
                    })
            })
        })
    })
})

describe("Vault::diff_lovelace", () => {
    it("fails if config token isn't referenced or spent", () => {
        new ScriptContextBuilder()
            .takeFromVault({ value: new Value(1_000_000) })
            .sendToVault({ value: new Value(10_000_000) })
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    throws(() => {
                        diff_lovelace.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ptrs: [
                                // dummy AssetPtr is still needed for lovelace
                                {
                                    group_index: 0,
                                    asset_class_index: 0
                                }
                            ]
                        })
                    })
                })
            })
    })

    it("fails if time-range not set", () => {
        new ScriptContextBuilder()
            .takeFromVault({ value: new Value(1_000_000) })
            .sendToVault({ value: new Value(10_000_000) })
            .addConfigRef()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    throws(() => {
                        diff_lovelace.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ptrs: [
                                // dummy AssetPtr[] entry is still needed
                                {
                                    group_index: 0,
                                    asset_class_index: 0
                                }
                            ]
                        })
                    })
                })
            })
    })

    it("correctly sums pure lovelace without asset counters (in scripts that have direct access to policy without dummy redeemer)", () => {
        new ScriptContextBuilder()
            .takeFromVault({ value: new Value(1_000_000) })
            .sendToVault({ value: new Value(10_000_000) })
            .addConfigRef()
            .setTimeRange({ end: 0 })
            .use((ctx) => {
                directPolicyScripts.forEach((currentScript) => {
                    strictEqual(
                        diff_lovelace.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ptrs: [
                                // dummy AssetPtr[] entry is still needed
                                {
                                    group_index: 0,
                                    asset_class_index: 0
                                }
                            ]
                        }),
                        9_000_000n
                    )
                })
            })
    })

    it("correctly sums pure lovelace without asset counters (in scripts that don't have direct access to policy, so with dummy redeemer)", () => {
        new ScriptContextBuilder()
            .takeFromVault({ value: new Value(1_000_000) })
            .sendToVault({ value: new Value(10_000_000) })
            .addConfigRef()
            .redeemDummyTokenWithDvpPolicy()
            .setTimeRange({ end: 0 })
            .use((ctx) => {
                indirectPolicyScripts.forEach((currentScript) => {
                    if (currentScript == "config_validator") {
                        // fails because config must be spent
                        throws(() => {
                            diff_lovelace.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                ptrs: [
                                    // dummy AssetPtr[] entry is still needed
                                    {
                                        group_index: 0,
                                        asset_class_index: 0
                                    }
                                ]
                            })
                        })
                    } else {
                        strictEqual(
                            diff_lovelace.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                ptrs: [
                                    // dummy AssetPtr[] entry is still needed
                                    {
                                        group_index: 0,
                                        asset_class_index: 0
                                    }
                                ]
                            }),
                            9_000_000n
                        )
                    }
                })
            })
    })

    it("fails for scripts that don't have direct access to policy if current input doesn't contain a policy token", () => {
        new ScriptContextBuilder()
            .takeFromVault({ value: new Value(1_000_000) })
            .sendToVault({ value: new Value(10_000_000) })
            .addConfigRef()
            .use((ctx) => {
                indirectPolicyScripts.forEach((currentScript) => {
                    throws(() => {
                        diff_lovelace.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ptrs: [
                                // dummy AssetPtr is still needed for lovelace
                                {
                                    group_index: 0,
                                    asset_class_index: 0
                                }
                            ]
                        })
                    })
                })
            })
    })
})

describe("Vault::diff_counted", () => {
    describe("one asset group thread with a single asset that remains unchanged", () => {
        const expectedTick = 0
        const assets = [
            makeAsset({
                countTick: expectedTick
            })
        ]
        const groupId = 0
        const configureParentContext = (props?: {
            inputToken?: Assets
            outputAddress?: Address
            outputToken?: Assets
        }) => {
            return new ScriptContextBuilder()
                .addDummyInputs(5)
                .addDummyOutputs(5)
                .addAssetGroupThread({
                    id: groupId,
                    inputAssets: assets,
                    inputToken: props?.inputToken,
                    outputAssets: assets,
                    outputAddress: props?.outputAddress,
                    outputToken: props?.outputToken
                })
                .redeemDummyTokenWithDvpPolicy()
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            it("returns zero", () => {
                configureContext().use((currentScript, ctx) => {
                    const actual = diff_counted.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        d_lovelace: 0,
                        expected_tick: expectedTick
                    })

                    strictEqual(actual.toString(), new Value(0).toString())
                })
            })

            it("throws an error if the thread input doesn't contain an assets group token", () => {
                configureContext({ inputToken: makeConfigToken() }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            diff_counted.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                d_lovelace: 0,
                                expected_tick: expectedTick
                            })
                        })
                    }
                )
            })

            it("throws an error if the thread input contains an assets group token with a negative quantity", () => {
                configureContext({
                    inputToken: makeAssetsToken(groupId, -1)
                }).use((currentScript, ctx) => {
                    throws(() => {
                        diff_counted.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            d_lovelace: 0,
                            expected_tick: expectedTick
                        })
                    })
                })
            })

            it("throws an error if the thread output isn't at the assets_validator address", () => {
                configureContext({
                    outputAddress: Address.dummy(false)
                }).use((currentScript, ctx) => {
                    throws(() => {
                        diff_counted.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            d_lovelace: 0,
                            expected_tick: expectedTick
                        })
                    })
                })
            })

            it("throws an error if the thread output doesn't contain an assets group token", () => {
                configureContext({
                    outputToken: makeConfigToken()
                }).use((currentScript, ctx) => {
                    throws(() => {
                        diff_counted.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            d_lovelace: 0,
                            expected_tick: expectedTick
                        })
                    })
                })
            })

            it("throws an error if the thread output contains more than one assets group token", () => {
                configureContext({
                    outputToken: makeAssetsToken(groupId, 2)
                }).use((currentScript, ctx) => {
                    throws(() => {
                        diff_counted.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            d_lovelace: 0,
                            expected_tick: expectedTick
                        })
                    })
                })
            })

            it("throws an error if the thread output tick doesn't match the expected tick", () => {
                configureContext().use((currentScript, ctx) => {
                    throws(() => {
                        diff_counted.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            d_lovelace: 0,
                            expected_tick: expectedTick + 1
                        })
                    })
                })
            })

            it("returns a pure lovelace value if the amount of lovelace changed", () => {
                configureContext().use((currentScript, ctx) => {
                    const lovelace = 2_000_000n
                    const actual = diff_counted.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        d_lovelace: lovelace,
                        expected_tick: expectedTick
                    })

                    strictEqual(actual.lovelace, lovelace)
                    strictEqual(actual.assets.assets.length, 0)
                })
            })
        })
    })

    describe("two asset groups threads, the first with a one asset, the second with three assets", () => {
        const expectedTick = 0

        const groupId0 = 0
        const ac0 = AssetClass.dummy(0)
        const groupId1 = 1
        const ac1 = AssetClass.dummy(1)
        const ac2 = AssetClass.dummy(2)
        const ac3 = AssetClass.dummy(3)
        const priceTimestamp = 123

        const configureParentContext = (props?: {
            secondGroupOutputLength?: number
            secondGroupInputLength?: number
            lastOutputAssetClass?: AssetClass
            lastOutputCountTick?: number
            lastOutputPrice?: RatioType
            lastOutputPriceTimestamp?: number
        }) => {
            const inputAssets0 = [
                makeAsset({
                    assetClass: ac0,
                    price: [1, 1],
                    count: 0,
                    priceTimestamp
                })
            ]
            const outputAssets0 = [
                makeAsset({
                    assetClass: ac0,
                    price: [1, 1],
                    count: 12,
                    countTick: expectedTick,
                    priceTimestamp
                })
            ]

            const inputAssets1 = [
                makeAsset({
                    assetClass: ac1,
                    count: 10,
                    price: [2, 1],
                    priceTimestamp
                }),
                makeAsset({
                    assetClass: ac2,
                    count: 20,
                    price: [3, 1],
                    priceTimestamp
                }),
                makeAsset({
                    assetClass: ac3,
                    count: 30,
                    price: [4, 1],
                    priceTimestamp
                })
            ]
            const outputAssets1 = [
                makeAsset({
                    assetClass: ac1,
                    count: 15,
                    countTick: expectedTick,
                    price: [2, 1],
                    priceTimestamp
                }),
                makeAsset({
                    assetClass: ac2,
                    count: 25,
                    countTick: expectedTick,
                    price: [3, 1],
                    priceTimestamp
                }),
                makeAsset({
                    assetClass: props?.lastOutputAssetClass ?? ac3,
                    count: 0,
                    countTick: props?.lastOutputCountTick ?? expectedTick,
                    price: props?.lastOutputPrice ?? [4, 1],
                    priceTimestamp:
                        props?.lastOutputPriceTimestamp ?? priceTimestamp
                })
            ]

            return new ScriptContextBuilder()
                .addDummyInputs(5)
                .addDummyOutputs(5)
                .addAssetGroupThread({
                    id: groupId0,
                    inputAssets: inputAssets0,
                    outputAssets: outputAssets0
                })
                .addDummyInputs(2)
                .addDummyOutputs(2)
                .addAssetGroupThread({
                    id: groupId1,
                    inputAssets: inputAssets1.slice(
                        0,
                        props?.secondGroupInputLength ?? inputAssets1.length
                    ),
                    outputAssets: outputAssets1.slice(
                        0,
                        props?.secondGroupOutputLength ?? outputAssets1.length
                    )
                })
                .redeemDummyTokenWithDvpPolicy()
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            it("returns the expected value", () => {
                configureContext().use((currentScript, ctx) => {
                    const actual = diff_counted.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        d_lovelace: 2_000_000n,
                        expected_tick: expectedTick
                    })

                    const expected = new Value(
                        2_000_000n,
                        Assets.fromAssetClasses([
                            [ac0, 12],
                            [ac1, 5],
                            [ac2, 5],
                            [ac3, -30]
                        ])
                    )

                    strictEqual(actual.isEqual(expected), true)
                })
            })

            it("throws an error if the output assets list is shorter than the input assets list", () => {
                configureContext({ secondGroupOutputLength: 2 }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            diff_counted.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                d_lovelace: 2_000_000n,
                                expected_tick: expectedTick
                            })
                        })
                    }
                )
            })

            it("throws an error if the input assets list is shorter than the output assets list", () => {
                configureContext({ secondGroupInputLength: 2 }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            diff_counted.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                d_lovelace: 2_000_000n,
                                expected_tick: expectedTick
                            })
                        })
                    }
                )
            })

            it("throws an error if one of the asset classes changed", () => {
                configureContext({
                    lastOutputAssetClass: AssetClass.dummy(5)
                }).use((currentScript, ctx) => {
                    throws(() => {
                        diff_counted.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            d_lovelace: 2_000_000n,
                            expected_tick: expectedTick
                        })
                    })
                })
            })

            it("throws an error if one of the count ticks doesn't match the expected tick", () => {
                configureContext({ lastOutputCountTick: expectedTick + 1 }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            diff_counted.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                d_lovelace: 2_000_000n,
                                expected_tick: expectedTick
                            })
                        })
                    }
                )
            })

            it("throws an error if one of the asset prices changed", () => {
                configureContext({ lastOutputPrice: [40, 10] }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            diff_counted.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                d_lovelace: 2_000_000n,
                                expected_tick: expectedTick
                            })
                        })
                    }
                )
            })

            it("throws an error if one of the asset price timestamps changed", () => {
                configureContext({ lastOutputPriceTimestamp: 124 }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            diff_counted.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                d_lovelace: 2_000_000n,
                                expected_tick: expectedTick
                            })
                        })
                    }
                )
            })
        })
    })
})

describe("Vault::counters_are_consistent", () => {
    describe("only lovelace difference", () => {
        const configureParentContext = () => {
            return new ScriptContextBuilder()
                .takeFromVault({ value: new Value(2_000_000n) })
                .sendToVault({ value: new Value(4_000_000n) })
                .redeemDummyTokenWithDvpPolicy()
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            it("returns true if d_lovelace matches the actual lovelace difference", () => {
                configureContext().use((currentScript, ctx) => {
                    strictEqual(
                        counters_are_consistent.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            d_lovelace: 2_000_000n,
                            tick: 0
                        }),
                        true
                    )
                })
            })

            it("returns false if d_lovelace doesn't match the actual lovelace difference", () => {
                configureContext().use((currentScript, ctx) => {
                    strictEqual(
                        counters_are_consistent.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            d_lovelace: 0n,
                            tick: 0
                        }),
                        false
                    )
                })
            })
        })
    })

    describe("two asset groups, the first with one asset, the second with three assets", () => {
        const expectedTick = 0

        const groupId0 = 0
        const ac0 = AssetClass.dummy(0)
        const groupId1 = 1
        const ac1 = AssetClass.dummy(1)
        const ac2 = AssetClass.dummy(2)
        const ac3 = AssetClass.dummy(3)
        const priceTimestamp = 123

        const configureParentContext = (props?: {
            reverseSecondGroup?: boolean
            reverseSecondGroupOutputs?: boolean
            lovelaceDiff?: number
        }) => {
            const inputAssets0 = [
                makeAsset({
                    assetClass: ac0,
                    price: [1, 1],
                    count: 0,
                    priceTimestamp
                })
            ]
            const outputAssets0 = [
                makeAsset({
                    assetClass: ac0,
                    price: [1, 1],
                    count: 12,
                    countTick: expectedTick,
                    priceTimestamp
                })
            ]

            const inputAssets1 = [
                makeAsset({
                    assetClass: ac1,
                    count: 10,
                    price: [2, 1],
                    priceTimestamp
                }),
                makeAsset({
                    assetClass: ac2,
                    count: 20,
                    price: [3, 1],
                    priceTimestamp
                }),
                makeAsset({
                    assetClass: ac3,
                    count: 30,
                    price: [4, 1],
                    priceTimestamp
                })
            ]
            const outputAssets1 = [
                makeAsset({
                    assetClass: ac1,
                    count: 15,
                    countTick: expectedTick,
                    price: [2, 1],
                    priceTimestamp
                }),
                makeAsset({
                    assetClass: ac2,
                    count: 25,
                    countTick: expectedTick,
                    price: [3, 1],
                    priceTimestamp
                }),
                makeAsset({
                    assetClass: ac3,
                    count: 0,
                    countTick: expectedTick,
                    price: [4, 1],
                    priceTimestamp: priceTimestamp
                })
            ]

            if (props?.reverseSecondGroup) {
                inputAssets1.reverse()
            }

            if (props?.reverseSecondGroup ?? props?.reverseSecondGroupOutputs) {
                outputAssets1.reverse()
            }

            const lovelaceDiff = props?.lovelaceDiff ?? 0

            return new ScriptContextBuilder()
                .takeFromVault({
                    value: new Value(
                        lovelaceDiff < 0 ? -lovelaceDiff : 0,
                        Assets.fromAssetClasses([
                            [ac2, 20],
                            [ac3, 30]
                        ])
                    )
                })
                .sendToVault({
                    value: new Value(0, Assets.fromAssetClasses([[ac0, 12]]))
                })
                .sendToVault({
                    value: new Value(0, Assets.fromAssetClasses([[ac1, 5]]))
                })
                .sendToVault({
                    value: new Value(
                        lovelaceDiff > 0 ? lovelaceDiff : 0,
                        Assets.fromAssetClasses([[ac2, 25]])
                    )
                })
                .addDummyInputs(5)
                .addDummyOutputs(5)
                .addAssetGroupThread({
                    id: groupId0,
                    inputAssets: inputAssets0,
                    outputAssets: outputAssets0
                })
                .addDummyInputs(2)
                .addDummyOutputs(2)
                .addAssetGroupThread({
                    id: groupId1,
                    inputAssets: inputAssets1,
                    outputAssets: outputAssets1
                })
                .redeemDummyTokenWithDvpPolicy()
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            it("returns true if d_lovelace is 0", () => {
                configureContext().use((currentScript, ctx) => {
                    strictEqual(
                        counters_are_consistent.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            d_lovelace: 0,
                            tick: expectedTick
                        }),
                        true
                    )
                })
            })

            it("returns false if d_lovelace larger than zero, but the actual vault lovelace value change is zero", () => {
                configureContext().use((currentScript, ctx) => {
                    strictEqual(
                        counters_are_consistent.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            d_lovelace: 1000,
                            tick: expectedTick
                        }),
                        false
                    )
                })
            })

            it("returns false if d_lovelace is smaller than zero, but the actual vault lovelace value change is zero", () => {
                configureContext().use((currentScript, ctx) => {
                    strictEqual(
                        counters_are_consistent.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            d_lovelace: -1000,
                            tick: expectedTick
                        }),
                        false
                    )
                })
            })

            it("returns false if d_lovelace is 0, but the actual vault lovelace value change is larger than zero", () => {
                configureContext({ lovelaceDiff: 1000 }).use(
                    (currentScript, ctx) => {
                        strictEqual(
                            counters_are_consistent.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                d_lovelace: 0,
                                tick: expectedTick
                            }),
                            false
                        )
                    }
                )
            })

            it("returns false if d_lovelace is 0, but the actual vault lovelace value change is smaller than zero", () => {
                configureContext({ lovelaceDiff: -1000 }).use(
                    (currentScript, ctx) => {
                        strictEqual(
                            counters_are_consistent.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                d_lovelace: 0,
                                tick: expectedTick
                            }),
                            false
                        )
                    }
                )
            })

            it("returns true if d_lovelace is larger than zero and equal to the actual vault lovelace value change", () => {
                configureContext({ lovelaceDiff: 1000 }).use(
                    (currentScript, ctx) => {
                        strictEqual(
                            counters_are_consistent.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                d_lovelace: 1000,
                                tick: expectedTick
                            }),
                            true
                        )
                    }
                )
            })

            it("returns true if d_lovelace is smaller than zero and equal to the actual vault lovelace value change", () => {
                configureContext({ lovelaceDiff: -1000 }).use(
                    (currentScript, ctx) => {
                        strictEqual(
                            counters_are_consistent.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                d_lovelace: -1000,
                                tick: expectedTick
                            }),
                            true
                        )
                    }
                )
            })

            it("throws an error if none of the assets have the expected tick", () => {
                configureContext({ lovelaceDiff: -1000 }).use(
                    (currentScript, ctx) => {
                        throws(() =>
                            counters_are_consistent.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                d_lovelace: -1000,
                                tick: expectedTick + 1
                            })
                        )
                    }
                )
            })

            it("returns true if assets in second group are reversed", () => {
                configureContext({ reverseSecondGroup: true }).use(
                    (currentScript, ctx) => {
                        strictEqual(
                            counters_are_consistent.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                d_lovelace: 0,
                                tick: expectedTick
                            }),
                            true
                        )
                    }
                )
            })

            it("throws an error if the output assets are in a different order from the input assets", () => {
                configureContext({ reverseSecondGroupOutputs: true }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            counters_are_consistent.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                d_lovelace: 0,
                                tick: expectedTick
                            })
                        })
                    }
                )
            })
        })
    })
})
