import { deepEqual, strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import {
    type Assets,
    type ShelleyAddress,
    makeDummyAddress,
    makeDummyAssetClass,
    makeDummyStakingValidatorHash,
    makeShelleyAddress
} from "@helios-lang/ledger"
import contract from "pbg-token-validators-test-context"
import { indirectPolicyScripts, scripts } from "./constants"
import { AssetGroupAction, AssetType, makeAsset } from "./data"
import { makeAssetsToken, makeConfigToken } from "./tokens"
import { ScriptContextBuilder, withScripts } from "./tx"

const {
    "AssetGroup::MAX_SIZE": MAX_SIZE,
    "AssetGroup::find_current": find_current,
    "AssetGroup::find_output": find_output,
    "AssetGroup::find_output_asset": find_output_asset,
    "AssetGroup::find_input_asset": find_input_asset,
    "AssetGroup::find_single_input": find_single_input,
    "AssetGroup::find_asset": find_asset,
    "AssetGroup::has_asset": has_asset,
    "AssetGroup::is_empty": is_empty,
    "AssetGroup::is_not_overfull": is_not_overfull,
    "AssetGroup::nothing_spent": nothing_spent,
    search_for_asset_class,
    sum_total_asset_value
} = contract.AssetGroupModule

/**
 * Max number of assets per AssetGroup
 */
const expectedMaxSize = 3

describe("AssetGroupModule::AssetGroup::MAX_SIZE", () => {
    it("equals 3", () => {
        strictEqual(MAX_SIZE.eval({}), BigInt(expectedMaxSize))
    })
})

describe("AssetGroupModule::AssetGroup::find_current", () => {
    describe("the tx has a single asset group input, with a single asset", () => {
        const assets = [makeAsset()]
        const redeemer: AssetGroupAction = { Count: { supply_ptr: 1 } }
        const groupId = 123n

        const configureParentContext = (props?: {
            address?: ShelleyAddress
            token?: Assets
        }) => {
            return new ScriptContextBuilder().addAssetGroupInput({
                assets,
                redeemer,
                id: groupId,
                address: props?.address,
                token: props?.token
            })
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            it("AssetGroupModule::AssetGroup::find_current #01 (returns the asset group id and data if the current input contains an asset group token)", () => {
                configureContext().use((currentScript, ctx) => {
                    deepEqual(
                        find_current.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }),
                        [groupId, { assets }]
                    )
                })
            })

            it("AssetGroupModule::AssetGroup::find_current #02 (returns the asset group id and data even if the asset group UTxO, containing an asset group token, is at the wrong address)", () => {
                configureContext({ address: makeDummyAddress(false) }).use(
                    (currentScript, ctx) => {
                        deepEqual(
                            find_current.eval({
                                $scriptContext: ctx,
                                $currentScript: currentScript
                            }),
                            [groupId, { assets }]
                        )
                    }
                )
            })

            it("AssetGroupModule::AssetGroup::find_current #03 (throws an error if the asset group UTxO doesn't contain an asset group token)", () => {
                configureContext({ token: makeConfigToken() }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            find_current.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                        })
                    }
                )
            })
        })
    })
})

describe("AssetGroupModule::AssetGroup::find_output", () => {
    describe("the tx has a single asset group output, with a single asset", () => {
        const assets = [makeAsset()]
        const groupId = 123n

        const configureParentContext = (props?: {
            address?: ShelleyAddress
            token?: Assets
            withoutDummyRedeemer?: boolean
        }) => {
            const scb = new ScriptContextBuilder().addAssetGroupOutput({
                id: groupId,
                assets,
                address: props?.address,
                token: props?.token
            })

            if (props?.withoutDummyRedeemer) {
                return scb
            } else {
                return scb.redeemDummyTokenWithDvpPolicy()
            }
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            it("AssetGroupModule::AssetGroup::find_output #01 (returns the group data if the asset group output containing the asset group token is sent to the assets_validator address)", () => {
                configureContext().use((currentScript, ctx) => {
                    deepEqual(
                        find_output.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            id: groupId
                        }),
                        { assets }
                    )
                })
            })

            it("AssetGroupModule::AssetGroup::find_output #02 (throws an error if the asset group output isn't sent to the assets_validator address)", () => {
                configureContext({ address: makeDummyAddress(false) }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            find_output.eval({
                                $scriptContext: ctx,
                                $currentScript: currentScript,
                                id: groupId
                            })
                        })
                    }
                )
            })

            it("AssetGroupModule::AssetGroup::find_output #03 (throws an error if the asset group output doesn't contain the asset group token)", () => {
                configureContext({ token: makeConfigToken() }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            find_output.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                id: groupId
                            })
                        })
                    }
                )
            })
        })

        describe("@ validators that don't have direct access to the policy", () => {
            const configureContext = withScripts(
                configureParentContext,
                indirectPolicyScripts
            )

            it("AssetGroupModule::AssetGroup::find_output #04 (throws an error if no UTxO containing a policy token is spent)", () => {
                configureContext({ withoutDummyRedeemer: true }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            find_output.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                id: groupId
                            })
                        })
                    }
                )
            })
        })
    })
})

