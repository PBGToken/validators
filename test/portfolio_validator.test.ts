import { strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { IntLike } from "@helios-lang/codec-utils"
import {
    Address,
    AssetClass,
    Assets,
    PubKeyHash,
    StakingValidatorHash
} from "@helios-lang/ledger"
import contract from "pbg-token-validators-test-context"
import {
    AssetType,
    PortfolioActionType,
    PortfolioReductionModeType,
    PortfolioType,
    makeAsset,
    makeAssetGroup,
    makeConfig,
    makePortfolio,
    makeSupply
} from "./data"
import { makeAssetsToken, makeConfigToken } from "./tokens"
import { ScriptContextBuilder } from "./tx"

const {
    validate_add_asset_group,
    validate_remove_asset_group,
    validate_start_reduction,
    validate_continue_reduction,
    validate_add_asset_class,
    validate_remove_asset_class,
    validate_update_prices,
    validate_move_assets,
    validate_reset_reduction,
    main
} = contract.portfolio_validator

describe("portfolio_validator::validate_add_asset_group", () => {
    const configureContext = (props?: {
        id?: IntLike
        assets?: AssetType[]
        portfolio0?: PortfolioType
    }) => {
        return new ScriptContextBuilder()
            .addPortfolioInput({
                redeemer: { AddOrRemoveAssetGroup: {} },
                portfolio: props?.portfolio0 ?? makePortfolio()
            })
            .addAssetGroupOutput({
                id: props?.id ?? 1,
                assets: props?.assets ?? []
            })
    }

    it("portfolio_validator::validate_add_asset_group #01 (returns true if the tx doesn't have an asset group input and the new asset group is empty)", () => {
        const portfolio0 = makePortfolio()
        const portfolio1 = makePortfolio({ nGroups: 1 })

        configureContext().use((ctx) => {
            strictEqual(
                validate_add_asset_group.eval({
                    $scriptContext: ctx,
                    portfolio0,
                    portfolio1,
                    added_id: 1
                }),
                true
            )
        })
    })

    it("portfolio_validator::validate_add_asset_group #02 (returns false if n_groups in the portfolio output datum isn't correct)", () => {
        const portfolio0 = makePortfolio()
        const portfolio1 = makePortfolio({ nGroups: 2 })

        configureContext().use((ctx) => {
            strictEqual(
                validate_add_asset_group.eval({
                    $scriptContext: ctx,
                    portfolio0,
                    portfolio1,
                    added_id: 1
                }),
                false
            )
        })
    })

    it("portfolio_validator::validate_add_asset_group #03 (returns false if n_groups in the portfolio output datum matches the added_id but not the previous n_groups incremented by 1)", () => {
        const portfolio0 = makePortfolio()
        const portfolio1 = makePortfolio({ nGroups: 2 })

        configureContext({ id: 2 }).use((ctx) => {
            strictEqual(
                validate_add_asset_group.eval({
                    $scriptContext: ctx,
                    portfolio0,
                    portfolio1,
                    added_id: 2
                }),
                false
            )
        })
    })

    it("portfolio_validator::validate_add_asset_group #04 (returns false if an asset group UTxO is spent)", () => {
        const portfolio0 = makePortfolio()
        const portfolio1 = makePortfolio({ nGroups: 1 })

        configureContext()
            .addAssetGroupInput()
            .use((ctx) => {
                strictEqual(
                    validate_add_asset_group.eval({
                        $scriptContext: ctx,
                        portfolio0,
                        portfolio1,
                        added_id: 1
                    }),
                    false
                )
            })
    })

    it("portfolio_validator::validate_add_asset_group #05 (returns false if the new asset group isn't empty)", () => {
        const portfolio0 = makePortfolio()
        const portfolio1 = makePortfolio({ nGroups: 1 })

        configureContext({ assets: [makeAsset()] }).use((ctx) => {
            strictEqual(
                validate_add_asset_group.eval({
                    $scriptContext: ctx,
                    portfolio0,
                    portfolio1,
                    added_id: 1
                }),
                false
            )
        })
    })
})

describe("portfolio_validator::validate_remove_asset_group", () => {
    const configureContext = (props?: {
        id?: IntLike | null
        assets?: AssetType[]
        portfolio0?: PortfolioType
    }) => {
        const scb = new ScriptContextBuilder().addPortfolioInput({
            redeemer: { AddOrRemoveAssetGroup: {} },
            portfolio: props?.portfolio0 ?? makePortfolio()
        })

        if (props?.id !== null) {
            const groupId = props?.id ?? 1
            scb.addAssetGroupInput({ id: groupId, assets: props?.assets ?? [] })
        }

        return scb
    }

    it("portfolio_validator::validate_remove_asset_group #01 (returns true if the tx only spends a single empty asset group)", () => {
        const portfolio0 = makePortfolio({ nGroups: 1 })
        const portfolio1 = makePortfolio()
        configureContext().use((ctx) => {
            strictEqual(
                validate_remove_asset_group.eval({
                    $scriptContext: ctx,
                    portfolio0,
                    portfolio1,
                    burned_id: 1
                }),
                true
            )
        })
    })

    it("portfolio_validator::validate_remove_asset_group #02 (throws an error if another AssetGroup is spent)", () => {
        const portfolio0 = makePortfolio({ nGroups: 1 })
        const portfolio1 = makePortfolio()
        configureContext()
            .addAssetGroupInput({ id: 2 })
            .use((ctx) => {
                throws(() => {
                    validate_remove_asset_group.eval({
                        $scriptContext: ctx,
                        portfolio0,
                        portfolio1,
                        burned_id: 1
                    })
                })
            })
    })

    it("portfolio_validator::validate_remove_asset_group #03 (throws an error if no AssetGroup is spent)", () => {
        const portfolio0 = makePortfolio({ nGroups: 1 })
        const portfolio1 = makePortfolio()

        configureContext({ id: null }).use((ctx) => {
            throws(() => {
                validate_remove_asset_group.eval({
                    $scriptContext: ctx,
                    portfolio0,
                    portfolio1,
                    burned_id: 1
                })
            })
        })
    })

    it("portfolio_validator::validate_remove_asset_group #04 (returns false if the input portfolio state isn't Idle)", () => {
        const portfolio0 = makePortfolio({
            nGroups: 1,
            state: {
                Reducing: {
                    group_iter: 0,
                    start_tick: 0,
                    mode: {
                        Exists: {
                            asset_class: AssetClass.dummy(),
                            found: false
                        }
                    }
                }
            }
        })
        const portfolio1 = makePortfolio()

        configureContext().use((ctx) => {
            strictEqual(
                validate_remove_asset_group.eval({
                    $scriptContext: ctx,
                    portfolio0,
                    portfolio1,
                    burned_id: 1
                }),
                false
            )
        })
    })

    it("portfolio_validator::validate_remove_asset_group #05 (returns false if the output portfolio state isn't Idle)", () => {
        const portfolio0 = makePortfolio({ nGroups: 1 })
        const portfolio1 = makePortfolio({
            state: {
                Reducing: {
                    group_iter: 0,
                    start_tick: 0,
                    mode: {
                        Exists: {
                            asset_class: AssetClass.dummy(),
                            found: false
                        }
                    }
                }
            }
        })

        configureContext().use((ctx) => {
            strictEqual(
                validate_remove_asset_group.eval({
                    $scriptContext: ctx,
                    portfolio0,
                    portfolio1,
                    burned_id: 1
                }),
                false
            )
        })
    })

    it("portfolio_validator::validate_remove_asset_group #06 (returns false if the burned_id doesn't correspond to the spent asset group id)", () => {
        const portfolio0 = makePortfolio({ nGroups: 1 })
        const portfolio1 = makePortfolio()

        configureContext().use((ctx) => {
            strictEqual(
                validate_remove_asset_group.eval({
                    $scriptContext: ctx,
                    portfolio0,
                    portfolio1,
                    burned_id: 2
                }),
                false
            )
        })
    })

    it("portfolio_validator::validate_remove_asset_group #07 (returns false if the removed_id isn't the id of the last asset group)", () => {
        const portfolio0 = makePortfolio({ nGroups: 2 })
        const portfolio1 = makePortfolio({ nGroups: 1 })

        configureContext().use((ctx) => {
            strictEqual(
                validate_remove_asset_group.eval({
                    $scriptContext: ctx,
                    portfolio0,
                    portfolio1,
                    burned_id: 1
                }),
                false
            )
        })
    })

    it("portfolio_validator::validate_remove_asset_group #08 (returns false if n_groups doesn't decrease by 1)", () => {
        const portfolio0 = makePortfolio({ nGroups: 2 })
        const portfolio1 = makePortfolio({ nGroups: 0 })

        configureContext({ id: 2 }).use((ctx) => {
            strictEqual(
                validate_remove_asset_group.eval({
                    $scriptContext: ctx,
                    portfolio0,
                    portfolio1,
                    burned_id: 2
                }),
                false
            )
        })
    })

    it("portfolio_validator::validate_remove_asset_group #09 (returns false if the removed asset group isn't empty)", () => {
        const portfolio0 = makePortfolio({ nGroups: 1 })
        const portfolio1 = makePortfolio()
        configureContext({ assets: [makeAsset()] }).use((ctx) => {
            strictEqual(
                validate_remove_asset_group.eval({
                    $scriptContext: ctx,
                    portfolio0,
                    portfolio1,
                    burned_id: 1
                }),
                false
            )
        })
    })
})

describe("portfolio_validator::validate_start_reduction", () => {
    const oldestPriceTimestamp = 10
    const groupPtrs = [1, 2]
    const assetClass0 = AssetClass.dummy(0)
    const assetClass1 = AssetClass.dummy(1)
    const assetClass2 = AssetClass.dummy(2)

    const configureContext = () => {
        const supply = makeSupply({ tick: 0, nLovelace: 30_000_000 })
        const group0 = makeAssetGroup({
            assets: [
                makeAsset({
                    assetClass: assetClass0,
                    price: [100, 1],
                    count: 100,
                    priceTimestamp: 11
                }),
                makeAsset({
                    assetClass: assetClass1,
                    price: [200, 1],
                    count: 1000,
                    priceTimestamp: oldestPriceTimestamp
                })
            ]
        })
        const group1 = makeAssetGroup({
            assets: [
                makeAsset({
                    assetClass: assetClass2,
                    price: [400, 2],
                    count: 10,
                    priceTimestamp: 12
                })
            ]
        })

        return new ScriptContextBuilder()
            .addPortfolioInput({
                redeemer: { Reduce: { group_ptrs: groupPtrs } }
            })
            .addSupplyRef({ supply })
            .addAssetGroupRef({ id: 1, ...group0 })
            .addAssetGroupRef({ id: 2, ...group1 })
    }

    describe("reducing TotalAssetValue", () => {
        const expectedValue = 30_000_000 + 200 * 1000 + 200 * 10 + 100 * 100

        const defaultTestArgs = {
            ig1: 2,
            kp1: 0,
            mode1: {
                TotalAssetValue: {
                    total: expectedValue,
                    oldest_timestamp: oldestPriceTimestamp
                }
            },
            group_ptrs: groupPtrs,
            n_all_groups: 4
        }

        it("portfolio_validator::validate_start_reduction #01 (return true if total value and oldest timestamp match)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_start_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    }),
                    true
                )
            })
        })

        it("portfolio_validator::validate_start_reduction #02 (returns false if the total value doesn't match)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_start_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        mode1: {
                            TotalAssetValue: {
                                total: expectedValue - 1,
                                oldest_timestamp: oldestPriceTimestamp
                            }
                        }
                    }),
                    false
                )
            })
        })

        it("portfolio_validator::validate_start_reduction #03 (return false if oldest timestamp doesn't match)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_start_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        mode1: {
                            TotalAssetValue: {
                                total: expectedValue,
                                oldest_timestamp: oldestPriceTimestamp + 1
                            }
                        }
                    }),
                    false
                )
            })
        })

        it("portfolio_validator::validate_start_reduction #04 (throws an error if an invalid group ptr is given)", () => {
            configureContext().use((ctx) => {
                throws(() => {
                    validate_start_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        group_ptrs: groupPtrs.slice(0, 1).concat([40])
                    })
                })
            })
        })
    })

    describe("reducing Exists", () => {
        const defaultTestArgs = {
            ig1: 2,
            kp1: 0,
            mode1: {
                Exists: {
                    asset_class: AssetClass.dummy(3),
                    found: false
                }
            },
            group_ptrs: groupPtrs,
            n_all_groups: 4
        }

        it("portfolio_validator::validate_start_reduction #05 (returns true when searching if found==false for an inexistent asset class)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_start_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    }),
                    true
                )
            })
        })

        it("portfolio_validator::validate_start_reduction #06 (returns false when searching if found==true for an inexistent asset class)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_start_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        mode1: {
                            Exists: {
                                asset_class: AssetClass.dummy(3),
                                found: true
                            }
                        }
                    }),
                    false
                )
            })
        })

        it("portfolio_validator::validate_start_reduction #07 (returns false when searching if found==true but group iter isn't correctly set for an existing asset class)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_start_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        mode1: {
                            Exists: {
                                asset_class: assetClass2,
                                found: true
                            }
                        }
                    }),
                    false
                )
            })
        })

        it("portfolio_validator::validate_start_reduction #08 (returns false when searching if found==false for an existing asset class)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_start_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        mode1: {
                            Exists: {
                                asset_class: assetClass2,
                                found: false
                            }
                        }
                    }),
                    false
                )
            })
        })

        it("portfolio_validator::validate_start_reduction #09 (returns true when searching if found==true for an existing asset class and the group iter is correctly set)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_start_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        ig1: 4,
                        mode1: {
                            Exists: {
                                asset_class: assetClass2,
                                found: true
                            }
                        }
                    }),
                    true
                )
            })
        })

        it("portfolio_validator::validate_start_reduction #10 (throws an error if an invalid group ptr is specified)", () => {
            configureContext().use((ctx) => {
                throws(() => {
                    validate_start_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        group_ptrs: groupPtrs.slice(0, 1).concat([3])
                    })
                })
            })
        })
    })

    describe("reducing DoesNotExist", () => {
        const defaultDoesntExistsTestArgs = {
            ig1: 2,
            kp1: 0,
            mode1: {
                DoesNotExist: {
                    asset_class: AssetClass.dummy(3)
                }
            },
            group_ptrs: groupPtrs,
            n_all_groups: 4
        }

        const defaultExistsTestArgs = {
            ...defaultDoesntExistsTestArgs,
            mode1: {
                DoesNotExist: {
                    asset_class: assetClass2
                }
            }
        }

        it("portfolio_validator::validate_start_reduction #11 (returns true when searching for an inexistent asset class)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_start_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultDoesntExistsTestArgs
                    }),
                    true
                )
            })
        })

        it("portfolio_validator::validate_start_reduction #12 (returns false when searching for an existing asset class)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_start_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultExistsTestArgs
                    }),
                    false
                )
            })
        })

        it("portfolio_validator::validate_start_reduction #13 (throws an error if an invalid group ptr is specified)", () => {
            configureContext().use((ctx) => {
                throws(() => {
                    validate_start_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultExistsTestArgs,
                        group_ptrs: groupPtrs.slice(0, 1).concat([3])
                    })
                })
            })
        })

        it("portfolio_validator::validate_start_reduction #14 (throws an error if an more group ptrs are specified than referenced asset groups)", () => {
            configureContext().use((ctx) => {
                throws(() => {
                    validate_start_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultExistsTestArgs,
                        ig1: 3,
                        group_ptrs: groupPtrs.concat([3])
                    })
                })
            })
        })

        it("portfolio_validator::validate_start_reduction #15 (throws an error if the order of the group_ptrs is reversed)", () => {
            configureContext().use((ctx) => {
                throws(() => {
                    validate_start_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultDoesntExistsTestArgs,
                        group_ptrs: groupPtrs.slice().reverse()
                    })
                })
            })
        })
    })

    describe("any Reduction mode", () => {
        const dummyMode: PortfolioReductionModeType = {
            Exists: {
                asset_class: AssetClass.dummy(),
                found: false
            }
        }

        const defaultTestArgs = {
            ig1: 2,
            kp1: 0,
            mode1: dummyMode,
            group_ptrs: groupPtrs,
            n_all_groups: 4
        }

        it("portfolio_validator::validate_start_reduction #16 (returns false if an AssetGroup is spent)", () => {
            configureContext()
                .addAssetGroupInput()
                .use((ctx) => {
                    strictEqual(
                        validate_start_reduction.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        }),
                        false
                    )
                })
        })

        it("portfolio_validator::validate_start_reduction #17 (returns false if the new reducing tick isn't equal to the supply tick)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_start_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        kp1: 1
                    }),
                    false
                )
            })
        })

        it("portfolio_validator::validate_start_reduction #18 (returns false if the new group_iter isn't equal to the number of group_ptrs)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_start_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        ig1: 3
                    }),
                    false
                )
            })
        })
    })
})

