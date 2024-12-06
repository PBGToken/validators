import { deepEqual, strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { type ShelleyAddress, type Assets, makeAssets, makeDummyAddress, makeDummyAssetClass, makeValue } from "@helios-lang/ledger"
import {
    expectConstrData,
    expectListData,
    makeByteArrayData,
    makeConstrData,
    type UplcData
} from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"
import {
    directPolicyScripts,
    indirectPolicyScripts,
    scripts
} from "./constants"
import {
    AssetPtrType,
    PortfolioActionType,
    PortfolioReductionModeType,
    PortfolioReductionType,
    RatioType,
    castPortfolio,
    equalsPortfolioReductionMode,
    makeAsset,
    makeAssetPtr,
    makePortfolio
} from "./data"
import { makeConfigToken, makePortfolioToken } from "./tokens"
import { ScriptContextBuilder, withScripts } from "./tx"

const {
    "PortfolioReduction::is_idle": is_idle,
    "Portfolio::find_input": find_input,
    "Portfolio::find_output": find_output,
    "Portfolio::find_ref": find_ref,
    "Portfolio::find_thread": find_thread,
    "Portfolio::get_reduction_result": get_reduction_result,
    sum_lovelace,
    witnessed_by_portfolio
} = contract.PortfolioModule

describe("PortfolioModule::PortfolioReduction::is_idle", () => {
    it("PortfolioModule::PortfolioReduction::is_idle #01 (returns true if in Idle state)", () => {
        const state: PortfolioReductionType = {
            Idle: {}
        }

        strictEqual(is_idle.eval({ self: state }), true)
    })

    it("PortfolioModule::PortfolioReduction::is_idle #02 (returns false if in Reducing(TotalAssetValue) state)", () => {
        const state: PortfolioReductionType = {
            Reducing: {
                group_iter: 0,
                start_tick: 0,
                mode: {
                    TotalAssetValue: {
                        total: 0,
                        oldest_timestamp: 0
                    }
                }
            }
        }

        strictEqual(is_idle.eval({ self: state }), false)
    })

    it("PortfolioModule::PortfolioReduction::is_idle #03 (returns false if in Reducing(Exists) state)", () => {
        const state: PortfolioReductionType = {
            Reducing: {
                group_iter: 0,
                start_tick: 0,
                mode: {
                    Exists: {
                        asset_class: makeDummyAssetClass(),
                        found: false
                    }
                }
            }
        }

        strictEqual(is_idle.eval({ self: state }), false)
    })

    it("PortfolioModule::PortfolioReduction::is_idle #04 (returns false if in Reducing(DoesNotExist) state)", () => {
        const state: PortfolioReductionType = {
            Reducing: {
                group_iter: 0,
                start_tick: 0,
                mode: {
                    DoesNotExist: {
                        asset_class: makeDummyAssetClass()
                    }
                }
            }
        }

        strictEqual(is_idle.eval({ self: state }), false)
    })
})

describe("PortfolioModule::Portfolio::find_input", () => {
    const portfolio = makePortfolio()

    describe("for all validators", () => {
        it("PortfolioModule::Portfolio::find_input #01 (returns the portfolio data if the portfolio UTxO is the current input)", () => {
            new ScriptContextBuilder()
                .addPortfolioInput({
                    portfolio,
                    redeemer: { AddAssetClass: {} }
                })
                .use((ctx) => {
                    scripts.forEach((currentScript) => {
                        deepEqual(
                            find_input.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            }),
                            portfolio
                        )
                    })
                })
        })

        it("PortfolioModule::Portfolio::find_input #02 (throws an error if the portfolio UTxO isn't at the portfolio_validator address)", () => {
            new ScriptContextBuilder()
                .addPortfolioInput({
                    address: makeDummyAddress(false),
                    portfolio
                })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    scripts.forEach((currentScript) => {
                        throws(() => {
                            find_input.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                        })
                    })
                })
        })

        it("PortfolioModule::Portfolio::find_input #03 (throws an error if the portfolio UTxO doesn't contain the portfolio token)", () => {
            new ScriptContextBuilder()
                .addPortfolioInput({
                    portfolio,
                    token: makeAssets([[makeDummyAssetClass(), 1]])
                })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    scripts.forEach((currentScript) => {
                        throws(() => {
                            find_input.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                        })
                    })
                })
        })

        it("PortfolioModule::Portfolio::find_input #04 (throws an error if the portfolio UTxO contains less than 1 portfolio token)", () => {
            new ScriptContextBuilder()
                .addPortfolioInput({
                    portfolio,
                    token: makePortfolioToken(0)
                })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    scripts.forEach((currentScript) => {
                        throws(() => {
                            find_input.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                        })
                    })
                })
        })

        it("PortfolioModule::Portfolio::find_input #05 (returns the portfolio data if the portfolio UTxO contains more than 1 token and isn't the current input)", () => {
            new ScriptContextBuilder()
                .addPortfolioInput({
                    portfolio,
                    token: makePortfolioToken(2)
                })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    scripts.forEach((currentScript) => {
                        deepEqual(
                            find_input.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            }),
                            portfolio
                        )
                    })
                })
        })
    })
})