describe("AssetGroupModule::AssetGroup::find_output_asset", () => {
    describe("the tx has a single asset group output, with a single asset", () => {
        const asset = makeAsset()
        const assets = [asset]

        const configureParentContext = () => {
            return new ScriptContextBuilder()
                .addAssetGroupOutput({
                    id: 0,
                    assets
                })
                .redeemDummyTokenWithDvpPolicy()
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            it("AssetGroupModule::AssetGroup::find_output_asset #01 (returns the asset data if found)", () => {
                configureContext().use((currentScript, ctx) => {
                    deepEqual(
                        find_output_asset.eval({
                            $scriptContext: ctx,
                            $currentScript: currentScript,
                            asset_class: asset.asset_class
                        }),
                        asset
                    )
                })
            })
        })
    })

    describe("the tx has two asset group outputs, the first with a single asset, the second with three assets", () => {
        const assets0 = [makeAsset()]
        const groupId0 = 0
        const assets1 = [
            makeAsset({ assetClass: makeDummyAssetClass(1) }),
            makeAsset({
                assetClass: makeDummyAssetClass(2)
            }),
            makeAsset({
                assetClass: makeDummyAssetClass(3)
            })
        ]
        const groupId1 = 1

        const configureParentContext = (props?: {
            firstGroupToken?: Assets
            secondGroupAddress?: ShelleyAddress
        }) => {
            return new ScriptContextBuilder()
                .addAssetGroupOutput({
                    id: groupId0,
                    assets: assets0,
                    token: props?.firstGroupToken
                })
                .addAssetGroupOutput({
                    id: groupId1,
                    assets: assets1,
                    address: props?.secondGroupAddress
                })
                .redeemDummyTokenWithDvpPolicy()
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            it("AssetGroupModule::AssetGroup::find_output_asset #02 (returns the asset data if found)", () => {
                configureContext().use((currentScript, ctx) => {
                    deepEqual(
                        find_output_asset.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            asset_class: assets1[2].asset_class
                        }),
                        assets1[2]
                    )
                })
            })

            it("AssetGroupModule::AssetGroup::find_output_asset #03 (throws an error if the asset class isn't found)", () => {
                configureContext().use((currentScript, ctx) => {
                    throws(() => {
                        find_output_asset.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            asset_class: makeDummyAssetClass(4)
                        })
                    })
                })
            })

            it("AssetGroupModule::AssetGroup::find_output_asset #04 (throws an error if one of asset group outputs doesn't contain exactly one asset group token)", () => {
                configureContext({
                    firstGroupToken: makeAssetsToken(0).add(makeConfigToken())
                }).use((currentScript, ctx) => {
                    throws(() => {
                        find_output_asset.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            asset_class: assets1[2].asset_class
                        })
                    })
                })
            })

            it("AssetGroupModule::AssetGroup::find_output_asset #05 (throws an error if an asset group output isn't at the correct address)", () => {
                configureContext({
                    secondGroupAddress: makeDummyAddress(false)
                }).use((currentScript, ctx) => {
                    throws(() => {
                        find_output_asset.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            asset_class: assets1[2].asset_class
                        })
                    })
                })
            })
        })
    })
})