describe("portfolio_validator::validate_continue_reduction", () => {
    // continue from the state of the previous unit-test suite
    const oldestPriceTimestamp = 9
    const groupPtrs = [1, 2]
    const assetClass0 = AssetClass.dummy(3)
    const assetClass1 = AssetClass.dummy(4)
    const assetClass2 = AssetClass.dummy(5)
    const prevTotalValue = 30_000_000 + 200 * 1000 + 200 * 10 + 100 * 100
    const prevOldestPriceTimestamp = 10

    const configureContext = (props?: { secondGroupId?: number }) => {
        const supply = makeSupply({ tick: 0, nLovelace: 30_000_000 })
        const group0 = makeAssetGroup({
            assets: [
                makeAsset({
                    assetClass: assetClass0,
                    price: [100, 1],
                    count: 100,
                    priceTimestamp: 11
                }),
                makeAsset({
                    assetClass: assetClass1,
                    price: [200, 1],
                    count: 1000,
                    priceTimestamp: oldestPriceTimestamp
                })
            ]
        })
        const group1 = makeAssetGroup({
            assets: [
                makeAsset({
                    assetClass: assetClass2,
                    price: [400, 2],
                    count: 10,
                    priceTimestamp: 12
                })
            ]
        })

        return new ScriptContextBuilder()
            .addPortfolioInput({
                redeemer: { Reduce: { group_ptrs: groupPtrs } }
            })
            .addSupplyRef({ supply })
            .addAssetGroupRef({ id: 3, ...group0 })
            .addAssetGroupRef({ id: props?.secondGroupId ?? 4, ...group1 })
    }

    describe("reducing TotalAssetValue", () => {
        const expectedValue = prevTotalValue + 200 * 1000 + 200 * 10 + 100 * 100
        const mode0: PortfolioReductionModeType = {
            TotalAssetValue: {
                oldest_timestamp: prevOldestPriceTimestamp,
                total: prevTotalValue
            }
        }
        const defaultTestArgs = {
            ig0: 2,
            kp0: 0,
            ig1: 4,
            kp1: 0,
            n_all_groups: 10,
            mode0,
            mode1: {
                TotalAssetValue: {
                    total: expectedValue,
                    oldest_timestamp: oldestPriceTimestamp
                }
            },
            group_ptrs: groupPtrs
        }

        it("portfolio_validator::validate_continue_reduction #01 (return true if total value and oldest timestamp match)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_continue_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    }),
                    true
                )
            })
        })

        it("portfolio_validator::validate_continue_reduction #02 (returns false if the total value doesn't match)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_continue_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        mode1: {
                            TotalAssetValue: {
                                total: expectedValue - 1,
                                oldest_timestamp: oldestPriceTimestamp
                            }
                        }
                    }),
                    false
                )
            })
        })

        it("portfolio_validator::validate_continue_reduction #03 (returns false if oldest timestamp doesn't match)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_continue_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        mode1: {
                            TotalAssetValue: {
                                total: expectedValue,
                                oldest_timestamp: prevOldestPriceTimestamp
                            }
                        }
                    }),
                    false
                )
            })
        })

        it("portfolio_validator::validate_continue_reduction #04 (return false if the supply tick doesn't match)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_continue_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        kp0: 1,
                        kp1: 1
                    }),
                    false
                )
            })
        })

        it("portfolio_validator::validate_continue_reduction #05 (throws an error if an invalid group ptr is given)", () => {
            configureContext().use((ctx) => {
                throws(() => {
                    validate_continue_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        group_ptrs: groupPtrs.slice(0, 1).concat([40])
                    })
                })
            })
        })

        it("portfolio_validator::validate_continue_reduction #06 (throws an error if one of asset group ids isn't in order)", () => {
            configureContext({ secondGroupId: 5 }).use((ctx) => {
                throws(() => {
                    validate_continue_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })
                })
            })
        })
    })

    describe("reducing Exists", () => {
        const defaultDidntExistDoesntExistArgs = {
            ig0: 2,
            kp0: 0,
            ig1: 4,
            kp1: 0,
            n_all_groups: 10,
            mode0: {
                Exists: {
                    asset_class: AssetClass.dummy(7),
                    found: false
                }
            },
            mode1: {
                Exists: {
                    asset_class: AssetClass.dummy(7),
                    found: false
                }
            },
            group_ptrs: groupPtrs
        }

        const defaultDidntExistDoesExistArgs = {
            ig0: 2,
            kp0: 0,
            ig1: 4,
            kp1: 0,
            n_all_groups: 10,
            mode0: {
                Exists: {
                    asset_class: AssetClass.dummy(3),
                    found: false
                }
            },
            mode1: {
                Exists: {
                    asset_class: AssetClass.dummy(3),
                    found: true
                }
            },
            group_ptrs: groupPtrs
        }

        it("portfolio_validator::validate_continue_reduction #07 (returns true when searching if found==false for an inexistent asset class)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_continue_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultDidntExistDoesntExistArgs
                    }),
                    true
                )
            })
        })

        it("portfolio_validator::validate_continue_reduction #08 (returns false when searching if found==true for an inexistent asset class)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_continue_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultDidntExistDoesntExistArgs,
                        mode1: {
                            Exists: {
                                asset_class: AssetClass.dummy(7),
                                found: true
                            }
                        }
                    }),
                    false
                )
            })
        })

        it("portfolio_validator::validate_continue_reduction #09 (returns false when searching if found==true for an existing asset class and n_all_groups isn't correctly set)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_continue_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultDidntExistDoesExistArgs
                    }),
                    false
                )
            })
        })

        it("portfolio_validator::validate_continue_reduction #10 (returns true when searching if found==true for an existing asset class and n_all_groups is correctly set)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_continue_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultDidntExistDoesExistArgs,
                        ig1: 10
                    }),
                    true
                )
            })
        })

        it("portfolio_validator::validate_continue_reduction #11 (returns false when searching if found==false for an existing asset class)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_continue_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultDidntExistDoesExistArgs,
                        mode1: {
                            Exists: {
                                asset_class: AssetClass.dummy(3),
                                found: false
                            }
                        }
                    }),
                    false
                )
            })
        })

        it("portfolio_validator::validate_continue_reduction #12 (throws an error if an invalid group ptr is specified)", () => {
            configureContext().use((ctx) => {
                throws(() => {
                    validate_continue_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultDidntExistDoesExistArgs,
                        group_ptrs: groupPtrs.slice(0, 1).concat([3])
                    })
                })
            })
        })

        it("portfolio_validator::validate_continue_reduction #13 (returns false if the asset class changes)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_continue_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultDidntExistDoesExistArgs,
                        mode1: {
                            Exists: {
                                asset_class: AssetClass.dummy(4),
                                found: true
                            }
                        }
                    }),
                    false
                )
            })
        })
    })

    describe("reducing DoesNotExist", () => {
        const defaultDoesntExistTestArgs = {
            ig0: 2,
            ig1: 4,
            kp0: 0,
            kp1: 0,
            n_all_groups: 10,
            mode0: {
                DoesNotExist: {
                    asset_class: AssetClass.dummy(7)
                }
            },
            mode1: {
                DoesNotExist: {
                    asset_class: AssetClass.dummy(7)
                }
            },
            group_ptrs: groupPtrs
        }

        const defaultExistsTestArgs = {
            ig0: 2,
            ig1: 4,
            kp0: 0,
            kp1: 0,
            n_all_groups: 10,
            mode0: {
                DoesNotExist: {
                    asset_class: AssetClass.dummy(4)
                }
            },
            mode1: {
                DoesNotExist: {
                    asset_class: AssetClass.dummy(4)
                }
            },
            group_ptrs: groupPtrs
        }

        it("portfolio_validator::validate_continue_reduction #14 (returns true when searching for an inexistent asset class)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_continue_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultDoesntExistTestArgs
                    }),
                    true
                )
            })
        })

        it("portfolio_validator::validate_continue_reduction #15 (returns false when searching for an existing asset class)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_continue_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultExistsTestArgs
                    }),
                    false
                )
            })
        })

        it("portfolio_validator::validate_continue_reduction #16 (throws an error if an invalid group ptr is specified)", () => {
            configureContext().use((ctx) => {
                throws(() => {
                    validate_continue_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultExistsTestArgs,
                        group_ptrs: groupPtrs.slice(0, 1).concat([3])
                    })
                })
            })
        })

        it("portfolio_validator::validate_continue_reduction #17 (throws an error if an more group ptrs are specified than referenced asset groups)", () => {
            configureContext().use((ctx) => {
                throws(() => {
                    validate_continue_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultExistsTestArgs,
                        ig1: 5,
                        group_ptrs: groupPtrs.concat([3])
                    })
                })
            })
        })

        it("portfolio_validator::validate_continue_reduction #18 (returns false if the asset class changes)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_continue_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultDoesntExistTestArgs,
                        mode1: {
                            DoesNotExist: {
                                asset_class: AssetClass.dummy(8)
                            }
                        }
                    }),
                    false
                )
            })
        })
    })

    describe("any Reduction mode", () => {
        const dummyMode: PortfolioReductionModeType = {
            Exists: {
                asset_class: AssetClass.dummy(),
                found: false
            }
        }

        const defaultTestArgs = {
            ig0: 2,
            ig1: 4,
            kp0: 0,
            kp1: 0,
            n_all_groups: 10,
            mode0: dummyMode,
            mode1: dummyMode,
            group_ptrs: groupPtrs
        }

        it("portfolio_validator::validate_continue_reduction #19 (returns false if an AssetGroup is spent)", () => {
            configureContext()
                .addAssetGroupInput()
                .use((ctx) => {
                    strictEqual(
                        validate_continue_reduction.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        }),
                        false
                    )
                })
        })

        it("portfolio_validator::validate_continue_reduction #20 (returns false if the new reducing tick isn't equal to the supply tick)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_continue_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        kp1: 1
                    }),
                    false
                )
            })
        })

        it("portfolio_validator::validate_continue_reduction #21 (returns false if the new group_iter isn't equal to the number of group_ptrs)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_continue_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        ig1: 5
                    }),
                    false
                )
            })
        })

        it("portfolio_validator::validate_continue_reduction #22 (returns false if the input and output reducing modes aren't the same)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_continue_reduction.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        mode1: {
                            DoesNotExist: {
                                asset_class: AssetClass.dummy()
                            }
                        }
                    }),
                    false
                )
            })
        })
    })
})