describe("PortfolioModule::Portfolio::find_output", () => {
    const portfolio = makePortfolio()

    const configureParentContext = (props?: {
        address?: ShelleyAddress
        datum?: UplcData
        token?: Assets
    }) => {
        return new ScriptContextBuilder()
            .addPortfolioOutput({
                address: props?.address,
                datum: props?.datum,
                portfolio,
                token: props?.token
            })
            .redeemDummyTokenWithDvpPolicy()
    }

    describe("@ all validators", () => {
        const configureContext = withScripts(configureParentContext, scripts)

        it("PortfolioModule::Portfolio::find_output #01 (returns the portfolio data if the portfolio UTxO is returned to portfolio_validator address with the portfolio token)", () => {
            configureContext().use((currentScript, ctx) => {
                deepEqual(
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    }),
                    portfolio
                )
            })
        })

        it("PortfolioModule::Portfolio::find_output #02 (throws an error if the portfolio UTxO isn't returned to the portfolio_validator address)", () => {
            configureContext({ address: makeDummyAddress(false) }).use(
                (currentScript, ctx) => {
                    throws(() => {
                        find_output.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })
                    })
                }
            )
        })

        it("PortfolioModule::Portfolio::find_output #03 (throws an error if the portfolio UTxO isn't returned with exactly 1 portfolio token)", () => {
            configureContext({ token: makePortfolioToken(2) }).use(
                (currentScript, ctx) => {
                    throws(() => {
                        find_output.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })
                    })
                }
            )
        })

        it("PortfolioModule::Portfolio::find_output #04 (throws an error when the first datum field entry isn't iData)", () => {
            const datum = expectListData(castPortfolio.toUplcData(portfolio))
            datum.items[0] = makeByteArrayData([])

            configureContext({ datum }).use((currentScript, ctx) => {
                throws(() => {
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    })
                })
            })
        })

        it("PortfolioModule::Portfolio::find_output #05 (throws an error if the datum listData contains an additional entry)", () => {
            const datum = expectListData(castPortfolio.toUplcData(portfolio))
            datum.items.push(makeByteArrayData([]))

            configureContext({ datum }).use((currentScript, ctx) => {
                throws(() => {
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    })
                })
            })
        })

        it("PortfolioModule::Portfolio::find_output #06 (throws an error if the datum reduction field has the wrong constr tag)", () => {
            const datum = expectListData(castPortfolio.toUplcData(portfolio))
            datum.items[1] = makeConstrData(
                2,
                expectConstrData(datum.items[1]).fields
            )

            configureContext({ datum }).use((currentScript, ctx) => {
                throws(() => {
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    })
                })
            })
        })
    })
})