describe("AssetGroupModule::AssetGroup::find_input_asset", () => {
    describe("the tx has a single asset group input, with a single asset", () => {
        const asset = makeAsset()
        const assets = [asset]

        const configureParentContext = () => {
            return new ScriptContextBuilder().addAssetGroupInput({
                id: 0,
                redeemer: { Count: { supply_ptr: 1 } },
                assets: assets
            })
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            it("AssetGroupModule::AssetGroup::find_input_asset #01 (returns the asset data if found)", () => {
                configureContext().use((currentScript, ctx) => {
                    deepEqual(
                        find_input_asset.eval({
                            $scriptContext: ctx,
                            $currentScript: currentScript,
                            asset_class: asset.asset_class
                        }),
                        asset
                    )
                })
            })
        })
    })

    describe("the tx has two asset group inputs, the first with a single asset, the second with three assets", () => {
        const assets0 = [makeAsset()]
        const groupId0 = 0
        const assets1 = [
            makeAsset({ assetClass: makeDummyAssetClass(1) }),
            makeAsset({
                assetClass: makeDummyAssetClass(2)
            }),
            makeAsset({
                assetClass: makeDummyAssetClass(3)
            })
        ]
        const groupId1 = 1

        const configureParentContext = (props?: {
            firstGroupToken?: Assets
            secondGroupAddress?: ShelleyAddress
        }) => {
            return new ScriptContextBuilder()
                .addAssetGroupInput({
                    id: groupId0,
                    assets: assets0,
                    token: props?.firstGroupToken
                })
                .addAssetGroupInput({
                    id: groupId1,
                    assets: assets1,
                    address: props?.secondGroupAddress
                })
                .redeemDummyTokenWithDvpPolicy()
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            it("AssetGroupModule::AssetGroup::find_input_asset #02 (returns the asset data if found)", () => {
                configureContext().use((currentScript, ctx) => {
                    deepEqual(
                        find_input_asset.eval({
                            $scriptContext: ctx,
                            $currentScript: currentScript,
                            asset_class: assets1[2].asset_class
                        }),
                        assets1[2]
                    )
                })
            })

            it("AssetGroupModule::AssetGroup::find_input_asset #03 (throws an error if not found)", () => {
                configureContext().use((currentScript, ctx) => {
                    throws(() => {
                        find_input_asset.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            asset_class: makeDummyAssetClass(4)
                        })
                    })
                })
            })

            it("AssetGroupModule::AssetGroup::find_input_asset #04 (throws an error if one of the asset group inputs doesn't contain exactly one asset group token)", () => {
                configureContext({
                    firstGroupToken: makeAssetsToken(0).add(makeConfigToken())
                }).use((currentScript, ctx) => {
                    throws(() => {
                        find_input_asset.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            asset_class: assets1[2].asset_class
                        })
                    })
                })
            })

            it("AssetGroupModule::AssetGroup::find_input_asset #05 (throws an error if the asset group containing the searched asset isn't at the correct address)", () => {
                configureContext({
                    secondGroupAddress: makeDummyAddress(false)
                }).use((currentScript, ctx) => {
                    throws(() => {
                        find_input_asset.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            asset_class: assets1[2].asset_class
                        })
                    })
                })
            })
        })
    })
})

describe("AssetGroupModule::AssetGroup::find_single_input", () => {
    describe("the tx has a single asset group input, with a single asset", () => {
        const assets = [makeAsset()]
        const groupId = 0n

        const configureParentContext = (props?: { token?: Assets }) => {
            return new ScriptContextBuilder().addAssetGroupInput({
                id: groupId,
                assets: assets,
                redeemer: { Count: { supply_ptr: 1 } },
                token: props?.token
            })
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            it("AssetGroupModule::AssetGroup::find_single_input #01 (returns the asset group id and data if only a single asset group UTxO is being spent)", () => {
                configureContext().use((currentScript, ctx) => {
                    deepEqual(
                        find_single_input.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }),
                        [groupId, { assets: assets }]
                    )
                })
            })

            it("AssetGroupModule::AssetGroup::find_single_input #02 (throws an error if the asset group input doesn't contain an asset group token)", () => {
                configureContext({ token: makeConfigToken() }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            find_single_input.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                        })
                    }
                )
            })
        })
    })

    describe("the tx has two asset group inputs, the first with one asset, the second with three assets", () => {
        const assets0 = [makeAsset()]
        const groupId0 = 0n
        const assets1 = [
            makeAsset({ assetClass: makeDummyAssetClass(1) }),
            makeAsset({
                assetClass: makeDummyAssetClass(2)
            }),
            makeAsset({
                assetClass: makeDummyAssetClass(3)
            })
        ]
        const groupId1 = 1n

        const configureParentContext = (props?: {
            secondGroupToken?: Assets
        }) => {
            return new ScriptContextBuilder()
                .addAssetGroupInput({
                    id: groupId0,
                    assets: assets0,
                    redeemer: { Count: { supply_ptr: 1 } }
                })
                .addAssetGroupInput({
                    id: groupId1,
                    assets: assets1,
                    token: props?.secondGroupToken
                })
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            it("AssetGroupModule::AssetGroup::find_single_input #03 (throws an error even if the second asset group doesn't contain an asset group token (only address matters for the singleton check))", () => {
                configureContext({ secondGroupToken: makeConfigToken() }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            find_single_input.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                        })
                    }
                )
            })
        })

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            it("AssetGroupModule::AssetGroup::find_single_input #04 (throws an error if both asset groups are at the asset_validator address and contain an asset group token)", () => {
                configureContext().use((currentScript, ctx) => {
                    throws(() => {
                        find_single_input.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })
                    })
                })
            })
        })
    })
})

