import { describe, it } from "node:test"
import contract from "pbg-token-validators-test-context"
import { scripts } from "./constants"
import { makeAsset } from "./data"
import { ScriptContextBuilder } from "./tx"
import { deepEqual, throws } from "node:assert"
import { AssetClass } from "@helios-lang/ledger"

const {
    "AssetPtr::resolve_input": resolve_input,
    "AssetPtr::resolve_output": resolve_output
} = contract.AssetPtrModule

describe("AssetPtrModule::AssetPtr::resolve_input", () => {
    describe("the tx has a single asset group input, with a single asset", () => {
        const asset = makeAsset()
        const assets = [asset]

        describe("for all validators", () => {
            it("returns the asset data if the pointer points the single asset in the single asset group", () => {
                new ScriptContextBuilder()
                    .addAssetGroupInput({ assets })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx, tx) => {
                        scripts.forEach((currentScript) => {
                            deepEqual(
                                resolve_input.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    self: {
                                        group_index: 0,
                                        asset_class_index: 0
                                    },
                                    inputs: tx.inputs,
                                    asset_class: asset.asset_class
                                }),
                                asset
                            )
                        })
                    })
            })

            it("throws an error if the pointer group index is out-of-range", () => {
                new ScriptContextBuilder()
                    .addAssetGroupInput({ assets })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx, tx) => {
                        scripts.forEach((currentScript) => {
                            throws(() => {
                                resolve_input.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    self: {
                                        group_index: 2,
                                        asset_class_index: 0
                                    },
                                    inputs: tx.inputs,
                                    asset_class: asset.asset_class
                                })
                            })
                        })
                    })
            })

            it("throws an error if the pointer doesn't point to an asset group input", () => {
                new ScriptContextBuilder()
                    .addAssetGroupInput({ assets })
                    .redeemDummyTokenWithDvpPolicy()
                    .addConfigInput()
                    .use((ctx, tx) => {
                        scripts.forEach((currentScript) => {
                            throws(() => {
                                resolve_input.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    self: {
                                        group_index: 2,
                                        asset_class_index: 0
                                    },
                                    inputs: tx.inputs,
                                    asset_class: asset.asset_class
                                })
                            })
                        })
                    })
            })

            it("throws an error if the pointer asset class index is out-of-range", () => {
                new ScriptContextBuilder()
                    .addAssetGroupInput({ assets })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx, tx) => {
                        scripts.forEach((currentScript) => {
                            throws(() => {
                                resolve_input.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    self: {
                                        group_index: 0,
                                        asset_class_index: 1
                                    },
                                    inputs: tx.inputs,
                                    asset_class: asset.asset_class
                                })
                            })
                        })
                    })
            })
        })
    })

    describe("the tx has two asset group inputs, the first with one asset, the second with three assets", () => {
        const assets0 = [
            makeAsset({
                assetClass: AssetClass.dummy(0)
            })
        ]

        const assets1 = [
            makeAsset({
                assetClass: AssetClass.dummy(1)
            }),
            makeAsset({
                assetClass: AssetClass.dummy(2)
            }),
            makeAsset({
                assetClass: AssetClass.dummy(3)
            })
        ]

        describe("for all validators", () => {
            it("returns the last asset data if the pointer points to the last asset in the second asset group", () => {
                new ScriptContextBuilder()
                    .addAssetGroupInput({ assets: assets0 })
                    .addAssetGroupInput({ assets: assets1 })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx, tx) => {
                        scripts.forEach((currentScript) => {
                            deepEqual(
                                resolve_input.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    self: {
                                        group_index: 1,
                                        asset_class_index: 2
                                    },
                                    inputs: tx.inputs,
                                    asset_class: AssetClass.dummy(3)
                                }),
                                assets1[2]
                            )
                        })
                    })
            })
        })
    })

    describe("the tx has a single asset group input, with two assets", () => {
        const assets = [
            makeAsset({
                assetClass: AssetClass.dummy(1)
            }),
            makeAsset({ assetClass: AssetClass.dummy(2) })
        ]

        describe("for all validators", () => {
            it("throws an error if the resolved asset doesn't have expected asset class", () => {
                new ScriptContextBuilder()
                    .addAssetGroupInput({ assets })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx, tx) => {
                        scripts.forEach((currentScript) => {
                            throws(() => {
                                resolve_input.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    self: {
                                        group_index: 0,
                                        asset_class_index: 0
                                    },
                                    inputs: tx.inputs,
                                    asset_class: AssetClass.dummy(0)
                                })
                            })
                        })
                    })
            })
        })
    })
})