describe("PortfolioModule::Portfolio::find_ref", () => {
    const portfolio = makePortfolio()

    describe("for the config_validator", () => {
        it("PortfolioModule::Portfolio::find_ref #01 (returns the portfolio data even if the referenced portfolio UTxO isn't at the portfolio_validator address)", () => {
            new ScriptContextBuilder()
                .addPortfolioRef({ address: makeDummyAddress(false), portfolio })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    deepEqual(
                        find_ref.eval({
                            $currentScript: "config_validator",
                            $scriptContext: ctx
                        }),
                        portfolio
                    )
                })
        })
    })

    describe("for all validators that don't have direct access to the policy", () => {
        it("PortfolioModule::Portfolio::find_ref #02 (throws an error if the portfolio UTxO is referenced, but the current input doesn't contain a policy token (so there is no indirect way to get policy))", () => {
            new ScriptContextBuilder()
                .addPortfolioRef({ portfolio })
                .use((ctx) => {
                    indirectPolicyScripts.forEach((currentScript) => {
                        throws(() => {
                            find_ref.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                        })
                    })
                })
        })
    })

    describe("for all validators that have direct access to the policy", () => {
        it("PortfolioModule::Portfolio::find_ref #03 (returns the portfolio data if the portfolio UTxO referenced and the current input doesn't contain a policy token)", () => {
            new ScriptContextBuilder()
                .addPortfolioRef({ portfolio })
                .use((ctx) => {
                    directPolicyScripts.forEach((currentScript) => {
                        deepEqual(
                            find_ref.eval({
                                $scriptContext: ctx,
                                $currentScript: currentScript
                            }),
                            portfolio
                        )
                    })
                })
        })
    })

    describe("for all validators except the config_validator", () => {
        const allExceptConfigValidator = scripts.filter(
            (s) => s != "config_validator"
        )

        it("PortfolioModule::Portfolio::find_ref #04 (throws an error if the referenced portfolio UTxO isn't at the portfolio_validator address)", () => {
            new ScriptContextBuilder()
                .addPortfolioRef({ address: makeDummyAddress(false), portfolio })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    allExceptConfigValidator.forEach((currentScript) => {
                        throws(() => {
                            find_ref.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                        })
                    })
                })
        })
    })
})

describe("PortfolioModule::Portfolio::find_thread", () => {
    const portfolio = makePortfolio()
    const redeemer: PortfolioActionType = { AddAssetClass: {} }

    describe("for all validators", () => {
        it("PortfolioModule::Portfolio::find_thread #01 (returns the portfolio data if the portfolio UTxO remains unchanged when spent and returned)", () => {
            new ScriptContextBuilder()
                .addPortfolioThread({ portfolio, redeemer })
                .use((ctx) => {
                    scripts.forEach((currentScript) => {
                        deepEqual(
                            find_thread.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            }),
                            [portfolio, portfolio]
                        )
                    })
                })
        })
    })
})