describe("portfolio_validator::validate_add_asset_class", () => {
    const assetClass = AssetClass.dummy(1)
    const config = makeConfig({
        state: {
            Changing: {
                proposal_timestamp: 0,
                proposal: {
                    AddingAssetClass: {
                        asset_class: assetClass
                    }
                }
            }
        }
    })

    const portfolio0 = makePortfolio({
        nGroups: 4,
        state: {
            Reducing: {
                group_iter: 4,
                start_tick: 0,
                mode: {
                    DoesNotExist: {
                        asset_class: assetClass
                    }
                }
            }
        }
    })

    const configureContext = (props?: {
        inputAssets?: AssetType[]
        outputAssets?: AssetType[]
    }) => {
        const inputAssets: AssetType[] = props?.inputAssets ?? []
        const outputAssets: AssetType[] = props?.outputAssets ?? [
            makeAsset({ assetClass, count: 0 })
        ]

        return new ScriptContextBuilder()
            .addPortfolioInput({
                redeemer: { AddAssetClass: {} },
                portfolio: portfolio0
            })
            .addConfigInput({ config })
            .addAssetGroupThread({ id: 1, inputAssets, outputAssets })
    }

    const defaultTestArgs = {
        config0: config,
        config_is_spent: true,
        portfolio0
    }

    it("portfolio_validator::validate_add_asset_class #01 (returns true if the config is spent)", () => {
        configureContext().use((ctx) => {
            strictEqual(
                validate_add_asset_class.eval({
                    $scriptContext: ctx,
                    ...defaultTestArgs
                }),
                true
            )
        })
    })

    it("portfolio_validator::validate_add_asset_class #02 (throws an error if another AssetGroup input is spent)", () => {
        configureContext()
            .addAssetGroupInput({ id: 2 })
            .use((ctx) => {
                throws(() => {
                    validate_add_asset_class.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })
                })
            })
    })

    it("portfolio_validator::validate_add_asset_class #03 (returns false if the group output contains more assets than expected)", () => {
        configureContext({
            outputAssets: [
                makeAsset({ assetClass, count: 0 }),
                makeAsset({ assetClass: AssetClass.dummy(123), count: 0 })
            ]
        }).use((ctx) => {
            strictEqual(
                validate_add_asset_class.eval({
                    $scriptContext: ctx,
                    ...defaultTestArgs
                }),
                false
            )
        })
    })

    it("portfolio_validator::validate_add_asset_class #04 (returns false if the group output contains less assets than expected)", () => {
        configureContext({ outputAssets: [] }).use((ctx) => {
            strictEqual(
                validate_add_asset_class.eval({
                    $scriptContext: ctx,
                    ...defaultTestArgs
                }),
                false
            )
        })
    })

    it("portfolio_validator::validate_add_asset_class #05 (returns false if the group output contains more than the permitted number of asset classes)", () => {
        const inputAssets = [
            makeAsset({ assetClass: AssetClass.dummy(10), count: 0 }),
            makeAsset({ assetClass: AssetClass.dummy(11), count: 0 }),
            makeAsset({ assetClass: AssetClass.dummy(12), count: 0 })
        ]
        const outputAssets = inputAssets
            .slice()
            .concat([makeAsset({ assetClass, count: 0 })])

        configureContext({
            inputAssets,
            outputAssets
        }).use((ctx) => {
            strictEqual(
                validate_add_asset_class.eval({
                    $scriptContext: ctx,
                    ...defaultTestArgs
                }),
                false
            )
        })
    })

    it("portfolio_validator::validate_add_asset_class #06 (returns false if config isn't spent according to boolean arg (actual tx doesn't matter))", () => {
        configureContext().use((ctx) => {
            strictEqual(
                validate_add_asset_class.eval({
                    $scriptContext: ctx,
                    ...defaultTestArgs,
                    config_is_spent: false
                }),
                false
            )
        })
    })
})

