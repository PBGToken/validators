import { deepEqual, strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { type ShelleyAddress, AssetClass, Assets, makeAssets, makeDummyAddress, makeDummyAssetClass, makeValue } from "@helios-lang/ledger"
import { makeIntData } from "@helios-lang/uplc"
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
    it("Vault::VAULT_DATUM #01 (equal to empty bytearray)", () => {
        deepEqual(VAULT_DATUM.eval({}), [])
    })
})

describe("Vault::nothing_spent", () => {
    it("Vault::nothing_spent #01 (returns false if a vault asset UTxO is spent)", () => {
        new ScriptContextBuilder()
            .takeFromVault({ value: makeValue(2_000_000n) })
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
            .takeFromVault({ value: makeValue(2_000_000n) })
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

    it("Vault::nothing_spent #02 (returns false if an asset group is spent)", () => {
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

    it("Vault::nothing_spent #03 (true if nothing from vault nor from assets_validator address is spent)", () => {
        new ScriptContextBuilder()
            .addPriceThread({ redeemer: makeIntData(0) })
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
                .takeFromVault({ value: makeValue(2_000_000) })
                .sendToVault({ value: makeValue(2_000_000) })

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

            it("Vault::diff #01 (returns zero if no real change to vault)", () => {
                configureContext().use((currentScript, ctx) => {
                    const v = diff.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    })

                    strictEqual(v.isEqual(makeValue(0)), true)
                })
            })

            it("Vault::diff #02 (throws an error if the current input doesn't contain a policy token)", () => {
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

            it("Vault::diff #03 (returns zero if no real change to vault)", () => {
                configureContext({ omitDummyPolicyRedeemer: true }).use(
                    (currentScript, ctx) => {
                        const v = diff.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })

                        strictEqual(v.isEqual(makeValue(0)), true)
                    }
                )
            })
        })

        describe("@ all validators", () => {
            it("Vault::diff #04 (returns the correct sum over multiple inputs and outputs)", () => {
                new ScriptContextBuilder()
                    .takeFromVault({ value: makeValue(1_000_000) })
                    .takeFromVault({ value: makeValue(2_000_000) })
                    .takeFromVault({ value: makeValue(10_000_000) })
                    .sendToVault({ value: makeValue(15_000_000) })
                    .sendToVault({ value: makeValue(2_000_000) })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            const v = diff.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })

                            strictEqual(v.isEqual(makeValue(4_000_000)), true)
                        })
                    })
            })

            it("Vault::diff #05 (ignores outputs sent to vault with multiple assets)", () => {
                new ScriptContextBuilder()
                    .takeFromVault({ value: makeValue(1_000_000) })
                    .takeFromVault({ value: makeValue(2_000_000) })
                    .takeFromVault({ value: makeValue(10_000_000) })
                    .sendToVault({
                        value: makeValue(
                            15_000_000,
                            makeAssets([
                                [makeDummyAssetClass(0), 10],
                                [makeDummyAssetClass(1), 20]
                            ])
                        )
                    })
                    .sendToVault({
                        value: makeValue(
                            2_000_000,
                            makeAssets([[makeDummyAssetClass(0), 10]])
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
                                    makeValue(
                                        -11_000_000,
                                        makeAssets([
                                            [makeDummyAssetClass(0), 10]
                                        ])
                                    )
                                ),
                                true
                            )
                        })
                    })
            })

            it("Vault::diff #06 (throws an error for outputs sent back to vault with wrong datum)", () => {
                new ScriptContextBuilder()
                    .takeFromVault({ value: makeValue(2_000_000) })
                    .sendToVault({
                        datum: makeIntData(0),
                        value: makeValue(2_000_000)
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

            it("Vault::diff #07 (returns a negative asset value if assets are taken out (i.e. value into transaction))", () => {
                const ac = makeDummyAssetClass()

                new ScriptContextBuilder()
                    .takeFromVault({
                        value: makeValue(
                            0,
                            makeAssets([[ac, 1_000_000n]])
                        )
                    })
                    .sendToVault({ value: makeValue(0) })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            const v = diff.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })

                            strictEqual(v.assets.getAssetClassQuantity(ac), -1_000_000n)
                        })
                    })
            })
        })
    })
})

