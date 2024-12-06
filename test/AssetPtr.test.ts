import { deepEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { makeDummyAssetClass } from "@helios-lang/ledger"
import contract from "pbg-token-validators-test-context"
import { scripts } from "./constants"
import { makeAsset } from "./data"
import { ScriptContextBuilder, withScripts } from "./tx"

const {
    "AssetPtr::resolve_input": resolve_input,
    "AssetPtr::resolve_output": resolve_output
} = contract.AssetPtrModule

describe("AssetPtrModule::AssetPtr::resolve_input", () => {
    describe("the tx has a single asset group input, with a single asset", () => {
        const asset = makeAsset()
        const assets = [asset]

        const configureParentContext = (props?: {
            addConfigInput?: boolean
        }) => {
            const scb = new ScriptContextBuilder()
                .addAssetGroupInput({ assets })
                .redeemDummyTokenWithDvpPolicy()

            if (props?.addConfigInput) {
                scb.addConfigInput()
            }

            return scb
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            it("returns the asset data if the pointer points the single asset in the single asset group", () => {
                configureContext().use((currentScript, ctx, tx) => {
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

            it("throws an error if the pointer group index is out-of-range", () => {
                configureContext().use((currentScript, ctx, tx) => {
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

            it("throws an error if the pointer doesn't point to an asset group input", () => {
                configureContext({ addConfigInput: true }).use(
                    (currentScript, ctx, tx) => {
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
                    }
                )
            })

            it("throws an error if the pointer asset class index is out-of-range", () => {
                configureContext().use((currentScript, ctx, tx) => {
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

    describe("the tx has two asset group inputs, the first with one asset, the second with three assets", () => {
        const assets0 = [
            makeAsset({
                assetClass: makeDummyAssetClass(0)
            })
        ]

        const assets1 = [
            makeAsset({
                assetClass: makeDummyAssetClass(1)
            }),
            makeAsset({
                assetClass: makeDummyAssetClass(2)
            }),
            makeAsset({
                assetClass: makeDummyAssetClass(3)
            })
        ]

        const configureParentContext = () => {
            return new ScriptContextBuilder()
                .addAssetGroupInput({ assets: assets0 })
                .addAssetGroupInput({ assets: assets1 })
                .redeemDummyTokenWithDvpPolicy()
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            it("returns the last asset data if the pointer points to the last asset in the second asset group", () => {
                configureContext().use((currentScript, ctx, tx) => {
                    deepEqual(
                        resolve_input.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            self: {
                                group_index: 1,
                                asset_class_index: 2
                            },
                            inputs: tx.inputs,
                            asset_class: makeDummyAssetClass(3)
                        }),
                        assets1[2]
                    )
                })
            })
        })
    })

    describe("the tx has a single asset group input, with two assets", () => {
        const assets = [
            makeAsset({
                assetClass: makeDummyAssetClass(1)
            }),
            makeAsset({ assetClass: makeDummyAssetClass(2) })
        ]

        const configureParentContext = () => {
            return new ScriptContextBuilder()
                .addAssetGroupInput({ assets })
                .redeemDummyTokenWithDvpPolicy()
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            it("throws an error if the resolved asset doesn't have expected asset class", () => {
                configureContext().use((currentScript, ctx, tx) => {
                    throws(() => {
                        resolve_input.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            self: {
                                group_index: 0,
                                asset_class_index: 0
                            },
                            inputs: tx.inputs,
                            asset_class: makeDummyAssetClass(0)
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

        const configureParentContext = (props?: {
            addConfigInput?: boolean
        }) => {
            const scb = new ScriptContextBuilder()
                .addAssetGroupOutput({ assets })
                .redeemDummyTokenWithDvpPolicy()

            if (props?.addConfigInput) {
                scb.addConfigInput()
            }

            return scb
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            it("returns the single asset data if the pointer points to the single asset in the single asset group", () => {
                configureContext().use((currentScript, ctx, tx) => {
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

            it("throws an error if the pointer group index is out-of-range", () => {
                configureContext().use((currentScript, ctx, tx) => {
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

            it("throws an error if the pointer doesn't point to asset group output", () => {
                configureContext({ addConfigInput: true }).use(
                    (currentScript, ctx, tx) => {
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
                    }
                )
            })

            it("throws an error if the pointer asset class index is out-of-range", () => {
                configureContext().use((currentScript, ctx, tx) => {
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

    describe("the tx has two asset group outputs, the first with one asset, the second with three assets", () => {
        const assets0 = [
            makeAsset({
                assetClass: makeDummyAssetClass(0)
            })
        ]

        const assets1 = [
            makeAsset({
                assetClass: makeDummyAssetClass(1)
            }),
            makeAsset({
                assetClass: makeDummyAssetClass(2)
            }),
            makeAsset({
                assetClass: makeDummyAssetClass(3)
            })
        ]

        const configureParentContext = () => {
            return new ScriptContextBuilder()
                .addAssetGroupOutput({ assets: assets0 })
                .addAssetGroupOutput({ assets: assets1 })
                .redeemDummyTokenWithDvpPolicy()
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            it("returns the last asset data if the pointer points to the third asset in the second asset group", () => {
                configureContext().use((currentScript, ctx, tx) => {
                    deepEqual(
                        resolve_output.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            self: {
                                group_index: 1,
                                asset_class_index: 2
                            },
                            outputs: tx.outputs,
                            asset_class: makeDummyAssetClass(3)
                        }),
                        assets1[2]
                    )
                })
            })
        })
    })

    describe("the tx has a single asset group output, with two assets", () => {
        const assets = [
            makeAsset({
                assetClass: makeDummyAssetClass(1)
            }),
            makeAsset({ assetClass: makeDummyAssetClass(2) })
        ]

        const configureParentContext = () => {
            return new ScriptContextBuilder()
                .addAssetGroupOutput({ assets })
                .redeemDummyTokenWithDvpPolicy()
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            it("throws an error if the resolved asset doesn't have the expected asset class", () => {
                configureContext().use((currentScript, ctx, tx) => {
                    throws(() => {
                        resolve_output.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            self: {
                                group_index: 0,
                                asset_class_index: 0
                            },
                            outputs: tx.outputs,
                            asset_class: makeDummyAssetClass(0)
                        })
                    })
                })
            })
        })
    })
})