describe("portfolio_validator::validate_remove_asset_class", () => {
    const assetClass = AssetClass.dummy(1)
    const config = makeConfig({
        state: {
            Changing: {
                proposal_timestamp: 0,
                proposal: {
                    RemovingAssetClass: {
                        asset_class: assetClass
                    }
                }
            }
        }
    })

    const portfolio0 = makePortfolio({
        nGroups: 4,
        state: {
            Reducing: {
                group_iter: 4,
                start_tick: 0,
                mode: {
                    Exists: {
                        asset_class: assetClass,
                        found: true
                    }
                }
            }
        }
    })

    const configureContext = (props?: {
        inputAssets?: AssetType[]
        outputAssets?: AssetType[]
    }) => {
        const inputAssets: AssetType[] = props?.inputAssets ?? [
            makeAsset({ assetClass, count: 0 })
        ]
        const outputAssets: AssetType[] = props?.outputAssets ?? []

        return new ScriptContextBuilder()
            .addPortfolioInput({
                redeemer: { AddAssetClass: {} },
                portfolio: portfolio0
            })
            .addConfigInput({ config })
            .addAssetGroupThread({ id: 1, inputAssets, outputAssets })
    }

    const defaultTestArgs = {
        config0: config,
        config_is_spent: true,
        portfolio0
    }

    it("portfolio_validator::validate_remove_asset_class #01 (returns true if the config is spent and the asset count is at 0)", () => {
        configureContext().use((ctx) => {
            strictEqual(
                validate_remove_asset_class.eval({
                    $scriptContext: ctx,
                    ...defaultTestArgs
                }),
                true
            )
        })
    })

    it("portfolio_validator::validate_remove_asset_class #02 (throws an error if another AssetGroup input is spent)", () => {
        configureContext()
            .addAssetGroupInput({ id: 2 })
            .use((ctx) => {
                throws(() => {
                    validate_remove_asset_class.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })
                })
            })
    })

    it("portfolio_validator::validate_remove_asset_class #03 (returns false if the group output contains more assets than expected)", () => {
        configureContext({
            outputAssets: [
                makeAsset({ assetClass: AssetClass.dummy(123), count: 0 })
            ]
        }).use((ctx) => {
            strictEqual(
                validate_remove_asset_class.eval({
                    $scriptContext: ctx,
                    ...defaultTestArgs
                }),
                false
            )
        })
    })

    it("portfolio_validator::validate_remove_asset_class #04 (returns false if the group output contains less assets than expected)", () => {
        configureContext({
            inputAssets: [
                makeAsset({ assetClass, count: 0 }),
                makeAsset({ assetClass: AssetClass.dummy(12), count: 0 })
            ],
            outputAssets: []
        }).use((ctx) => {
            strictEqual(
                validate_remove_asset_class.eval({
                    $scriptContext: ctx,
                    ...defaultTestArgs
                }),
                false
            )
        })
    })

    it("portfolio_validator::validate_remove_asset_class #05 (returns false if the asset count for the removed asset class isn't zero)", () => {
        configureContext({
            inputAssets: [makeAsset({ assetClass, count: 1 })]
        }).use((ctx) => {
            strictEqual(
                validate_remove_asset_class.eval({
                    $scriptContext: ctx,
                    ...defaultTestArgs
                }),
                false
            )
        })
    })

    it("portfolio_validator::validate_remove_asset_class #06 (returns false if config isn't spent according to boolean arg (actual tx doesn't matter))", () => {
        configureContext().use((ctx) => {
            strictEqual(
                validate_remove_asset_class.eval({
                    $scriptContext: ctx,
                    ...defaultTestArgs,
                    config_is_spent: false
                }),
                false
            )
        })
    })
})

