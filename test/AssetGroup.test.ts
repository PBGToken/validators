import { deepEqual, strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { Address, AssetClass, StakingValidatorHash } from "@helios-lang/ledger"
import contract from "pbg-token-validators-test-context"
import { indirectPolicyScripts, scripts } from "./constants"
import { AssetGroupAction, AssetType, makeAsset } from "./data"
import { makeAssetsToken, makeConfigToken } from "./tokens"
import { ScriptContextBuilder } from "./tx"

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

        describe("for all validators", () => {
            it("returns the asset group id and data if the current input contains an asset group token", () => {
                new ScriptContextBuilder()
                    .addAssetGroupInput({
                        assets,
                        redeemer,
                        id: groupId
                    })
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            deepEqual(
                                find_current.eval({
                                    $scriptContext: ctx,
                                    $currentScript: currentScript
                                }),
                                [groupId, { assets }]
                            )
                        })
                    })
            })

            it("returns the asset group id and data even if the asset group UTxO, containing an asset group token, is at the wrong address", () => {
                new ScriptContextBuilder()
                    .addAssetGroupInput({
                        assets,
                        redeemer,
                        id: groupId,
                        address: Address.dummy(false)
                    })
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            deepEqual(
                                find_current.eval({
                                    $scriptContext: ctx,
                                    $currentScript: currentScript
                                }),
                                [groupId, { assets }]
                            )
                        })
                    })
            })

            it("throws an error if the asset group UTxO doesn't contain an asset group token", () => {
                new ScriptContextBuilder()
                    .addAssetGroupInput({
                        assets,
                        redeemer,
                        token: makeConfigToken()
                    })
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            throws(() => {
                                find_current.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx
                                })
                            })
                        })
                    })
            })
        })
    })
})

describe("AssetGroupModule::AssetGroup::find_output", () => {
    describe("the tx has a single asset group output, with a single asset", () => {
        const assets = [makeAsset()]
        const groupId = 123n

        describe("for all validators", () => {
            it("returns the group data if the asset group output containing the asset group token is sent to the assets_validator address", () => {
                new ScriptContextBuilder()
                    .addAssetGroupOutput({
                        id: groupId,
                        assets
                    })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
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
            })

            it("throws an error if the asset group output isn't sent to the assets_validator address", () => {
                new ScriptContextBuilder()
                    .addAssetGroupOutput({
                        id: groupId,
                        address: Address.dummy(false),
                        assets
                    })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            throws(() => {
                                find_output.eval({
                                    $scriptContext: ctx,
                                    $currentScript: currentScript,
                                    id: groupId
                                })
                            })
                        })
                    })
            })

            it("throws an error if the asset group output doesn't contain the asset group token", () => {
                new ScriptContextBuilder()
                    .addAssetGroupOutput({
                        token: makeConfigToken(),
                        assets
                    })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            throws(() => {
                                find_output.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    id: groupId
                                })
                            })
                        })
                    })
            })
        })

        describe("in validators that don't have direct access to the policy", () => {
            it("throws an error if no UTxO containing a policy token is spent", () => {
                new ScriptContextBuilder()
                    .addAssetGroupOutput({
                        id: groupId,
                        assets
                    })
                    .use((ctx) => {
                        indirectPolicyScripts.forEach((currentScript) => {
                            throws(() => {
                                find_output.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    id: groupId
                                })
                            })
                        })
                    })
            })
        })
    })
})