describe("AssetPtrModule::AssetPtr::resolve_output", () => {
    describe("the tx has a single asset group output, with a single asset", () => {
        const asset = makeAsset()
        const assets = [asset]

        describe("for all validators", () => {
            it("returns the single asset data if the pointer points to the single asset in the single asset group", () => {
                new ScriptContextBuilder()
                    .addAssetGroupOutput({ assets })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx, tx) => {
                        scripts.forEach((currentScript) => {
                            deepEqual(
                                resolve_output.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    self: {
                                        group_index: 0,
                                        asset_class_index: 0
                                    },
                                    outputs: tx.outputs,
                                    asset_class: asset.asset_class
                                }),
                                asset
                            )
                        })
                    })
            })

            it("throws an error if the pointer group index is out-of-range", () => {
                new ScriptContextBuilder()
                    .addAssetGroupOutput({ assets })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx, tx) => {
                        scripts.forEach((currentScript) => {
                            throws(() => {
                                resolve_output.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    self: {
                                        group_index: 2,
                                        asset_class_index: 0
                                    },
                                    outputs: tx.outputs,
                                    asset_class: asset.asset_class
                                })
                            })
                        })
                    })
            })

            it("throws an error if the pointer doesn't point to asset group output", () => {
                const assets = [makeAsset()]

                new ScriptContextBuilder()
                    .addAssetGroupOutput({ assets, id: 0 })
                    .redeemDummyTokenWithDvpPolicy()
                    .addConfigInput()
                    .use((ctx, tx) => {
                        scripts.forEach((currentScript) => {
                            throws(() => {
                                resolve_output.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    self: {
                                        group_index: 2,
                                        asset_class_index: 0
                                    },
                                    outputs: tx.outputs,
                                    asset_class: asset.asset_class
                                })
                            })
                        })
                    })
            })

            it("throws an error if the pointer asset class index is out-of-range", () => {
                new ScriptContextBuilder()
                    .addAssetGroupOutput({ assets })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx, tx) => {
                        scripts.forEach((currentScript) => {
                            throws(() => {
                                resolve_output.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    self: {
                                        group_index: 0,
                                        asset_class_index: 1
                                    },
                                    outputs: tx.outputs,
                                    asset_class: asset.asset_class
                                })
                            })
                        })
                    })
            })
        })
    })

    describe("the tx has two asset group outputs, the first with one asset, the second with three assets", () => {
        const assets0 = [
            makeAsset({
                assetClass: AssetClass.dummy(0)
            })
        ]

        const assets1 = [
            makeAsset({
                assetClass: AssetClass.dummy(1)
            }),
            makeAsset({
                assetClass: AssetClass.dummy(2)
            }),
            makeAsset({
                assetClass: AssetClass.dummy(3)
            })
        ]

        describe("for all validators", () => {
            it("returns the last asset data if the pointer points to the third asset in the second asset group", () => {
                new ScriptContextBuilder()
                    .addAssetGroupOutput({ assets: assets0 })
                    .addAssetGroupOutput({ assets: assets1 })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx, tx) => {
                        scripts.forEach((currentScript) => {
                            deepEqual(
                                resolve_output.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    self: {
                                        group_index: 1,
                                        asset_class_index: 2
                                    },
                                    outputs: tx.outputs,
                                    asset_class: AssetClass.dummy(3)
                                }),
                                assets1[2]
                            )
                        })
                    })
            })
        })
    })

    describe("the tx has a single asset group output, with two assets", () => {
        const assets = [
            makeAsset({
                assetClass: AssetClass.dummy(1)
            }),
            makeAsset({ assetClass: AssetClass.dummy(2) })
        ]

        describe("for all validators", () => {
            it("throws an error if the resolved asset doesn't have the expected asset class", () => {
                new ScriptContextBuilder()
                    .addAssetGroupOutput({ assets })
                    .redeemDummyTokenWithDvpPolicy()
                    .use((ctx, tx) => {
                        scripts.forEach((currentScript) => {
                            throws(() => {
                                resolve_output.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    self: {
                                        group_index: 0,
                                        asset_class_index: 0
                                    },
                                    outputs: tx.outputs,
                                    asset_class: AssetClass.dummy(0)
                                })
                            })
                        })
                    })
            })
        })
    })
})