describe("portfolio_validator::validate_update_prices", () => {
    const portfolio = makePortfolio({
        state: {
            Idle: {}
        }
    })

    const configureContext = (props?: {
        portfolio?: PortfolioType
        firstGroupOutputId?: IntLike
        secondAssetOutputCount?: IntLike
        oracleHash?: StakingValidatorHash
        additionalFirstGroupOutputAssets?: AssetType[]
    }) => {
        const config = makeConfig()

        const assetClass0 = AssetClass.dummy(0)
        const assetClass1 = AssetClass.dummy(1)
        const assetClass2 = AssetClass.dummy(2)

        const inputAssets0: AssetType[] = [
            makeAsset({
                assetClass: assetClass0,
                count: 100,
                price: [100, 1],
                priceTimestamp: 123
            }),
            makeAsset({
                assetClass: assetClass1,
                count: 100,
                price: [100, 2],
                priceTimestamp: 124
            })
        ]

        let outputAssets0: AssetType[] = [
            makeAsset({
                assetClass: assetClass0,
                count: 100,
                price: [200, 1],
                priceTimestamp: 200
            }),
            makeAsset({
                assetClass: assetClass1,
                count: 100,
                price: [200, 2],
                priceTimestamp: 200
            })
        ]

        if (props?.additionalFirstGroupOutputAssets) {
            outputAssets0 = outputAssets0.concat(
                props.additionalFirstGroupOutputAssets
            )
        }

        return new ScriptContextBuilder()
            .observeOracle({ hash: props?.oracleHash })
            .addConfigRef({ config })
            .addPortfolioInput({ portfolio, redeemer: { UpdatePrices: {} } })
            .addDummyInputs(10)
            .addAssetGroupThread({
                id: 1,
                inputAssets: inputAssets0,
                outputAssets: outputAssets0,
                outputToken: props?.firstGroupOutputId
                    ? makeAssetsToken(props.firstGroupOutputId)
                    : undefined
            })
            .addDummyInputs(5)
            .addAssetGroupThread({
                id: 2,
                inputAssets: [
                    makeAsset({
                        assetClass: assetClass2,
                        count: 100,
                        price: [100, 3],
                        priceTimestamp: 123
                    })
                ],
                outputAssets: [
                    makeAsset({
                        assetClass: assetClass2,
                        count: props?.secondAssetOutputCount ?? 100,
                        price: [200, 3],
                        priceTimestamp: 201
                    })
                ]
            })
    }

    it("portfolio_validator::validate_update_prices #01 (returns true if the reduction state is Idle, the tx is witnessed by the oracle and only the price and priceTimestamp fields change)", () => {
        configureContext().use((ctx) => {
            validate_update_prices.eval({
                $scriptContext: ctx,
                portfolio0: portfolio
            })
        })
    })

    it("portfolio_validator::validate_update_prices #02 (returns false if the portfolio reducing state isn't Idle)", () => {
        const portfolio = makePortfolio({
            state: {
                Reducing: {
                    group_iter: 0,
                    start_tick: 0,
                    mode: {
                        DoesNotExist: {
                            asset_class: AssetClass.dummy()
                        }
                    }
                }
            }
        })

        configureContext({ portfolio }).use((ctx) => {
            strictEqual(
                validate_update_prices.eval({
                    $scriptContext: ctx,
                    portfolio0: portfolio
                }),
                false
            )
        })
    })

    it("portfolio_validator::validate_update_prices #03 (returns false if one of the asset counts changed)", () => {
        configureContext({ secondAssetOutputCount: 101 }).use((ctx) => {
            strictEqual(
                validate_update_prices.eval({
                    $scriptContext: ctx,
                    portfolio0: portfolio
                }),
                false
            )
        })
    })

    it("portfolio_validator::validate_update_prices #04 (returns false if not witnessed by the oracle)", () => {
        configureContext({ oracleHash: StakingValidatorHash.dummy() }).use(
            (ctx) => {
                strictEqual(
                    validate_update_prices.eval({
                        $scriptContext: ctx,
                        portfolio0: portfolio
                    }),
                    false
                )
            }
        )
    })

    it("portfolio_validator::validate_update_prices #05 (throws an error if the first asset group output doesn't contain the expected asset group token)", () => {
        configureContext({ firstGroupOutputId: 3 }).use((ctx) => {
            throws(() => {
                validate_update_prices.eval({
                    $scriptContext: ctx,
                    portfolio0: portfolio
                })
            })
        })
    })

    it("portfolio_validator::validate_update_prices #06 (throws an error if the first asset group output contains more assets than the group input)", () => {
        configureContext({
            additionalFirstGroupOutputAssets: [
                makeAsset({
                    assetClass: AssetClass.dummy(5),
                    count: 10,
                    price: [10000, 1]
                })
            ]
        }).use((ctx) => {
            throws(() => {
                validate_update_prices.eval({
                    $scriptContext: ctx,
                    portfolio0: portfolio
                })
            })
        })
    })
})