describe("AssetGroupModule::AssetGroup::find_asset", () => {
    describe("empty asset group", () => {
        const assets: AssetType[] = []

        it("AssetGroupModule::AssetGroup::find_asset #01 (returns None if not found)", () => {
            strictEqual(
                find_asset.eval({
                    self: { assets },
                    asset_class: makeDummyAssetClass()
                }),
                undefined
            )
        })
    })

    describe("asset group with three assets", () => {
        const assets: AssetType[] = [
            makeAsset({ assetClass: makeDummyAssetClass(1) }),
            makeAsset({ assetClass: makeDummyAssetClass(2) }),
            makeAsset({ assetClass: makeDummyAssetClass(3) })
        ]

        it("AssetGroupModule::AssetGroup::find_asset #02 (returns None if the asset class isn't found)", () => {
            strictEqual(
                find_asset.eval({
                    self: { assets },
                    asset_class: makeDummyAssetClass()
                }),
                undefined
            )
        })

        it("AssetGroupModule::AssetGroup::find_asset #03 (returns Some if found as the first entry)", () => {
            deepEqual(
                find_asset.eval({
                    self: { assets },
                    asset_class: assets[0].asset_class
                }),
                assets[0]
            )
        })

        it("AssetGroupModule::AssetGroup::find_asset #04 (returns Some if found as the middle entry)", () => {
            deepEqual(
                find_asset.eval({
                    self: { assets },
                    asset_class: assets[1].asset_class
                }),
                assets[1]
            )
        })

        it("AssetGroupModule::AssetGroup::find_asset #05 (returns Some if found as the last entry)", () => {
            deepEqual(
                find_asset.eval({
                    self: { assets },
                    asset_class: assets[2].asset_class
                }),
                assets[2]
            )
        })
    })
})

describe("AssetGroupModule::AssetGroup::has_asset", () => {
    describe("empty asset group", () => {
        const assets: AssetType[] = []

        it("AssetGroupModule::AssetGroup::has_asset #01 (returns false)", () => {
            strictEqual(
                has_asset.eval({
                    self: { assets },
                    asset_class: makeDummyAssetClass()
                }),
                false
            )
        })
    })

    describe("asset group with three assets", () => {
        const assets: AssetType[] = [
            makeAsset({ assetClass: makeDummyAssetClass(1) }),
            makeAsset({ assetClass: makeDummyAssetClass(2) }),
            makeAsset({ assetClass: makeDummyAssetClass(3) })
        ]

        it("AssetGroupModule::AssetGroup::has_asset #02 (returns false if not found)", () => {
            strictEqual(
                has_asset.eval({
                    self: { assets },
                    asset_class: makeDummyAssetClass()
                }),
                false
            )
        })

        it("AssetGroupModule::AssetGroup::has_asset #03 (returns true if found as the first entry)", () => {
            strictEqual(
                has_asset.eval({
                    self: { assets },
                    asset_class: assets[0].asset_class
                }),
                true
            )
        })

        it("AssetGroupModule::AssetGroup::has_asset #04 (returns true if found as the middle entry)", () => {
            strictEqual(
                has_asset.eval({
                    self: { assets },
                    asset_class: assets[1].asset_class
                }),
                true
            )
        })

        it("AssetGroupModule::AssetGroup::has_asset #05 (returns true if found as the last entry)", () => {
            deepEqual(
                has_asset.eval({
                    self: { assets },
                    asset_class: assets[2].asset_class
                }),
                true
            )
        })
    })
})

describe("AssetGroupModule::AssetGroup::is_empty", () => {
    it("AssetGroupModule::AssetGroup::is_empty #01 (returns true for empty list)", () => {
        const assets: AssetType[] = []

        strictEqual(
            is_empty.eval({
                self: { assets }
            }),
            true
        )
    })

    it("AssetGroupModule::AssetGroup::is_empty #02 (returns false for non-empty list with one entry)", () => {
        const assets = [makeAsset()]

        strictEqual(is_empty.eval({ self: { assets } }), false)
    })

    it("AssetGroupModule::AssetGroup::is_empty #03 (returns false for non-empty list with three entries)", () => {
        const assets = [
            makeAsset({ assetClass: makeDummyAssetClass(0) }),
            makeAsset({ assetClass: makeDummyAssetClass(1) }),
            makeAsset({ assetClass: makeDummyAssetClass(2) })
        ]

        strictEqual(is_empty.eval({ self: { assets } }), false)
    })
})