describe("Vault::diff_lovelace", () => {
    it("Vault::diff_lovelace #01 (throws an error if the config UTxO isn't referenced or spent)", () => {
        new ScriptContextBuilder()
            .takeFromVault({ value: makeValue(1_000_000) })
            .sendToVault({ value: makeValue(10_000_000) })
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

    it("Vault::diff_lovelace #02 (throws an error if the tx validity time-range isn't set)", () => {
        new ScriptContextBuilder()
            .takeFromVault({ value: makeValue(1_000_000) })
            .sendToVault({ value: makeValue(10_000_000) })
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

    it("Vault::diff_lovelace #03 (returns the correctly summed pure lovelace without asset counters (in scripts that have direct access to policy without dummy redeemer))", () => {
        new ScriptContextBuilder()
            .takeFromVault({ value: makeValue(1_000_000) })
            .sendToVault({ value: makeValue(10_000_000) })
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

    it("Vault::diff_lovelace #04 (returns the correctly summed pure lovelace without asset counters (in scripts that don't have direct access to policy, so with dummy redeemer))", () => {
        new ScriptContextBuilder()
            .takeFromVault({ value: makeValue(1_000_000) })
            .sendToVault({ value: makeValue(10_000_000) })
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

    it("Vault::diff_lovelace #05 (throws an error for scripts that don't have direct access to policy if current input doesn't contain a policy token)", () => {
        new ScriptContextBuilder()
            .takeFromVault({ value: makeValue(1_000_000) })
            .sendToVault({ value: makeValue(10_000_000) })
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
        const assets = [makeAsset({})]
        const groupId = 0
        const configureParentContext = (props?: {
            inputToken?: Assets
            outputAddress?: ShelleyAddress
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

            const defaultTestArgs = {
                d_lovelace: 0,
                asset_group_output_ptrs: [5]
            }

            it("Vault::diff_counted #01 (returns zero)", () => {
                configureContext().use((currentScript, ctx) => {
                    const actual = diff_counted.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })

                    strictEqual(actual.toString(), makeValue(0).toString())
                })
            })

            it("Vault::diff_counted #02 (throws an error if the thread input doesn't contain an assets group token)", () => {
                configureContext({ inputToken: makeConfigToken() }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            diff_counted.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                ...defaultTestArgs
                            })
                        })
                    }
                )
            })

            it("Vault::diff_counted #03 (throws an error if the thread input contains an assets group token with a negative quantity)", () => {
                configureContext({
                    inputToken: makeAssetsToken(groupId, -1)
                }).use((currentScript, ctx) => {
                    throws(() => {
                        diff_counted.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        })
                    })
                })
            })

            it("Vault::diff_counted #04 (throws an error if the thread output isn't at the assets_validator address)", () => {
                configureContext({
                    outputAddress: makeDummyAddress(false)
                }).use((currentScript, ctx) => {
                    throws(() => {
                        diff_counted.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        })
                    })
                })
            })

            it("Vault::diff_counted #05 (throws an error if the thread output doesn't contain an assets group token)", () => {
                configureContext({
                    outputToken: makeConfigToken()
                }).use((currentScript, ctx) => {
                    throws(() => {
                        diff_counted.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        })
                    })
                })
            })

            it("Vault::diff_counted #06 (throws an error if the thread output contains more than one assets group token)", () => {
                configureContext({
                    outputToken: makeAssetsToken(groupId, 2)
                }).use((currentScript, ctx) => {
                    throws(() => {
                        diff_counted.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        })
                    })
                })
            })

            it("Vault::diff_counted #07 (returns a pure lovelace value if the amount of lovelace changed)", () => {
                configureContext().use((currentScript, ctx) => {
                    const lovelace = 2_000_000n
                    const actual = diff_counted.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        d_lovelace: lovelace
                    })

                    strictEqual(actual.lovelace, lovelace)
                    strictEqual(actual.assets.assets.length, 0)
                })
            })
        })
    })

    describe("two asset groups threads, the first with a one asset, the second with three assets", () => {
        const groupId0 = 0
        const ac0 = makeDummyAssetClass(0)
        const groupId1 = 1
        const ac1 = makeDummyAssetClass(1)
        const ac2 = makeDummyAssetClass(2)
        const ac3 = makeDummyAssetClass(3)
        const priceTimestamp = 123

        const configureParentContext = (props?: {
            secondGroupOutputLength?: number
            secondGroupInputLength?: number
            secondGroupExtraTokens?: Assets
            lastOutputAssetClass?: AssetClass
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
                    price: [2, 1],
                    priceTimestamp
                }),
                makeAsset({
                    assetClass: ac2,
                    count: 25,
                    price: [3, 1],
                    priceTimestamp
                }),
                makeAsset({
                    assetClass: props?.lastOutputAssetClass ?? ac3,
                    count: 0,
                    price: props?.lastOutputPrice ?? [4, 1],
                    priceTimestamp:
                        props?.lastOutputPriceTimestamp ?? priceTimestamp
                })
            ]

            let secondGroupToken = makeAssetsToken(groupId1)
            if (props?.secondGroupExtraTokens) {
                secondGroupToken = secondGroupToken.add(
                    props.secondGroupExtraTokens
                )
            }

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
                    ),
                    outputToken: secondGroupToken
                })
                .redeemDummyTokenWithDvpPolicy()
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            const defaultTestArgs = {
                d_lovelace: 2_000_000n,
                asset_group_output_ptrs: [5, 8]
            }

            const expected = makeValue(
                2_000_000n,
                makeAssets([
                    [ac0, 12],
                    [ac1, 5],
                    [ac2, 5],
                    [ac3, -30]
                ])
            )

            it("Vault::diff_counted #08 (returns the expected value)", () => {
                configureContext().use((currentScript, ctx) => {
                    const actual = diff_counted.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })

                    strictEqual(actual.isEqual(expected), true)
                })
            })

            it("Vault::diff_counted #09 (throws an error if the output assets list is shorter than the input assets list)", () => {
                configureContext({ secondGroupOutputLength: 2 }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            diff_counted.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                ...defaultTestArgs
                            })
                        })
                    }
                )
            })

            it("Vault::diff_counted #10 (throws an error if the input assets list is shorter than the output assets list)", () => {
                configureContext({ secondGroupInputLength: 2 }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            diff_counted.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                ...defaultTestArgs
                            })
                        })
                    }
                )
            })

            it("Vault::diff_counted #11 (throws an error if one of the asset classes changed)", () => {
                configureContext({
                    lastOutputAssetClass: makeDummyAssetClass(5)
                }).use((currentScript, ctx) => {
                    throws(() => {
                        diff_counted.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        })
                    })
                })
            })

            it("Vault::diff_counted #12 (throws an error if one of the asset prices changed)", () => {
                configureContext({ lastOutputPrice: [39, 10] }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            diff_counted.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                ...defaultTestArgs
                            })
                        })
                    }
                )
            })

            it("Vault::diff_counted #13 (throws an error if one of the asset price timestamps changed)", () => {
                configureContext({ lastOutputPriceTimestamp: 124 }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            diff_counted.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                ...defaultTestArgs
                            })
                        })
                    }
                )
            })

            it("Vault::diff_counted #14 (throws an error if the second asset group output contains an additional token)", () => {
                configureContext({
                    secondGroupExtraTokens: makeAssets([
                        [makeDummyAssetClass(123), 1]
                    ])
                }).use((currentScript, ctx) => {
                    throws(() => {
                        diff_counted.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        })
                    })
                })
            })

            it("Vault::diff_counted #15 (throws an error if the second asset group output pointer is wrong)", () => {
                configureContext().use((currentScript, ctx) => {
                    throws(() => {
                        diff_counted.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ...defaultTestArgs,
                            asset_group_output_ptrs:
                                defaultTestArgs.asset_group_output_ptrs
                                    .slice(0, 1)
                                    .concat([9])
                        })
                    })
                })
            })
        })
    })
})