describe("portfolio_validator::validate_move_assets", () => {
    describe("two groups, one asset moved from the first to second", () => {
        const portfolio = makePortfolio({
            state: {
                Idle: {}
            }
        })

        const assetClass0 = AssetClass.dummy(0)
        const assetClass1 = AssetClass.dummy(1)
        const assetClass2 = AssetClass.dummy(2)

        const inputAssets0: AssetType[] = [
            makeAsset({
                assetClass: assetClass0,
                count: 100,
                price: [100, 1],
                priceTimestamp: 123
            }),
            makeAsset({
                assetClass: assetClass1,
                count: 100,
                price: [100, 2],
                priceTimestamp: 124
            })
        ]

        const configureContext = (props?: {
            portfolio?: PortfolioType
            firstGroupOutputId?: IntLike
            secondAssetOutputCount?: IntLike
            additionalFirstGroupOutputAssets?: AssetType[]
        }) => {
            let outputAssets0: AssetType[] = [
                makeAsset({
                    assetClass: assetClass0,
                    count: 100,
                    price: [100, 1],
                    priceTimestamp: 123
                })
            ]

            if (props?.additionalFirstGroupOutputAssets) {
                outputAssets0 = outputAssets0.concat(
                    props.additionalFirstGroupOutputAssets
                )
            }

            let inputAssets1: AssetType[] = [
                makeAsset({
                    assetClass: assetClass2,
                    count: 100,
                    price: [100, 3],
                    priceTimestamp: 123
                })
            ]

            let outputAssets1: AssetType[] = [
                makeAsset({
                    assetClass: assetClass2,
                    count: props?.secondAssetOutputCount ?? 100,
                    price: [100, 3],
                    priceTimestamp: 123
                }),
                makeAsset({
                    assetClass: assetClass1,
                    count: 100,
                    price: [100, 2],
                    priceTimestamp: 124
                })
            ]

            return new ScriptContextBuilder()
                .addPortfolioInput({ portfolio, redeemer: { MoveAssets: {} } })
                .addDummyInputs(10)
                .addAssetGroupThread({
                    id: 1,
                    inputAssets: inputAssets0,
                    outputAssets: outputAssets0,
                    outputToken: props?.firstGroupOutputId
                        ? makeAssetsToken(props.firstGroupOutputId)
                        : undefined
                })
                .addDummyInputs(5)
                .addAssetGroupThread({
                    id: 2,
                    inputAssets: inputAssets1,
                    outputAssets: outputAssets1
                })
        }

        it("portfolio_validator::validate_move_assets #01 (returns true if the portfolio reduction is in Idle state and all assets in the input groups are present in the output groups)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_move_assets.eval({
                        $scriptContext: ctx,
                        portfolio0: portfolio
                    }),
                    true
                )
            })
        })

        it("portfolio_validator::validate_move_assets #02 (returns false if the portfolio reduction isn't in Idle state)", () => {
            const portfolio = makePortfolio({
                state: {
                    Reducing: {
                        group_iter: 0,
                        start_tick: 0,
                        mode: {
                            DoesNotExist: {
                                asset_class: AssetClass.dummy()
                            }
                        }
                    }
                }
            })

            configureContext({ portfolio }).use((ctx) => {
                strictEqual(
                    validate_move_assets.eval({
                        $scriptContext: ctx,
                        portfolio0: portfolio
                    }),
                    false
                )
            })
        })

        it("portfolio_validator::validate_move_assets #03 (returns false if an additional asset was added to the an asset group)", () => {
            configureContext({
                additionalFirstGroupOutputAssets: [
                    makeAsset({
                        assetClass: AssetClass.dummy(14),
                        count: 10,
                        price: [1000, 1]
                    })
                ]
            }).use((ctx) => {
                strictEqual(
                    validate_move_assets.eval({
                        $scriptContext: ctx,
                        portfolio0: portfolio
                    })
                , false)
            })
        })

        it("portfolio_validator::validate_move_assets #04 (throws an error if an asset change)", () => {
            configureContext({ secondAssetOutputCount: 101 }).use((ctx) => {
                throws(() => {
                    validate_move_assets.eval({
                        $scriptContext: ctx,
                        portfolio0: portfolio
                    })
                })
            })
        })

        it("portfolio_validator::validate_move_assets #05 (returns false if a third asset group output is included without associated unique input)", () => {
            configureContext()
                .addAssetGroupOutput({ id: 1, assets: inputAssets0 })
                .use((ctx) => {
                    strictEqual(
                        validate_move_assets.eval({
                            $scriptContext: ctx,
                            portfolio0: portfolio
                        }),
                        false
                    )
                })
        })
    })

    describe("two groups, all assets moved from second to first", () => {
        const portfolio = makePortfolio({
            state: {
                Idle: {}
            }
        })

        const assetClass0 = AssetClass.dummy(0)
        const assetClass1 = AssetClass.dummy(1)
        const assetClass2 = AssetClass.dummy(2)

        const inputAssets0: AssetType[] = [
            makeAsset({
                assetClass: assetClass0,
                count: 100,
                price: [100, 1],
                priceTimestamp: 123
            }),
            makeAsset({
                assetClass: assetClass1,
                count: 100,
                price: [100, 2],
                priceTimestamp: 124
            })
        ]

        const configureContext = (props?: { secondGroupAddress?: Address }) => {
            let outputAssets0: AssetType[] = [
                makeAsset({
                    assetClass: assetClass0,
                    count: 100,
                    price: [100, 1],
                    priceTimestamp: 123
                }),
                makeAsset({
                    assetClass: assetClass2,
                    count: 100,
                    price: [100, 3],
                    priceTimestamp: 123
                }),
                makeAsset({
                    assetClass: assetClass1,
                    count: 100,
                    price: [100, 2],
                    priceTimestamp: 124
                })
            ]

            let inputAssets1: AssetType[] = [
                makeAsset({
                    assetClass: assetClass2,
                    count: 100,
                    price: [100, 3],
                    priceTimestamp: 123
                })
            ]

            let outputAssets1: AssetType[] = []

            return new ScriptContextBuilder()
                .addPortfolioInput({ portfolio, redeemer: { MoveAssets: {} } })
                .addDummyInputs(10)
                .addAssetGroupThread({
                    id: 1,
                    inputAssets: inputAssets0,
                    outputAssets: outputAssets0
                })
                .addDummyInputs(5)
                .addAssetGroupThread({
                    id: 2,
                    inputAssets: inputAssets1,
                    outputAssets: outputAssets1,
                    outputAddress: props?.secondGroupAddress
                })
        }

        it("portfolio_validator::validate_move_assets #06 (returns true if the portfolio reduction is in Idle state and all assets in the input groups are present in the output groups)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_move_assets.eval({
                        $scriptContext: ctx,
                        portfolio0: portfolio
                    }),
                    true
                )
            })
        })

        it("portfolio_validator::validate_move_assets #07 (returns false if the second asset group isn't sent to the assets_validator address)", () => {
            configureContext({ secondGroupAddress: Address.dummy(false) }).use(
                (ctx) => {
                    strictEqual(
                        validate_move_assets.eval({
                            $scriptContext: ctx,
                            portfolio0: portfolio
                        }),
                        false
                    )
                }
            )
        })
    })
})