describe("AssetGroupModule::AssetGroup::find_output_asset", () => {
    describe("the tx has a single asset group output, with a single asset", () => {
        const asset = makeAsset()
        const assets = [asset]

        describe("for all validators", () => {
            it("returns the asset data if found", () => {
                new ScriptContextBuilder()
                    .addAssetGroupOutput({
                        id: 0,
                        assets
                    })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
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
    })

    describe("the tx has two asset group outputs, the first with a single asset, the second with three assets", () => {
        const assets0 = [makeAsset()]
        const groupId0 = 0
        const assets1 = [
            makeAsset({ assetClass: AssetClass.dummy(1) }),
            makeAsset({
                assetClass: AssetClass.dummy(2)
            }),
            makeAsset({
                assetClass: AssetClass.dummy(3)
            })
        ]
        const groupId1 = 1

        describe("for all validators", () => {
            it("returns the asset data if found", () => {
                new ScriptContextBuilder()
                    .addAssetGroupOutput({
                        id: groupId0,
                        assets: assets0
                    })
                    .addAssetGroupOutput({
                        id: groupId1,
                        assets: assets1
                    })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            deepEqual(
                                find_output_asset.eval({
                                    $scriptContext: ctx,
                                    $currentScript: currentScript,
                                    asset_class: assets1[2].asset_class
                                }),
                                assets1[2]
                            )
                        })
                    })
            })

            it("throws an error if the asset class isn't found", () => {
                new ScriptContextBuilder()
                    .addAssetGroupOutput({
                        id: groupId0,
                        assets: assets0
                    })
                    .addAssetGroupOutput({
                        id: groupId1,
                        assets: assets1
                    })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            throws(() => {
                                find_output_asset.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    asset_class: AssetClass.dummy(4)
                                })
                            })
                        })
                    })
            })

            it("throws an error if one of asset group outputs doesn't contain exactly one asset group token", () => {
                new ScriptContextBuilder()
                    .addAssetGroupOutput({
                        id: groupId0,
                        assets: assets0,
                        token: makeAssetsToken(0).add(makeConfigToken())
                    })
                    .addAssetGroupOutput({
                        id: groupId1,
                        assets: assets1
                    })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
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

            it("throws an error if an asset group output isn't at the correct address", () => {
                new ScriptContextBuilder()
                    .addAssetGroupOutput({
                        id: groupId0,
                        assets: assets0
                    })
                    .addAssetGroupOutput({
                        id: groupId1,
                        assets: assets1,
                        address: Address.dummy(false)
                    })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
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
})

describe("AssetGroupModule::AssetGroup::find_input_asset", () => {
    describe("the tx has a single asset group input, with a single asset", () => {
        const asset = makeAsset()
        const assets = [asset]

        describe("for all validators", () => {
            it("returns the asset data if found", () => {
                new ScriptContextBuilder()
                    .addAssetGroupInput({
                        id: 0,
                        redeemer: { Count: { supply_ptr: 1 } },
                        assets: assets
                    })
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
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
    })

    describe("the tx has two asset group inputs, the first with a single asset, the second with three assets", () => {
        const assets0 = [makeAsset()]
        const groupId0 = 0
        const assets1 = [
            makeAsset({ assetClass: AssetClass.dummy(1) }),
            makeAsset({
                assetClass: AssetClass.dummy(2)
            }),
            makeAsset({
                assetClass: AssetClass.dummy(3)
            })
        ]
        const groupId1 = 1

        describe("for all validators", () => {
            it("returns the asset data if found", () => {
                new ScriptContextBuilder()
                    .addAssetGroupInput({
                        id: groupId0,
                        assets: assets0
                    })
                    .addAssetGroupInput({
                        id: groupId1,
                        assets: assets1
                    })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
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
            })

            it("throws an error if not found", () => {
                new ScriptContextBuilder()
                    .addAssetGroupInput({
                        id: groupId0,
                        assets: assets0
                    })
                    .addAssetGroupInput({
                        id: groupId1,
                        assets: assets1
                    })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            throws(() => {
                                find_input_asset.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    asset_class: AssetClass.dummy(4)
                                })
                            })
                        })
                    })
            })

            it("throws an error if one of the asset group inputs doesn't contain exactly one asset group token", () => {
                new ScriptContextBuilder()
                    .addAssetGroupInput({
                        id: groupId0,
                        assets: assets0,
                        token: makeAssetsToken(0).add(makeConfigToken())
                    })
                    .addAssetGroupInput({
                        id: groupId1,
                        assets: assets1
                    })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
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

            it("throws an error if the asset group containing the searched asset isn't at the correct address", () => {
                new ScriptContextBuilder()
                    .addAssetGroupInput({
                        id: groupId0,
                        assets: assets0
                    })
                    .addAssetGroupInput({
                        id: groupId1,
                        assets: assets1,
                        address: Address.dummy(false)
                    })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
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
})

describe("AssetGroupModule::AssetGroup::find_single_input", () => {
    describe("the tx has a single asset group input, with a single asset", () => {
        const assets = [makeAsset()]
        const groupId = 0n

        describe("for all validators", () => {
            it("returns the asset group id and data if only a single asset group UTxO is being spent", () => {
                new ScriptContextBuilder()
                    .addAssetGroupInput({
                        id: groupId,
                        assets: assets,
                        redeemer: { Count: { supply_ptr: 1 } }
                    })
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            deepEqual(
                                find_single_input.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx
                                }),
                                [groupId, { assets: assets }]
                            )
                        })
                    })
            })

            it("throws an error if the asset group input doesn't contain an asset group token", () => {
                new ScriptContextBuilder()
                    .addAssetGroupInput({
                        token: makeConfigToken(),
                        assets,
                        redeemer: { Count: { supply_ptr: 1 } }
                    })
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
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

    describe("the tx has two asset group inputs, the first with one asset, the second with three assets", () => {
        const assets0 = [makeAsset()]
        const groupId0 = 0n
        const assets1 = [
            makeAsset({ assetClass: AssetClass.dummy(1) }),
            makeAsset({
                assetClass: AssetClass.dummy(2)
            }),
            makeAsset({
                assetClass: AssetClass.dummy(3)
            })
        ]
        const groupId1 = 1n

        describe("for the config_validator", () => {
            it("returns the first asset group id and data if the second asset group doesn't contain an asset group token", () => {
                new ScriptContextBuilder()
                    .addAssetGroupInput({
                        id: groupId0,
                        assets: assets0,
                        redeemer: { Count: { supply_ptr: 1 } }
                    })
                    .addAssetGroupInput({
                        id: groupId1,
                        token: makeConfigToken()
                    })
                    .use((ctx) => {
                        deepEqual(
                            find_single_input.eval({
                                $currentScript: "config_validator",
                                $scriptContext: ctx
                            }),
                            [0n, { assets: assets0 }]
                        )
                    })
            })
        })

        describe("for all validators except the config_validator", () => {
            const nonConfigValidatorScripts = scripts.filter(
                (s) => s != "config_validator"
            )
            it("throws an error even if the second asset group doesn't contain an asset group token (only address matters for the singleton check)", () => {
                new ScriptContextBuilder()
                    .addAssetGroupInput({
                        id: groupId0,
                        assets: assets0,
                        redeemer: { Count: { supply_ptr: 1 } }
                    })
                    .addAssetGroupInput({
                        id: groupId1,
                        token: makeConfigToken(),
                        assets: assets1
                    })
                    .use((ctx) => {
                        nonConfigValidatorScripts.forEach((currentScript) => {
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

        describe("for all validators", () => {
            it("throws an error if both asset groups are at the asset_validator address and contain an asset group token", () => {
                new ScriptContextBuilder()
                    .addAssetGroupInput({
                        id: groupId0,
                        assets: assets0,
                        redeemer: { Count: { supply_ptr: 1 } }
                    })
                    .addAssetGroupInput({
                        id: groupId1,
                        assets: assets1
                    })
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
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
})

describe("AssetGroupModule::AssetGroup::find_asset", () => {
    describe("empty asset group", () => {
        it("returns None", () => {
            const assets: AssetType[] = []

            strictEqual(
                find_asset.eval({
                    self: { assets },
                    asset_class: AssetClass.dummy()
                }),
                null
            )
        })
    })

    describe("asset group with three assets", () => {
        const assets: AssetType[] = [
            makeAsset({ assetClass: AssetClass.dummy(1) }),
            makeAsset({ assetClass: AssetClass.dummy(2) }),
            makeAsset({ assetClass: AssetClass.dummy(3) })
        ]

        it("returns None if the asset class isn't found", () => {
            strictEqual(
                find_asset.eval({
                    self: { assets },
                    asset_class: AssetClass.dummy()
                }),
                null
            )
        })

        it("returns Some if found as the first entry", () => {
            deepEqual(
                find_asset.eval({
                    self: { assets },
                    asset_class: assets[0].asset_class
                }),
                assets[0]
            )
        })

        it("returns Some if found as the middle entry", () => {
            deepEqual(
                find_asset.eval({
                    self: { assets },
                    asset_class: assets[1].asset_class
                }),
                assets[1]
            )
        })

        it("returns Some if found as the last entry", () => {
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
        it("returns false", () => {
            const assets: AssetType[] = []

            strictEqual(
                has_asset.eval({
                    self: { assets },
                    asset_class: AssetClass.dummy()
                }),
                false
            )
        })
    })

    describe("asset group with three assets", () => {
        const assets: AssetType[] = [
            makeAsset({ assetClass: AssetClass.dummy(1) }),
            makeAsset({ assetClass: AssetClass.dummy(2) }),
            makeAsset({ assetClass: AssetClass.dummy(3) })
        ]

        it("returns false if not found", () => {
            strictEqual(
                has_asset.eval({
                    self: { assets },
                    asset_class: AssetClass.dummy()
                }),
                false
            )
        })

        it("returns true if found as the first entry", () => {
            strictEqual(
                has_asset.eval({
                    self: { assets },
                    asset_class: assets[0].asset_class
                }),
                true
            )
        })

        it("returns true if found as the middle entry", () => {
            strictEqual(
                has_asset.eval({
                    self: { assets },
                    asset_class: assets[1].asset_class
                }),
                true
            )
        })

        it("returns true if found as the last entry", () => {
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
    it("returns true for empty list", () => {
        const assets: AssetType[] = []

        strictEqual(
            is_empty.eval({
                self: { assets }
            }),
            true
        )
    })

    it("returns false for non-empty list with one entry", () => {
        const assets = [makeAsset()]

        strictEqual(is_empty.eval({ self: { assets } }), false)
    })

    it("returns false for non-empty list with three entries", () => {
        const assets = [
            makeAsset({ assetClass: AssetClass.dummy(0) }),
            makeAsset({ assetClass: AssetClass.dummy(1) }),
            makeAsset({ assetClass: AssetClass.dummy(2) })
        ]

        strictEqual(is_empty.eval({ self: { assets } }), false)
    })
})

describe("AssetGroupModule::AssetGroup::is_not_overfull", () => {
    it("returns true for empty list", () => {
        const assets: AssetType[] = []

        strictEqual(
            is_not_overfull.eval({
                self: { assets }
            }),
            true
        )
    })

    it("returns true for full list", () => {
        const assets: AssetType[] = []

        for (let i = 0; i < expectedMaxSize; i++) {
            assets.push(makeAsset({ assetClass: AssetClass.dummy(i) }))
        }

        strictEqual(
            is_not_overfull.eval({
                self: { assets }
            }),
            true
        )
    })

    it("returns false for list containing one more asset than the maximum", () => {
        const assets: AssetType[] = []

        for (let i = 0; i < expectedMaxSize + 1; i++) {
            assets.push(makeAsset({ assetClass: AssetClass.dummy(i) }))
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
    it("returns true for an unrelated tx", () => {
        new ScriptContextBuilder().use((ctx) => {
            strictEqual(
                nothing_spent.eval({
                    $scriptContext: ctx
                }),
                true
            )
        })
    })

    it("returns false if a single input is at the assets_validator address", () => {
        new ScriptContextBuilder()
            .addDummyInputs(7)
            .addAssetGroupInput()
            .addDummyInputs(7)
            .use((ctx) => {
                strictEqual(nothing_spent.eval({ $scriptContext: ctx }), false)
            })
    })

    it("returns true if an input is spent from an address with the same spending credential as the assets_validator, but a non-empty staking credential", () => {
        const similarAddress = Address.fromHashes(
            false,
            contract.assets_validator.$hash,
            StakingValidatorHash.dummy()
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
        describe("for all validators", () => {
            it("returns false", () => {
                new ScriptContextBuilder()
                    .addAssetGroupRef({ assets, id: 0 })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            strictEqual(
                                search_for_asset_class.eval({
                                    $scriptContext: ctx,
                                    $currentScript: currentScript,
                                    asset_class: AssetClass.dummy(),
                                    group_ptrs: [0],
                                    first_id: 0
                                }),
                                false
                            )
                        })
                    })
            })
        })
    })

    describe("the tx references a single asset group, with a single asset", () => {
        const assets = [makeAsset()]
        const groupId = 0n

        describe("for all validators", () => {
            it("returns true if found", () => {
                new ScriptContextBuilder()
                    .addAssetGroupRef({ assets, id: groupId })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            strictEqual(
                                search_for_asset_class.eval({
                                    $scriptContext: ctx,
                                    $currentScript: currentScript,
                                    asset_class: assets[0].asset_class,
                                    group_ptrs: [0],
                                    first_id: 0
                                }),
                                true
                            )
                        })
                    })
            })

            it("throws an error if the pointer is out-of-range", () => {
                new ScriptContextBuilder()
                    .addAssetGroupRef({ assets, id: groupId })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            throws(() => {
                                search_for_asset_class.eval({
                                    $scriptContext: ctx,
                                    $currentScript: currentScript,
                                    asset_class: assets[0].asset_class,
                                    group_ptrs: [1],
                                    first_id: 0
                                })
                            })
                        })
                    })
            })

            it("throws an error if the expected asset group id doesn't match", () => {
                new ScriptContextBuilder()
                    .addAssetGroupRef({ assets, id: groupId })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
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
            })

            it("throws an error if the asset group is at the wrong address", () => {
                new ScriptContextBuilder()
                    .addAssetGroupRef({
                        assets,
                        address: Address.dummy(false),
                        id: groupId
                    })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            throws(() => {
                                search_for_asset_class.eval({
                                    $scriptContext: ctx,
                                    $currentScript: currentScript,
                                    asset_class: assets[0].asset_class,
                                    group_ptrs: [0],
                                    first_id: 0
                                })
                            })
                        })
                    })
            })
        })
    })

    describe("the tx references a single asset group, with three assets", () => {
        const assets: AssetType[] = [
            makeAsset({ assetClass: AssetClass.dummy(1) }),
            makeAsset({ assetClass: AssetClass.dummy(2) }),
            makeAsset({ assetClass: AssetClass.dummy(3) })
        ]
        const groupId = 0n

        describe("for all validators", () => {
            it("returns false if not found", () => {
                new ScriptContextBuilder()
                    .addAssetGroupRef({ assets, id: groupId })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            strictEqual(
                                search_for_asset_class.eval({
                                    $scriptContext: ctx,
                                    $currentScript: currentScript,
                                    asset_class: AssetClass.dummy(0),
                                    group_ptrs: [0],
                                    first_id: 0
                                }),
                                false
                            )
                        })
                    })
            })
        })
    })

    describe("the tx references two asset groups, the first with three assets, the second with one asset", () => {
        const assets0: AssetType[] = [
            makeAsset({ assetClass: AssetClass.dummy(1) }),
            makeAsset({ assetClass: AssetClass.dummy(2) }),
            makeAsset({ assetClass: AssetClass.dummy(3) })
        ]
        const groupId0 = 0n

        const assets1: AssetType[] = [
            makeAsset({ assetClass: AssetClass.dummy(0) })
        ]
        const groupId1 = 1n

        describe("for all validators", () => {
            it("returns true if found in the second asset group", () => {
                new ScriptContextBuilder()
                    .addAssetGroupRef({ assets: assets0, id: groupId0 })
                    .addDummyRefs(5)
                    .addAssetGroupRef({ assets: assets1, id: groupId1 })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            strictEqual(
                                search_for_asset_class.eval({
                                    $scriptContext: ctx,
                                    $currentScript: currentScript,
                                    asset_class: AssetClass.dummy(0),
                                    group_ptrs: [0, 6],
                                    first_id: 0
                                }),
                                true
                            )
                        })
                    })
            })

            it("throws an error if found in the first asset group (which is error-free), but the second asset group doesn't have the expected id", () => {
                new ScriptContextBuilder()
                    .addAssetGroupRef({ assets: assets0, id: groupId0 })
                    .addDummyRefs(5)
                    .addAssetGroupRef({ assets: assets1, id: 5 })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            throws(() => {
                                search_for_asset_class.eval({
                                    $scriptContext: ctx,
                                    $currentScript: currentScript,
                                    asset_class: AssetClass.dummy(1),
                                    group_ptrs: [0, 6],
                                    first_id: 0
                                })
                            })
                        })
                    })
            })

            it("throws an error if found in the first asset group (which is error-free), but the second asset group isn't at the assets_validator address", () => {
                new ScriptContextBuilder()
                    .addAssetGroupRef({ assets: assets0, id: groupId0 })
                    .addDummyRefs(5)
                    .addAssetGroupRef({
                        assets: assets1,
                        address: Address.dummy(false),
                        id: groupId1
                    })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            throws(() => {
                                search_for_asset_class.eval({
                                    $scriptContext: ctx,
                                    $currentScript: currentScript,
                                    asset_class: AssetClass.dummy(1),
                                    group_ptrs: [0, 6],
                                    first_id: 0
                                })
                            })
                        })
                    })
            })

            it("throws an error if found in the first asset group (which is error-free), but the second asset group doesn't contain the asset group token", () => {
                new ScriptContextBuilder()
                    .addAssetGroupRef({ assets: assets0, id: groupId0 })
                    .addDummyRefs(5)
                    .addAssetGroupRef({
                        assets: assets1,
                        token: makeConfigToken()
                    })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            throws(() => {
                                search_for_asset_class.eval({
                                    $scriptContext: ctx,
                                    $currentScript: currentScript,
                                    asset_class: AssetClass.dummy(1),
                                    group_ptrs: [0, 6],
                                    first_id: 0
                                })
                            })
                        })
                    })
            })

            it("throws an error if found in the first asset group (which is error-free), but the second asset group pointer is out-of-range", () => {
                new ScriptContextBuilder()
                    .addAssetGroupRef({ assets: assets0, id: groupId0 })
                    .addDummyRefs(5)
                    .addAssetGroupRef({ assets: assets1, id: groupId1 })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            throws(() => {
                                search_for_asset_class.eval({
                                    $scriptContext: ctx,
                                    $currentScript: currentScript,
                                    asset_class: AssetClass.dummy(1),
                                    group_ptrs: [0, 7],
                                    first_id: 0
                                })
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

        describe("for all validators", () => {
            it("throws an error because an oldest price timestamp can't be determined", () => {
                new ScriptContextBuilder()
                    .addAssetGroupRef({ assets, id: groupId })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            throws(() => {
                                sum_total_asset_value.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    group_ptrs: [0],
                                    first_id: 0,
                                    max_tick: 1
                                })
                            })
                        })
                    })
            })
        })
    })

    describe("the tx references a single asset group, with a single asset", () => {
        const priceTimestamp = 123
        const assets = [
            makeAsset({ count: 10000, price: [100, 1], priceTimestamp })
        ]

        describe("for all validators", () => {
            it("returns the price timestamp and lovelace value of the single asset", () => {
                new ScriptContextBuilder()
                    .addAssetGroupRef({ assets, id: 0 })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            deepEqual(
                                sum_total_asset_value.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    group_ptrs: [0],
                                    first_id: 0,
                                    max_tick: 1
                                }),
                                [priceTimestamp, 1_000_000n]
                            )
                        })
                    })
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

        describe("for all validators", () => {
            it("returns oldest timestamp and correct lovelace value for multiple assets", () => {
                new ScriptContextBuilder()
                    .addAssetGroupRef({ assets: assets0, id: groupId0 })
                    .addDummyRefs(5)
                    .addAssetGroupRef({ assets: assets1, id: groupId1 })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            deepEqual(
                                sum_total_asset_value.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    group_ptrs: [0, 6],
                                    first_id: 0,
                                    max_tick: 1
                                }),
                                [oldestPriceTimestamp, 2_230_000n]
                            )
                        })
                    })
            })
        })
    })

    describe("the tx references three asset groups, the first and second are empty, and the third with one asset", () => {
        describe("for all validators", () => {
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

            it("returns the price timestamp and lovelace value of the single asset", () => {
                new ScriptContextBuilder()
                    .addAssetGroupRef({ assets: assets0, id: groupId0 })
                    .addAssetGroupRef({ assets: assets1, id: groupId1 })
                    .addAssetGroupRef({ assets: assets2, id: groupId2 })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            deepEqual(
                                sum_total_asset_value.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    group_ptrs: [0, 1, 2],
                                    first_id: 0,
                                    max_tick: 1
                                }),
                                [oldestPriceTimestamp, 1_000_000n]
                            )
                        })
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

        describe("for all validators", () => {
            it("throws an error if one of the referenced asset groups is not at the assets_validator address", () => {
                new ScriptContextBuilder()
                    .addAssetGroupRef({ assets: assets0, id: groupId0 })
                    .addAssetGroupRef({ assets: assets1, id: groupId1 })
                    .addAssetGroupRef({
                        address: Address.dummy(false),
                        assets: assets2,
                        id: groupId2
                    })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            throws(() => {
                                sum_total_asset_value.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    group_ptrs: [0, 1, 2],
                                    first_id: 0,
                                    max_tick: 1
                                })
                            })
                        })
                    })
            })

            it("throws an error if one of the referenced asset groups doesn't have expected id", () => {
                new ScriptContextBuilder()
                    .addAssetGroupRef({ assets: assets0, id: groupId0 })
                    .addAssetGroupRef({ assets: assets1, id: 3 })
                    .addAssetGroupRef({ assets: assets2, id: groupId2 })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            throws(() => {
                                sum_total_asset_value.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    group_ptrs: [0, 1, 2],
                                    first_id: 0,
                                    max_tick: 1
                                })
                            })
                        })
                    })
            })

            it("throws an error if an additional pointer is included which is out-of-range", () => {
                new ScriptContextBuilder()
                    .addAssetGroupRef({ assets: assets0, id: groupId0 })
                    .addAssetGroupRef({ assets: assets1, id: groupId1 })
                    .addAssetGroupRef({ assets: assets2, id: groupId2 })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            throws(() => {
                                sum_total_asset_value.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    group_ptrs: [0, 1, 2, 3],
                                    first_id: 0,
                                    max_tick: 1
                                })
                            })
                        })
                    })
            })

            it("throws an error if one of the pointers doesn't point to a related UTxO", () => {
                new ScriptContextBuilder()
                    .addAssetGroupRef({ assets: assets0, id: groupId0 })
                    .addAssetGroupRef({ assets: assets1, id: groupId1 })
                    .addDummyRefs(1)
                    .addAssetGroupRef({ assets: assets2, id: groupId2 })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            throws(() => {
                                sum_total_asset_value.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    group_ptrs: [0, 1, 2],
                                    first_id: 0,
                                    max_tick: 1
                                })
                            })
                        })
                    })
            })

            it("throws an error if one of the pointers doesn't point to an asset group", () => {
                new ScriptContextBuilder()
                    .addAssetGroupRef({ assets: assets0, id: groupId0 })
                    .addAssetGroupRef({ assets: assets1, id: groupId1 })
                    .addConfigRef()
                    .addAssetGroupRef({ assets: assets2, id: groupId2 })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx) => {
                        scripts.forEach((currentScript) => {
                            throws(() => {
                                sum_total_asset_value.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    group_ptrs: [0, 1, 2],
                                    first_id: 0,
                                    max_tick: 1
                                })
                            })
                        })
                    })
            })
        })
    })
})