describe("Vault::counters_are_consistent", () => {
    describe("only lovelace difference", () => {
        const configureParentContext = () => {
            return new ScriptContextBuilder()
                .takeFromVault({ value: makeValue(2_000_000n) })
                .sendToVault({ value: makeValue(4_000_000n) })
                .redeemDummyTokenWithDvpPolicy()
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            const defaultTestArgs = {
                d_lovelace: 2_000_000n,
                asset_group_output_ptrs: []
            }

            it("Vault::counters_are_consistent #01 (returns true if d_lovelace matches the actual lovelace difference)", () => {
                configureContext().use((currentScript, ctx) => {
                    strictEqual(
                        counters_are_consistent.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        }),
                        true
                    )
                })
            })

            it("Vault::counters_are_consistent #02 (returns false if d_lovelace doesn't match the actual lovelace difference)", () => {
                configureContext().use((currentScript, ctx) => {
                    strictEqual(
                        counters_are_consistent.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ...defaultTestArgs,
                            d_lovelace: 0n
                        }),
                        false
                    )
                })
            })
        })
    })

    describe("two asset groups, the first with one asset, the second with three assets", () => {
        const groupId0 = 0
        const ac0 = makeDummyAssetClass(0)
        const groupId1 = 1
        const ac1 = makeDummyAssetClass(1)
        const ac2 = makeDummyAssetClass(2)
        const ac3 = makeDummyAssetClass(3)
        const priceTimestamp = 123

        const configureParentContext = (props?: {
            reverseSecondGroup?: boolean
            reverseSecondGroupOutputs?: boolean
            secondGroupExtraTokens?: Assets
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
                    price: [2, 1],
                    priceTimestamp
                }),
                makeAsset({
                    assetClass: ac2,
                    count: 25,
                    price: [3, 1],
                    priceTimestamp
                }),
                makeAsset({
                    assetClass: ac3,
                    count: 0,
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

            let secondGroupToken = makeAssetsToken(groupId1)
            if (props?.secondGroupExtraTokens) {
                secondGroupToken = secondGroupToken.add(
                    props.secondGroupExtraTokens
                )
            }

            return new ScriptContextBuilder()
                .takeFromVault({
                    value: makeValue(
                        lovelaceDiff < 0 ? -lovelaceDiff : 0,
                        makeAssets([
                            [ac2, 20],
                            [ac3, 30]
                        ])
                    )
                })
                .sendToVault({
                    value: makeValue(0, makeAssets([[ac0, 12]]))
                })
                .sendToVault({
                    value: makeValue(0, makeAssets([[ac1, 5]]))
                })
                .sendToVault({
                    value: makeValue(
                        lovelaceDiff > 0 ? lovelaceDiff : 0,
                        makeAssets([[ac2, 25]])
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
                    outputAssets: outputAssets1,
                    outputToken: secondGroupToken
                })
                .redeemDummyTokenWithDvpPolicy()
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            const defaultTestArgs = {
                d_lovelace: 0,
                asset_group_output_ptrs: [8, 11]
            }

            it("Vault::counters_are_consistent #03 (returns true if d_lovelace is 0)", () => {
                configureContext().use((currentScript, ctx) => {
                    strictEqual(
                        counters_are_consistent.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        }),
                        true
                    )
                })
            })

            it("Vault::counters_are_consistent #04 (returns false if d_lovelace larger than zero, but the actual vault lovelace value change is zero)", () => {
                configureContext().use((currentScript, ctx) => {
                    strictEqual(
                        counters_are_consistent.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ...defaultTestArgs,
                            d_lovelace: 1000
                        }),
                        false
                    )
                })
            })

            it("Vault::counters_are_consistent #04 (returns false if d_lovelace is smaller than zero, but the actual vault lovelace value change is zero)", () => {
                configureContext().use((currentScript, ctx) => {
                    strictEqual(
                        counters_are_consistent.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ...defaultTestArgs,
                            d_lovelace: -1000
                        }),
                        false
                    )
                })
            })

            it("Vault::counters_are_consistent #05 (returns false if d_lovelace is 0, but the actual vault lovelace value change is larger than zero)", () => {
                configureContext({ lovelaceDiff: 1000 }).use(
                    (currentScript, ctx) => {
                        strictEqual(
                            counters_are_consistent.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                ...defaultTestArgs
                            }),
                            false
                        )
                    }
                )
            })

            it("Vault::counters_are_consistent #06 (returns false if d_lovelace is 0, but the actual vault lovelace value change is smaller than zero)", () => {
                configureContext({ lovelaceDiff: -1000 }).use(
                    (currentScript, ctx) => {
                        strictEqual(
                            counters_are_consistent.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                ...defaultTestArgs
                            }),
                            false
                        )
                    }
                )
            })

            it("Vault::counters_are_consistent #07 (returns true if d_lovelace is larger than zero and equal to the actual vault lovelace value change)", () => {
                configureContext({ lovelaceDiff: 1000 }).use(
                    (currentScript, ctx) => {
                        strictEqual(
                            counters_are_consistent.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                ...defaultTestArgs,
                                d_lovelace: 1000
                            }),
                            true
                        )
                    }
                )
            })

            it("Vault::counters_are_consistent #08 (returns true if d_lovelace is smaller than zero and equal to the actual vault lovelace value change)", () => {
                configureContext({ lovelaceDiff: -1000 }).use(
                    (currentScript, ctx) => {
                        strictEqual(
                            counters_are_consistent.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                ...defaultTestArgs,
                                d_lovelace: -1000
                            }),
                            true
                        )
                    }
                )
            })

            it("Vault::counters_are_consistent #09 (returns true if assets in second group are reversed)", () => {
                configureContext({ reverseSecondGroup: true }).use(
                    (currentScript, ctx) => {
                        strictEqual(
                            counters_are_consistent.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                ...defaultTestArgs
                            }),
                            true
                        )
                    }
                )
            })

            it("Vault::counters_are_consistent #10 (throws an error if the output assets are in a different order from the input assets)", () => {
                configureContext({ reverseSecondGroupOutputs: true }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            counters_are_consistent.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                ...defaultTestArgs
                            })
                        })
                    }
                )
            })

            it("Vault::counters_are_consistent #11 (throws an error if second asset group output contains additional tokens)", () => {
                configureContext({
                    secondGroupExtraTokens: makeAssets([
                        [makeDummyAssetClass(123), 1]
                    ])
                }).use((currentScript, ctx) => {
                    throws(() => {
                        counters_are_consistent.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        })
                    })
                })
            })
        })
    })
})