describe("AssetGroupModule::AssetGroup::is_not_overfull", () => {
    it("AssetGroupModule::AssetGroup::is_not_overfull #01 (returns true for empty list)", () => {
        const assets: AssetType[] = []

        strictEqual(
            is_not_overfull.eval({
                self: { assets }
            }),
            true
        )
    })

    it("AssetGroupModule::AssetGroup::is_not_overfull #02 (returns true for full list)", () => {
        const assets: AssetType[] = []

        for (let i = 0; i < expectedMaxSize; i++) {
            assets.push(makeAsset({ assetClass: makeDummyAssetClass(i) }))
        }

        strictEqual(
            is_not_overfull.eval({
                self: { assets }
            }),
            true
        )
    })

    it("AssetGroupModule::AssetGroup::is_not_overfull #03 (returns false for list containing one more asset than the maximum)", () => {
        const assets: AssetType[] = []

        for (let i = 0; i < expectedMaxSize + 1; i++) {
            assets.push(makeAsset({ assetClass: makeDummyAssetClass(i) }))
        }

        strictEqual(
            is_not_overfull.eval({
                self: { assets }
            }),
            false
        )
    })
})

describe("AssetGroupModule::AssetGroup::nothing_spent", () => {
    it("AssetGroupModule::AssetGroup::nothing_spent #01 (returns true for an unrelated tx)", () => {
        new ScriptContextBuilder().use((ctx) => {
            strictEqual(
                nothing_spent.eval({
                    $scriptContext: ctx
                }),
                true
            )
        })
    })

    it("AssetGroupModule::AssetGroup::nothing_spent #02 (returns false if a single input is at the assets_validator address)", () => {
        new ScriptContextBuilder()
            .addDummyInputs(7)
            .addAssetGroupInput()
            .addDummyInputs(7)
            .use((ctx) => {
                strictEqual(nothing_spent.eval({ $scriptContext: ctx }), false)
            })
    })

    it("AssetGroupModule::AssetGroup::nothing_spent #03 (returns true if an input is spent from an address with the same spending credential as the assets_validator, but a non-empty staking credential)", () => {
        const similarAddress = makeShelleyAddress(
            false,
            contract.assets_validator.$hash,
            makeDummyStakingValidatorHash()
        )

        new ScriptContextBuilder()
            .addAssetGroupInput({ address: similarAddress })
            .use((ctx) => {
                strictEqual(nothing_spent.eval({ $scriptContext: ctx }), true)
            })
    })
})