describe("portfolio_validator::validate_reset_reduction", () => {
    const portfolio = makePortfolio({
        state: {
            Reducing: {
                group_iter: 0,
                start_tick: 0,
                mode: { DoesNotExist: { asset_class: AssetClass.dummy(1) } }
            }
        }
    })

    const configureContext = (props?: { portfolio?: PortfolioType }) => {
        return new ScriptContextBuilder().addPortfolioInput({
            portfolio,
            redeemer: { Reset: {} }
        })
    }

    it("portfolio_validator::validate_reset_reduction #01 (returns true if the input portfolio reduction state is not Idle and no asset groups are spent)", () => {
        configureContext().use((ctx) => {
            strictEqual(
                validate_reset_reduction.eval({
                    $scriptContext: ctx,
                    portfolio0: portfolio
                }),
                true
            )
        })
    })

    it("portfolio_validator::validate_reset_reduction #02 (returns false if the input portfolio reduction state is Idle)", () => {
        const portfolio = makePortfolio({
            state: {
                Idle: {}
            }
        })

        configureContext({ portfolio }).use((ctx) => {
            strictEqual(
                validate_reset_reduction.eval({
                    $scriptContext: ctx,
                    portfolio0: portfolio
                }),
                false
            )
        })
    })

    it("portfolio_validator::validate_reset_reduction #03 (returns false if an asset group is spent)", () => {
        configureContext()
            .addAssetGroupInput()
            .use((ctx) => {
                strictEqual(
                    validate_reset_reduction.eval({
                        $scriptContext: ctx,
                        portfolio0: portfolio
                    }),
                    false
                )
            })
    })
})