describe("PortfolioModule::Portfolio::get_reduction_result", () => {
    describe("in Idle state", () => {
        const state: PortfolioReductionType = { Idle: {} }

        it("PortfolioModule::Portfolio::get_reduction_result #01 (throws an error in Idle state)", () => {
            throws(() => {
                get_reduction_result.eval({
                    self: makePortfolio({ state })
                })
            })
        })
    })

    describe("in Reducing(TotalAssetValue) state", () => {
        const mode: PortfolioReductionModeType = {
            TotalAssetValue: {
                total: 0n,
                oldest_timestamp: 123
            }
        }

        it("PortfolioModule::Portfolio::get_reduction_result #02 (returns the reduction data if complete)", () => {
            const portfolio = makePortfolio({
                nGroups: 1,
                state: {
                    Reducing: {
                        group_iter: 1,
                        start_tick: 0,
                        mode
                    }
                }
            })

            equalsPortfolioReductionMode(
                get_reduction_result.eval({
                    self: portfolio
                }),
                mode
            )
        })

        it("PortfolioModule::Portfolio::get_reduction_result #03 (returns the reduction data if complete and the expected tick is matched)", () => {
            const portfolio = makePortfolio({
                nGroups: 1,
                state: {
                    Reducing: {
                        group_iter: 1,
                        start_tick: 0,
                        mode
                    }
                }
            })

            equalsPortfolioReductionMode(
                get_reduction_result.eval({
                    self: portfolio,
                    expected_tick: 0
                }),
                mode
            )
        })

        it("PortfolioModule::Portfolio::get_reduction_result #04 (throws an error if the expected tick isn't matched)", () => {
            const portfolio = makePortfolio({
                nGroups: 1,
                state: {
                    Reducing: {
                        group_iter: 1,
                        start_tick: 0,
                        mode
                    }
                }
            })

            throws(() => {
                get_reduction_result.eval({
                    self: portfolio,
                    expected_tick: 1
                })
            })
        })

        it("PortfolioModule::Portfolio::get_reduction_result #05 (throws an error if not complete)", () => {
            const portfolio = makePortfolio({
                nGroups: 1,
                state: {
                    Reducing: {
                        group_iter: 0,
                        start_tick: 0,
                        mode
                    }
                }
            })

            throws(() => {
                get_reduction_result.eval({
                    self: portfolio
                })
            })
        })
    })

    describe("in Reducing(Exists) state", () => {
        const mode: PortfolioReductionModeType = {
            Exists: {
                asset_class: makeDummyAssetClass(1),
                found: false
            }
        }

        it("PortfolioModule::Portfolio::get_reduction_result #06 (returns the reduction data if complete)", () => {
            const portfolio = makePortfolio({
                nGroups: 1,
                state: {
                    Reducing: {
                        group_iter: 1,
                        start_tick: 0,
                        mode
                    }
                }
            })

            equalsPortfolioReductionMode(
                get_reduction_result.eval({
                    self: portfolio
                }),
                mode
            )
        })

        it("PortfolioModule::Portfolio::get_reduction_result #07 (returns the reduction data if complete and the expected tick matches)", () => {
            const portfolio = makePortfolio({
                nGroups: 1,
                state: {
                    Reducing: {
                        group_iter: 1,
                        start_tick: 0,
                        mode
                    }
                }
            })

            equalsPortfolioReductionMode(
                get_reduction_result.eval({
                    self: portfolio,
                    expected_tick: 0
                }),
                mode
            )
        })

        it("PortfolioModule::Portfolio::get_reduction_result #08 (throws an error if the expected_tick doesn't match)", () => {
            const portfolio = makePortfolio({
                nGroups: 1,
                state: {
                    Reducing: {
                        group_iter: 1,
                        start_tick: 0,
                        mode
                    }
                }
            })

            throws(() => {
                get_reduction_result.eval({
                    self: portfolio,
                    expected_tick: 1
                })
            })
        })

        it("PortfolioModule::Portfolio::get_reduction_result #09 (throws an error if not complete)", () => {
            const portfolio = makePortfolio({
                nGroups: 1,
                state: {
                    Reducing: {
                        group_iter: 0,
                        start_tick: 0,
                        mode
                    }
                }
            })

            throws(() => {
                get_reduction_result.eval({
                    self: portfolio
                })
            })
        })
    })

    describe("in Reducing(DoesNotExist) state", () => {
        const mode: PortfolioReductionModeType = {
            DoesNotExist: {
                asset_class: makeDummyAssetClass(1)
            }
        }

        it("PortfolioModule::Portfolio::get_reduction_result #10 (returns the reduction data if complete)", () => {
            const portfolio = makePortfolio({
                nGroups: 1,
                state: {
                    Reducing: {
                        group_iter: 1,
                        start_tick: 0,
                        mode
                    }
                }
            })

            equalsPortfolioReductionMode(
                get_reduction_result.eval({
                    self: portfolio
                }),
                mode
            )
        })

        it("PortfolioModule::Portfolio::get_reduction_result #11 (returns the reduction data if complete and the expected tick is matched)", () => {
            const portfolio = makePortfolio({
                nGroups: 1,
                state: {
                    Reducing: {
                        group_iter: 1,
                        start_tick: 0,
                        mode
                    }
                }
            })

            equalsPortfolioReductionMode(
                get_reduction_result.eval({
                    self: portfolio,
                    expected_tick: 0
                }),
                mode
            )
        })

        it("PortfolioModule::Portfolio::get_reduction_result #12 (throws an error if the expected tick isn't matched)", () => {
            const portfolio = makePortfolio({
                nGroups: 1,
                state: {
                    Reducing: {
                        group_iter: 1,
                        start_tick: 0,
                        mode
                    }
                }
            })

            throws(() => {
                get_reduction_result.eval({
                    self: portfolio,
                    expected_tick: 1
                })
            })
        })

        it("PortfolioModule::Portfolio::get_reduction_result #13 (throws an error if not complete)", () => {
            const portfolio = makePortfolio({
                nGroups: 1,
                state: {
                    Reducing: {
                        group_iter: 0,
                        start_tick: 0,
                        mode
                    }
                }
            })

            throws(() => {
                get_reduction_result.eval({
                    self: portfolio
                })
            })
        })
    })
})