describe("AssetGroupModule::search_for_asset_class", () => {
    describe("the tx references a single empty asset group", () => {
        const assets: AssetType[] = []

        const configureParentContext = () => {
            return new ScriptContextBuilder()
                .addAssetGroupRef({ assets, id: 0 })
                .redeemDummyTokenWithDvpPolicy()
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            it("AssetGroupModule::search_for_asset_class #01 (returns false if not found)", () => {
                configureContext().use((currentScript, ctx) => {
                    strictEqual(
                        search_for_asset_class.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            asset_class: makeDummyAssetClass(),
                            group_ptrs: [0],
                            first_id: 0
                        }),
                        false
                    )
                })
            })
        })
    })

    describe("the tx references a single asset group, with a single asset", () => {
        const assets = [makeAsset()]
        const groupId = 0n

        const configureParentContext = (props?: {
            address?: ShelleyAddress
        }) => {
            return new ScriptContextBuilder()
                .addAssetGroupRef({
                    address: props?.address,
                    assets,
                    id: groupId
                })
                .redeemDummyTokenWithDvpPolicy()
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            it("AssetGroupModule::search_for_asset_class #02 (returns true if found)", () => {
                configureContext().use((currentScript, ctx) => {
                    strictEqual(
                        search_for_asset_class.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            asset_class: assets[0].asset_class,
                            group_ptrs: [0],
                            first_id: 0
                        }),
                        true
                    )
                })
            })

            it("AssetGroupModule::search_for_asset_class #03 (throws an error if the pointer is out-of-range)", () => {
                configureContext().use((currentScript, ctx) => {
                    throws(() => {
                        search_for_asset_class.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            asset_class: assets[0].asset_class,
                            group_ptrs: [1],
                            first_id: 0
                        })
                    })
                })
            })

            it("AssetGroupModule::search_for_asset_class #04 (throws an error if the expected asset group id doesn't match)", () => {
                configureContext().use((currentScript, ctx) => {
                    throws(() => {
                        search_for_asset_class.eval({
                            $scriptContext: ctx,
                            $currentScript: currentScript,
                            asset_class: assets[0].asset_class,
                            group_ptrs: [0],
                            first_id: 1
                        })
                    })
                })
            })

            it("AssetGroupModule::search_for_asset_class #05 (throws an error if the asset group is at the wrong address)", () => {
                configureContext({ address: makeDummyAddress(false) }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            search_for_asset_class.eval({
                                $scriptContext: ctx,
                                $currentScript: currentScript,
                                asset_class: assets[0].asset_class,
                                group_ptrs: [0],
                                first_id: 0
                            })
                        })
                    }
                )
            })
        })
    })

    describe("the tx references a single asset group, with three assets", () => {
        const assets: AssetType[] = [
            makeAsset({ assetClass: makeDummyAssetClass(1) }),
            makeAsset({ assetClass: makeDummyAssetClass(2) }),
            makeAsset({ assetClass: makeDummyAssetClass(3) })
        ]
        const groupId = 0n

        const configureParentContext = () => {
            return new ScriptContextBuilder()
                .addAssetGroupRef({ assets, id: groupId })
                .redeemDummyTokenWithDvpPolicy()
        }
        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            it("AssetGroupModule::search_for_asset_class #06 (returns false if not found)", () => {
                configureContext().use((currentScript, ctx) => {
                    strictEqual(
                        search_for_asset_class.eval({
                            $scriptContext: ctx,
                            $currentScript: currentScript,
                            asset_class: makeDummyAssetClass(0),
                            group_ptrs: [0],
                            first_id: 0
                        }),
                        false
                    )
                })
            })
        })
    })

    describe("the tx references two asset groups, the first with three assets, the second with one asset", () => {
        const assets0: AssetType[] = [
            makeAsset({ assetClass: makeDummyAssetClass(1) }),
            makeAsset({ assetClass: makeDummyAssetClass(2) }),
            makeAsset({ assetClass: makeDummyAssetClass(3) })
        ]
        const groupId0 = 0n

        const assets1: AssetType[] = [
            makeAsset({ assetClass: makeDummyAssetClass(0) })
        ]
        const groupId1 = 1n

        const configureParentContext = (props?: {
            secondGroupId?: number
            secondGroupAddress?: ShelleyAddress
            secondGroupToken?: Assets
        }) => {
            return new ScriptContextBuilder()
                .addAssetGroupRef({ assets: assets0, id: groupId0 })
                .addDummyRefs(5)
                .addAssetGroupRef({
                    assets: assets1,
                    id: props?.secondGroupId ?? groupId1,
                    address: props?.secondGroupAddress,
                    token: props?.secondGroupToken
                })
                .redeemDummyTokenWithDvpPolicy()
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            it("AssetGroupModule::search_for_asset_class #07 (returns true if found in the second asset group)", () => {
                configureContext().use((currentScript, ctx) => {
                    strictEqual(
                        search_for_asset_class.eval({
                            $scriptContext: ctx,
                            $currentScript: currentScript,
                            asset_class: makeDummyAssetClass(0),
                            group_ptrs: [0, 6],
                            first_id: 0
                        }),
                        true
                    )
                })
            })

            it("AssetGroupModule::search_for_asset_class #08 (throws an error if found in the first asset group (which is error-free), but the second asset group doesn't have the expected id)", () => {
                configureContext({ secondGroupId: 5 }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            search_for_asset_class.eval({
                                $scriptContext: ctx,
                                $currentScript: currentScript,
                                asset_class: makeDummyAssetClass(1),
                                group_ptrs: [0, 6],
                                first_id: 0
                            })
                        })
                    }
                )
            })

            it("AssetGroupModule::search_for_asset_class #09 (throws an error if found in the first asset group (which is error-free), but the second asset group isn't at the assets_validator address)", () => {
                configureContext({
                    secondGroupAddress: makeDummyAddress(false)
                }).use((currentScript, ctx) => {
                    throws(() => {
                        search_for_asset_class.eval({
                            $scriptContext: ctx,
                            $currentScript: currentScript,
                            asset_class: makeDummyAssetClass(1),
                            group_ptrs: [0, 6],
                            first_id: 0
                        })
                    })
                })
            })

            it("AssetGroupModule::search_for_asset_class #10 (throws an error if found in the first asset group (which is error-free), but the second asset group doesn't contain the asset group token)", () => {
                configureContext({ secondGroupToken: makeConfigToken() }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            search_for_asset_class.eval({
                                $scriptContext: ctx,
                                $currentScript: currentScript,
                                asset_class: makeDummyAssetClass(1),
                                group_ptrs: [0, 6],
                                first_id: 0
                            })
                        })
                    }
                )
            })

            it("AssetGroupModule::search_for_asset_class #11 (throws an error if found in the first asset group (which is error-free), but the second asset group pointer is out-of-range)", () => {
                configureContext().use((currentScript, ctx) => {
                    throws(() => {
                        search_for_asset_class.eval({
                            $scriptContext: ctx,
                            $currentScript: currentScript,
                            asset_class: makeDummyAssetClass(1),
                            group_ptrs: [0, 7],
                            first_id: 0
                        })
                    })
                })
            })
        })
    })
})