describe("portfolio_validator::main", () => {
    describe("the config UTxO is referenced and nothing is minted, portfolio state going from Idle to Reducing", () => {
        const portfolio0 = makePortfolio({ nGroups: 1, state: { Idle: {} } })
        const agent = PubKeyHash.dummy(444)
        const config = makeConfig({ agent })
        const supply = makeSupply({ tick: 0 })

        const configureContext = (props: {
            portfolio1: PortfolioType
            action: PortfolioActionType
        }) => {
            return new ScriptContextBuilder()
                .addConfigRef({ config })
                .addPortfolioThread({
                    redeemer: props.action,
                    inputPortfolio: portfolio0,
                    outputPortfolio: props.portfolio1
                })
                .addSigner(agent)
                .addSupplyRef({ supply })
                .addAssetGroupRef({ id: 1, assets: [] })
        }

        const action: PortfolioActionType = { Reduce: { group_ptrs: [2] } }

        const configurePortfolio1 = (props?: {
            startTick?: IntLike
            nGroups?: IntLike
        }) => {
            return makePortfolio({
                nGroups: props?.nGroups ?? 1,
                state: {
                    Reducing: {
                        group_iter: 1,
                        start_tick: props?.startTick ?? 0,
                        mode: {
                            DoesNotExist: {
                                asset_class: AssetClass.dummy()
                            }
                        }
                    }
                }
            })
        }

        it("portfolio_validator::main #01 (succeeds if the action ptrs correctly points the referenced asset group)", () => {
            const portfolio1 = configurePortfolio1()

            configureContext({ portfolio1, action }).use((ctx) => {
                main.eval({ $scriptContext: ctx, _: portfolio0, action })
            })
        })

        it("portfolio_validator::main #02 (throws an error if the portfolio output reducing tick is wrong)", () => {
            const portfolio1 = configurePortfolio1({ startTick: 1 })

            configureContext({ portfolio1, action }).use((ctx) => {
                throws(() => {
                    main.eval({ $scriptContext: ctx, _: portfolio0, action })
                })
            })
        })

        it("portfolio_validator::main #03 (throws an error if n_groups in the portfolio output is different from the input)", () => {
            const portfolio1 = configurePortfolio1({ nGroups: 2 })

            configureContext({ portfolio1, action }).use((ctx) => {
                throws(() => {
                    main.eval({ $scriptContext: ctx, _: portfolio0, action })
                })
            })
        })
    })

    describe("the config UTxO is referenced and nothing is minted, portfolio state going from Reducing to Reducing", () => {
        const portfolio0 = makePortfolio({
            nGroups: 1,
            state: {
                Reducing: {
                    group_iter: 1,
                    start_tick: 0,
                    mode: {
                        DoesNotExist: {
                            asset_class: AssetClass.dummy()
                        }
                    }
                }
            }
        })
        const agent = PubKeyHash.dummy(444)
        const config = makeConfig({ agent })
        const supply = makeSupply({ tick: 0 })

        const configureContext = (props: {
            portfolio1: PortfolioType
            action: PortfolioActionType
        }) => {
            return new ScriptContextBuilder()
                .addConfigRef({ config })
                .addPortfolioThread({
                    redeemer: props.action,
                    inputPortfolio: portfolio0,
                    outputPortfolio: props.portfolio1
                })
                .addSigner(agent)
                .addSupplyRef({ supply })
                .addAssetGroupRef({ id: 2, assets: [] })
        }

        const action: PortfolioActionType = { Reduce: { group_ptrs: [2] } }

        const configurePortfolio1 = (props?: {
            startTick?: IntLike
            nGroups?: IntLike
        }) => {
            return makePortfolio({
                nGroups: props?.nGroups ?? 1,
                state: {
                    Reducing: {
                        group_iter: 2,
                        start_tick: props?.startTick ?? 0,
                        mode: {
                            DoesNotExist: {
                                asset_class: AssetClass.dummy()
                            }
                        }
                    }
                }
            })
        }

        it("portfolio_validator::main #04 (succeeds if the action ptrs correctly points the referenced asset group)", () => {
            const portfolio1 = configurePortfolio1()

            configureContext({ portfolio1, action }).use((ctx) => {
                main.eval({ $scriptContext: ctx, _: portfolio0, action })
            })
        })

        it("portfolio_validator::main #05 (throws an error if the portfolio output reducing tick is wrong)", () => {
            const portfolio1 = configurePortfolio1({ startTick: 1 })

            configureContext({ portfolio1, action }).use((ctx) => {
                throws(() => {
                    main.eval({ $scriptContext: ctx, _: portfolio0, action })
                })
            })
        })

        it("portfolio_validator::main #06 (throws an error if n_groups in the portfolio output is different from the input)", () => {
            const portfolio1 = configurePortfolio1({ nGroups: 2 })

            configureContext({ portfolio1, action }).use((ctx) => {
                throws(() => {
                    main.eval({ $scriptContext: ctx, _: portfolio0, action })
                })
            })
        })
    })

    describe("the config UTxO is referenced and nothing is minted, portfolio state going from Reducing to Idle", () => {
        const portfolio0 = makePortfolio({
            nGroups: 1,
            state: {
                Reducing: {
                    group_iter: 1,
                    start_tick: 0,
                    mode: {
                        DoesNotExist: {
                            asset_class: AssetClass.dummy()
                        }
                    }
                }
            }
        })
        const agent = PubKeyHash.dummy(444)
        const config = makeConfig({ agent })
        const supply = makeSupply({ tick: 0 })

        const configureContext = (props: {
            portfolio1: PortfolioType
            action: PortfolioActionType
            spendConfig?: boolean
        }) => {
            return new ScriptContextBuilder()
                .addConfigRef({ config })
                .addPortfolioThread({
                    redeemer: props.action,
                    inputPortfolio: portfolio0,
                    outputPortfolio: props.portfolio1
                })
                .addSigner(agent)
                .addSupplyRef({ supply })
        }

        const configurePortfolio1 = (props?: { nGroups?: IntLike }) => {
            return makePortfolio({
                nGroups: props?.nGroups ?? 1,
                state: {
                    Idle: {}
                }
            })
        }

        const action: PortfolioActionType = { Reset: {} }

        it("portfolio_validator::main #07 (succeeds for the Reset action)", () => {
            const portfolio1 = configurePortfolio1()

            configureContext({ portfolio1, action }).use((ctx) => {
                main.eval({ $scriptContext: ctx, _: portfolio0, action })
            })
        })

        it("portfolio_validator::main #08 (throws an error if n_groups in the portfolio output is different from the input)", () => {
            const portfolio1 = configurePortfolio1({ nGroups: 2 })

            configureContext({ portfolio1, action }).use((ctx) => {
                throws(() => {
                    main.eval({ $scriptContext: ctx, _: portfolio0, action })
                })
            })
        })
    })

    describe("an asset group is minted", () => {
        const portfolio0 = makePortfolio()
        const portfolio1 = makePortfolio({ nGroups: 1 })
        const action: PortfolioActionType = { AddOrRemoveAssetGroup: {} }

        const configureContext = (props?: {
            id?: IntLike
            nMinted?: IntLike
            signingAgent?: PubKeyHash
            mintedToken?: Assets
        }) => {
            const groupId = props?.id ?? 1
            const agent = PubKeyHash.dummy(10)
            const config = makeConfig({ agent })

            return new ScriptContextBuilder()
                .addPortfolioThread({
                    redeemer: { AddOrRemoveAssetGroup: {} },
                    inputPortfolio: portfolio0,
                    outputPortfolio: portfolio1
                })
                .addConfigRef({ config })
                .addSigner(props?.signingAgent ?? agent)
                .addAssetGroupOutput({
                    id: groupId,
                    assets: []
                })
                .mint({
                    assets:
                        props?.mintedToken ??
                        makeAssetsToken(groupId, props?.nMinted ?? 1)
                })
        }

        it("portfolio_validator::main #09 (succeeds if an asset group output exists with the expected output asset token)", () => {
            configureContext().use((ctx) => {
                main.eval({ $scriptContext: ctx, _: portfolio0, action })
            })
        })

        it("portfolio_validator::main #10 (throws an error if more than one token is minted)", () => {
            configureContext({ nMinted: 2 }).use((ctx) => {
                throws(() => {
                    main.eval({ $scriptContext: ctx, _: portfolio0, action })
                })
            })
        })

        it("portfolio_validator::main #11 (throws an error if the minted token isn't an asset group token)", () => {
            configureContext({ mintedToken: makeConfigToken() }).use((ctx) => {
                throws(() => {
                    main.eval({ $scriptContext: ctx, _: portfolio0, action })
                })
            })
        })

        it("portfolio_validator::main #12 (throws an error if not signed by correct agent)", () => {
            configureContext({ signingAgent: PubKeyHash.dummy(100) }).use(
                (ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            _: portfolio0,
                            action
                        })
                    })
                }
            )
        })
    })

    describe("an asset group is burned", () => {
        const portfolio0 = makePortfolio({ nGroups: 1 })
        const portfolio1 = makePortfolio()
        const action: PortfolioActionType = { AddOrRemoveAssetGroup: {} }

        const configureContext = (props?: {
            id?: IntLike
            nBurned?: IntLike
            signingAgent?: PubKeyHash
            burnedToken?: Assets
        }) => {
            const groupId = props?.id ?? 1
            const agent = PubKeyHash.dummy(10)
            const config = makeConfig({ agent })

            return new ScriptContextBuilder()
                .addPortfolioThread({
                    redeemer: { AddOrRemoveAssetGroup: {} },
                    inputPortfolio: portfolio0,
                    outputPortfolio: portfolio1
                })
                .addConfigRef({ config })
                .addSigner(props?.signingAgent ?? agent)
                .addAssetGroupInput({
                    id: groupId,
                    assets: []
                })
                .mint({
                    assets: (
                        props?.burnedToken ??
                        makeAssetsToken(groupId, props?.nBurned ?? 1)
                    ).multiply(-1)
                })
        }

        it("portfolio_validator::main #13 (succeeds if an asset group input exists with the expected burned asset token)", () => {
            configureContext().use((ctx) => {
                main.eval({ $scriptContext: ctx, _: portfolio0, action })
            })
        })

        it("portfolio_validator::main #14 (throws an error if more than one token is burned)", () => {
            configureContext({ nBurned: 2 }).use((ctx) => {
                throws(() => {
                    main.eval({ $scriptContext: ctx, _: portfolio0, action })
                })
            })
        })

        it("portfolio_validator::main #15 (throws an error if the burned token isn't an asset group token)", () => {
            configureContext({ burnedToken: makeConfigToken() }).use((ctx) => {
                throws(() => {
                    main.eval({ $scriptContext: ctx, _: portfolio0, action })
                })
            })
        })

        it("portfolio_validator::main #16 (throws an error if not signed by correct agent)", () => {
            configureContext({ signingAgent: PubKeyHash.dummy(100) }).use(
                (ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            _: portfolio0,
                            action
                        })
                    })
                }
            )
        })
    })
})