describe("PortfolioModule::sum_lovelace", () => {
    describe("value contains only lovelace", () => {
        const lovelace = 2_000_000n
        const v = makeValue(lovelace)

        describe("for all validators", () => {
            it("PortfolioModule::sum_lovelace #01 (returns the lovelace quantity given a dummy asset pointer)", () => {
                const ptrs: AssetPtrType[] = [
                    makeAssetPtr({ groupIndex: 100, assetClassIndex: 100 })
                ]

                scripts.forEach((currentScript) => {
                    new ScriptContextBuilder()
                        .redeemDummyTokenWithDvpPolicy()
                        .use((ctx, tx) => {
                            strictEqual(
                                sum_lovelace.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    v,
                                    inputs: tx.refInputs ?? [],
                                    ptrs,
                                    price_expiry: 0
                                }),
                                lovelace
                            )
                        })
                })
            })

            it("PortfolioModule::sum_lovelace #02 (throws an error if no dummy asset pointer is given)", () => {
                scripts.forEach((currentScript) => {
                    new ScriptContextBuilder()
                        .redeemDummyTokenWithDvpPolicy()
                        .use((ctx, tx) => {
                            throws(() => {
                                sum_lovelace.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    v,
                                    inputs: tx.refInputs ?? [],
                                    ptrs: [],
                                    price_expiry: 0
                                })
                            })
                        })
                })
            })
        })
    })

    describe("value contains lovelace and tokens of two other asset classes for which a single asset group is used", () => {
        const groupId = 0
        const lovelace = 2_000_000n

        const assetClass0 = makeDummyAssetClass(0)
        const price0: RatioType = [200_000, 1]
        const priceTimestamp0 = 100

        const assetClass1 = makeDummyAssetClass(1)
        const price1: RatioType = [300_000, 2]
        const priceTimestamp1 = 120

        const v = makeValue(
            lovelace,
            makeAssets([
                [assetClass0, 10],
                [assetClass1, 100]
            ])
        )

        const ptrs: AssetPtrType[] = [
            makeAssetPtr({ groupIndex: 100, assetClassIndex: 100 }),
            makeAssetPtr({ groupIndex: groupId, assetClassIndex: 0 }),
            makeAssetPtr({ groupIndex: groupId, assetClassIndex: 1 })
        ]

        describe("for all validators", () => {
            it("PortfolioModule::sum_lovelace #03 (returns the expected lovelace quantity given a dummy asset pointer and two other non-dummy asset pointers pointing to a single asset group)", () => {
                scripts.forEach((currentScript) => {
                    new ScriptContextBuilder()
                        .addAssetGroupRef({
                            assets: [
                                makeAsset({
                                    assetClass: assetClass0,
                                    price: price0,
                                    priceTimestamp: priceTimestamp0
                                }),
                                makeAsset({
                                    assetClass: assetClass1,
                                    price: price1,
                                    priceTimestamp: priceTimestamp1
                                })
                            ],
                            id: groupId
                        })
                        .redeemDummyTokenWithDvpPolicy()
                        .use((ctx, tx) => {
                            strictEqual(
                                sum_lovelace.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    v,
                                    inputs: tx.refInputs ?? [],
                                    ptrs,
                                    price_expiry: 100
                                }),
                                19000000n
                            )
                        })
                })
            })

            it("PortfolioModule::sum_lovelace #04 (returns the expected lovelace quantity even if too many asset pointers are given)", () => {
                scripts.forEach((currentScript) => {
                    new ScriptContextBuilder()
                        .addAssetGroupRef({
                            assets: [
                                makeAsset({
                                    assetClass: assetClass0,
                                    price: price0,
                                    priceTimestamp: priceTimestamp0
                                }),
                                makeAsset({
                                    assetClass: assetClass1,
                                    price: price1,
                                    priceTimestamp: priceTimestamp1
                                })
                            ],
                            id: groupId
                        })
                        .redeemDummyTokenWithDvpPolicy()
                        .use((ctx, tx) => {
                            strictEqual(
                                sum_lovelace.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    v,
                                    inputs: tx.refInputs ?? [],
                                    ptrs: ptrs.concat([makeAssetPtr()]),
                                    price_expiry: 100
                                }),
                                19000000n
                            )
                        })
                })
            })

            it("PortfolioModule::sum_lovelace #05 (throws an error if one of the price timestamps is too old)", () => {
                scripts.forEach((currentScript) => {
                    new ScriptContextBuilder()
                        .addAssetGroupRef({
                            assets: [
                                makeAsset({
                                    assetClass: assetClass0,
                                    price: price0,
                                    priceTimestamp: priceTimestamp0
                                }),
                                makeAsset({
                                    assetClass: assetClass1,
                                    price: price1,
                                    priceTimestamp: priceTimestamp1
                                })
                            ],
                            id: groupId
                        })
                        .redeemDummyTokenWithDvpPolicy()
                        .use((ctx, tx) => {
                            throws(() => {
                                sum_lovelace.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    v,
                                    inputs: tx.refInputs ?? [],
                                    ptrs,
                                    price_expiry: 101
                                })
                            })
                        })
                })
            })

            it("PortfolioModule::sum_lovelace #06 (throws an error if one of the asset prices has a zero denominator)", () => {
                scripts.forEach((currentScript) => {
                    new ScriptContextBuilder()
                        .addAssetGroupRef({
                            assets: [
                                makeAsset({
                                    assetClass: assetClass0,
                                    price: price0,
                                    priceTimestamp: priceTimestamp0
                                }),
                                makeAsset({
                                    assetClass: assetClass1,
                                    price: [300_000, 0],
                                    priceTimestamp: priceTimestamp1
                                })
                            ],
                            id: groupId
                        })
                        .redeemDummyTokenWithDvpPolicy()
                        .use((ctx, tx) => {
                            throws(() => {
                                sum_lovelace.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    v,
                                    inputs: tx.refInputs ?? [],
                                    ptrs,
                                    price_expiry: 100
                                })
                            })
                        })
                })
            })

            it("PortfolioModule::sum_lovelace #07 (throws an error if too few asset pointers are specified)", () => {
                scripts.forEach((currentScript) => {
                    new ScriptContextBuilder()
                        .addAssetGroupRef({
                            assets: [
                                makeAsset({
                                    assetClass: assetClass0,
                                    price: price0,
                                    priceTimestamp: priceTimestamp0
                                }),
                                makeAsset({
                                    assetClass: assetClass1,
                                    price: price1,
                                    priceTimestamp: priceTimestamp1
                                })
                            ],
                            id: groupId
                        })
                        .redeemDummyTokenWithDvpPolicy()
                        .use((ctx, tx) => {
                            throws(() => {
                                sum_lovelace.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    v,
                                    inputs: tx.refInputs ?? [],
                                    ptrs: ptrs.slice(0, 2),
                                    price_expiry: 100
                                })
                            })
                        })
                })
            })
        })
    })
})