describe("AssetGroupModule::sum_total_asset_value", () => {
    describe("the tx references a single empty asset group", () => {
        const assets: AssetType[] = []
        const groupId = 0

        const configureParentContext = (props?: {
            startTime?: number
            endTime?: number
        }) => {
            return new ScriptContextBuilder()
                .setTimeRange({ start: props?.startTime, end: props?.endTime })
                .addAssetGroupRef({ assets, id: groupId })
                .redeemDummyTokenWithDvpPolicy()
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            it("AssetGroupModule::sum_total_asset_value #01 (throws an error if the validity time range isn't set)", () => {
                configureContext().use((currentScript, ctx) => {
                    throws(() => {
                        sum_total_asset_value.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            group_ptrs: [0],
                            first_id: 0
                        })
                    }, /empty list in headList/)
                })
            })

            it("AssetGroupModule::sum_total_asset_value #02 (throws an error if the validity time start isn't set)", () => {
                configureContext({ endTime: 1000 }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            sum_total_asset_value.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                group_ptrs: [0],
                                first_id: 0
                            })
                        }, /empty list in headList/)
                    }
                )
            })

            it("AssetGroupModule::sum_total_asset_value #03 (throws an error if the validity time range end isn't set)", () => {
                configureContext({ startTime: 1000 }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            sum_total_asset_value.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                group_ptrs: [0],
                                first_id: 0
                            })
                        }, /empty list in headList/)
                    }
                )
            })

            it("AssetGroupModule::sum_total_asset_value #04 (throws an error if the validity time range interval is too large)", () => {
                configureContext({ startTime: 1000, endTime: 90_000_000 }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            sum_total_asset_value.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                group_ptrs: [0],
                                first_id: 0
                            })
                        }, /validity time range too large/)
                    }
                )
            })
        })
    })

    describe("the tx references a single asset group, with a single asset", () => {
        const priceTimestamp = 123
        const assets = [
            makeAsset({ count: 10000, price: [100, 1], priceTimestamp })
        ]

        const configureParentContext = (props?: {
            setTimeRangeStart?: boolean
        }) => {
            const scb = new ScriptContextBuilder()
                .addAssetGroupRef({ assets, id: 0 })
                .redeemDummyTokenWithDvpPolicy()

            if (props?.setTimeRangeStart ?? true) {
                scb.setTimeRange({
                    start: Number.MAX_SAFE_INTEGER,
                    end: Number.MAX_SAFE_INTEGER
                })
            }

            return scb
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            it("AssetGroupModule::sum_total_asset_value #05 (returns the price timestamp and lovelace value of the single asset)", () => {
                configureContext().use((currentScript, ctx) => {
                    deepEqual(
                        sum_total_asset_value.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            group_ptrs: [0],
                            first_id: 0
                        }),
                        [priceTimestamp, 1_000_000n]
                    )
                })
            })

            it("AssetGroupModule::sum_total_asset_value #06 (throws an error if the tx validity time range start isn't set)", () => {
                configureContext({ setTimeRangeStart: false }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            sum_total_asset_value.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                group_ptrs: [0],
                                first_id: 0
                            }),
                                /empty list in headList/
                        })
                    }
                )
            })
        })
    })

    describe("the tx references two asset groups, the first with one asset, the second with three assets", () => {
        const assets0 = [
            makeAsset({ count: 10000, price: [100, 1], priceTimestamp: 123 })
        ]
        const groupId0 = 0n

        const oldestPriceTimestamp = 121
        const assets1 = [
            makeAsset({ count: 10000, price: [100, 1], priceTimestamp: 123 }),
            makeAsset({ count: 1000, price: [200, 1], priceTimestamp: 122 }),
            makeAsset({
                count: 100,
                price: [300, 1],
                priceTimestamp: oldestPriceTimestamp
            })
        ]
        const groupId1 = 1n

        const configureParentContext = () => {
            return new ScriptContextBuilder()
                .setTimeRange({
                    start: Number.MAX_SAFE_INTEGER,
                    end: Number.MAX_SAFE_INTEGER
                })
                .addAssetGroupRef({ assets: assets0, id: groupId0 })
                .addDummyRefs(5)
                .addAssetGroupRef({ assets: assets1, id: groupId1 })
                .redeemDummyTokenWithDvpPolicy()
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            it("AssetGroupModule::sum_total_asset_value #07 (returns oldest timestamp and correct lovelace value for multiple assets)", () => {
                configureContext().use((currentScript, ctx) => {
                    deepEqual(
                        sum_total_asset_value.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            group_ptrs: [0, 6],
                            first_id: 0
                        }),
                        [oldestPriceTimestamp, 2_230_000n]
                    )
                })
            })
        })
    })

    describe("the tx references three asset groups, the first and second are empty, and the third with one asset", () => {
        const assets0: AssetType[] = []
        const groupId0 = 0
        const assets1: AssetType[] = []
        const groupId1 = 1
        const oldestPriceTimestamp = 123
        const assets2 = [
            makeAsset({
                count: 10000,
                price: [100, 1],
                priceTimestamp: oldestPriceTimestamp
            })
        ]
        const groupId2 = 2

        const configureParentContext = () => {
            return new ScriptContextBuilder()
                .setTimeRange({
                    start: Number.MAX_SAFE_INTEGER,
                    end: Number.MAX_SAFE_INTEGER
                })
                .addAssetGroupRef({ assets: assets0, id: groupId0 })
                .addAssetGroupRef({ assets: assets1, id: groupId1 })
                .addAssetGroupRef({ assets: assets2, id: groupId2 })
                .redeemDummyTokenWithDvpPolicy()
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            it("AssetGroupModule::sum_total_asset_value #08 (returns the price timestamp and lovelace value of the single asset)", () => {
                configureContext().use((currentScript, ctx) => {
                    deepEqual(
                        sum_total_asset_value.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            group_ptrs: [0, 1, 2],
                            first_id: 0
                        }),
                        [oldestPriceTimestamp, 1_000_000n]
                    )
                })
            })
        })
    })

    describe("the tx references three asset groups, the first with one asset, the second and third are empty", () => {
        const groupId0 = 0
        const oldestPriceTimestamp = 123
        const assets0 = [
            makeAsset({
                count: 10000,
                price: [100, 1],
                priceTimestamp: oldestPriceTimestamp
            })
        ]
        const groupId1 = 1
        const assets1: AssetType[] = []
        const groupId2 = 2
        const assets2: AssetType[] = []

        const configureParentContext = (props?: {
            injectDummyRef?: boolean
            injectConfigRef?: boolean
            secondGroupId?: number
            thirdGroupAddress?: ShelleyAddress
        }) => {
            const scb = new ScriptContextBuilder()
                .addAssetGroupRef({ assets: assets0, id: groupId0 })
                .addAssetGroupRef({
                    assets: assets1,
                    id: props?.secondGroupId ?? groupId1
                })

            if (props?.injectDummyRef) {
                scb.addDummyRefs(1)
            } else if (props?.injectConfigRef) {
                scb.addConfigRef()
            }

            return scb
                .addAssetGroupRef({
                    address: props?.thirdGroupAddress,
                    assets: assets2,
                    id: groupId2
                })
                .redeemDummyTokenWithDvpPolicy()
        }
        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            const defaultTestArgs = {
                group_ptrs: [0, 1, 2],
                first_id: 0
            }

            it("AssetGroupModule::sum_total_asset_value #09 (throws an error if one of the referenced asset groups is not at the assets_validator address)", () => {
                configureContext({
                    thirdGroupAddress: makeDummyAddress(false)
                }).use((currentScript, ctx) => {
                    throws(() => {
                        sum_total_asset_value.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        })
                    })
                })
            })

            it("AssetGroupModule::sum_total_asset_value #10 (throws an error if one of the referenced asset groups doesn't have expected id)", () => {
                configureContext({ secondGroupId: 3 }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            sum_total_asset_value.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                ...defaultTestArgs
                            })
                        })
                    }
                )
            })

            it("AssetGroupModule::sum_total_asset_value #11 (throws an error if an additional pointer is included which is out-of-range)", () => {
                configureContext().use((currentScript, ctx) => {
                    throws(() => {
                        sum_total_asset_value.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ...defaultTestArgs,
                            group_ptrs: [0, 1, 2, 3],
                            first_id: 0
                        })
                    })
                })
            })

            it("AssetGroupModule::sum_total_asset_value #12 (throws an error if one of the pointers doesn't point to a related UTxO)", () => {
                configureContext({ injectDummyRef: true }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            sum_total_asset_value.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                ...defaultTestArgs
                            })
                        })
                    }
                )
            })

            it("AssetGroupModule::sum_total_asset_value #13 (throws an error if one of the pointers doesn't point to an asset group)", () => {
                configureContext({ injectConfigRef: true }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            sum_total_asset_value.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                ...defaultTestArgs
                            })
                        })
                    }
                )
            })
        })
    })
})