describe("PortfolioModule::witnessed_by_portfolio", () => {
    describe("for the assets_validator", () => {
        it("PortfolioModule::witnessed_by_portfolio #01 (returns true if the portfolio UTxO is spent)", () => {
            new ScriptContextBuilder()
                .addPortfolioInput()
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    strictEqual(
                        witnessed_by_portfolio.eval({
                            $currentScript: "assets_validator",
                            $scriptContext: ctx
                        }),
                        true
                    )
                })
        })

        it("PortfolioModule::witnessed_by_portfolio #02 (returns true if the portfolio UTxO is spent, but not from the portfolio_validator address)", () => {
            new ScriptContextBuilder()
                .addPortfolioInput({ address: makeDummyAddress(false) })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    strictEqual(
                        witnessed_by_portfolio.eval({
                            $currentScript: "assets_validator",
                            $scriptContext: ctx
                        }),
                        true
                    )
                })
        })

        it("PortfolioModule::witnessed_by_portfolio #03 (returns false if the portfolio UTxO is spent but doesn't contain the portfolio token)", () => {
            new ScriptContextBuilder()
                .addPortfolioInput({ token: makeConfigToken() })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    strictEqual(
                        witnessed_by_portfolio.eval({
                            $currentScript: "assets_validator",
                            $scriptContext: ctx
                        }),
                        false
                    )
                })
        })
    })

    describe("for the other validators", () => {
        const otherScripts = scripts.filter((s) => s != "assets_validator")

        it("PortfolioModule::witnessed_by_portfolio #04 (returns true if the portfolio UTxO is spent)", () => {
            new ScriptContextBuilder()
                .addPortfolioInput()
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    otherScripts.forEach((currentScript) => {
                        strictEqual(
                            witnessed_by_portfolio.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            }),
                            true
                        )
                    })
                })
        })

        it("PortfolioModule::witnessed_by_portfolio #05 (returns false if the portfolio UTxO is spent, but not from the portfolio_validator address)", () => {
            new ScriptContextBuilder()
                .addPortfolioInput({ address: makeDummyAddress(false) })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    otherScripts.forEach((currentScript) => {
                        strictEqual(
                            witnessed_by_portfolio.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            }),
                            false
                        )
                    })
                })
        })

        it("PortfolioModule::witnessed_by_portfolio #06 (throws an error if the spent portfolio UTxO doesn't contain the portfolio token)", () => {
            new ScriptContextBuilder()
                .addPortfolioInput({ token: makeConfigToken() })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    otherScripts.forEach((currentScript) => {
                        throws(() => {
                            witnessed_by_portfolio.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                        })
                    })
                })
        })
    })
})
