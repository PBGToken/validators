import { strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { IntLike } from "@helios-lang/codec-utils"
import {
    AssetClass,
    Assets,
    PubKeyHash,
    StakingValidatorHash
} from "@helios-lang/ledger"
import { IntData } from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"
import { MAX_SCRIPT_SIZE } from "./constants"
import {
    AssetType,
    ConfigChangeProposal,
    ConfigStateType,
    ConfigType,
    SuccessFeeType,
    makeAsset,
    makeConfig,
    makePortfolio,
    makeSuccessFee,
    makeSupply
} from "./data"
import { makeDvpTokens, makeReimbursementToken } from "./tokens"
import { ScriptContextBuilder } from "./tx"

const {
    MIN_FEE_UPPER_LIMIT,
    MANAGEMENT_FEE_PERIOD_UPPER_LIMIT,
    SUCCESS_FEE_PERIOD_UPPER_LIMIT,
    MAX_PRICE_AGE_UPPER_LIMIT,
    UPDATE_DELAY_UPPER_LIMIT,
    MAX_SUPPLY_UPPER_LIMIT,
    main
} = contract.config_validator

describe("config_validator constants", () => {
    it("MIN_FEE_UPPER_LIMIT equals 1 token", () => {
        strictEqual(MIN_FEE_UPPER_LIMIT.eval({}), 1_000_000n)
    })

    it("MANAGEMENT_FEE_PERIOD_UPPER_LIMIT equals 366 days (about 1 year in milliseconds)", () => {
        strictEqual(
            MANAGEMENT_FEE_PERIOD_UPPER_LIMIT.eval({}),
            366n * 24n * 60n * 60n * 1000n
        )
    })

    it("SUCCESS_FEE_PERIOD_UPPER_LIMIT equals 3660 days (about 10 years in milliseconds)", () => {
        strictEqual(
            SUCCESS_FEE_PERIOD_UPPER_LIMIT.eval({}),
            10n * 366n * 24n * 60n * 60n * 1000n
        )
    })

    it("MAX_PRICE_AGE_UPPER_LIMIT equals 366 days (about 1 year in milliseconds)", () => {
        strictEqual(
            MAX_PRICE_AGE_UPPER_LIMIT.eval({}),
            366n * 24n * 60n * 60n * 1000n
        )
    })

    it("UPDATE_DELAY_UPPER_LIMIT equals 366 days (about 1 year in milliseconds)", () => {
        strictEqual(
            UPDATE_DELAY_UPPER_LIMIT.eval({}),
            366n * 24n * 60n * 60n * 1000n
        )
    })

    it("MAX_SUPPLY_UPPER_LIMIT equals equivalent of 1000 Trillion ADA (i.e. 10 Trillion tokens at initial price or 10x10^12 tokens)", () => {
        strictEqual(MAX_SUPPLY_UPPER_LIMIT.eval({}), BigInt(1e19))
    })
})

describe("config_validator::main", () => {
    describe("Idle -> Idle", () => {
        const state: ConfigStateType = {
            Idle: {}
        }
        const config = makeConfig({ state })
        const redeemer = new IntData(0)
        const configureContext = () => {
            return new ScriptContextBuilder().addConfigThread({
                config,
                redeemer
            })
        }

        it("config_validator::main #01 (throws an error for Idle to Idle state change)", () => {
            configureContext().use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config,
                        _: redeemer
                    })
                }, /illegal state change/)
            })
        })
    })

    describe("Changing -> Changing", () => {
        const state: ConfigStateType = {
            Changing: {
                proposal_timestamp: 0,
                proposal: {
                    AddingAssetClass: {
                        asset_class: AssetClass.dummy()
                    }
                }
            }
        }
        const config = makeConfig({
            state
        })
        const redeemer = new IntData(0)
        const configureContext = () => {
            return new ScriptContextBuilder().addConfigThread({
                config,
                redeemer
            })
        }

        it("config_validator::main #02 (throws an error for Changing to Changing state change)", () => {
            configureContext().use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config,
                        _: redeemer
                    })
                }, /illegal state change/)
            })
        })
    })

    describe("Idle -> Changing", () => {
        const redeemer = new IntData(0)
        const state0: ConfigStateType = {
            Idle: {}
        }
        const updateDelay = 4 * 24 * 60 * 60 * 1000
        const origMaxSupply = 100_000_000_000
        const config0 = makeConfig({
            state: state0,
            token: {
                maxSupply: origMaxSupply
            },
            governance: {
                updateDelay
            }
        })

        const configureContext = (props?: {
            prevAgent?: PubKeyHash
            proposal?: ConfigChangeProposal
            proposalTimestamp?: number
            governance?: StakingValidatorHash | null
        }) => {
            const proposalTimestamp = props?.proposalTimestamp ?? 1000

            const state1: ConfigStateType = {
                Changing: {
                    proposal_timestamp: proposalTimestamp,
                    proposal: props?.proposal ?? {
                        AddingAssetClass: {
                            asset_class: AssetClass.dummy()
                        }
                    }
                }
            }

            const config1 = makeConfig({
                state: state1,
                agent: props?.prevAgent,
                token: {
                    maxSupply: origMaxSupply
                },
                governance: {
                    updateDelay
                }
            })

            return new ScriptContextBuilder()
                .addConfigThread({
                    inputConfig: config0,
                    outputConfig: config1,
                    redeemer
                })
                .setTimeRange({ end: 1000 })
                .observeGovernance({ hash: props?.governance })
        }

        describe("AddingAssetClass", () => {
            const assetClass = AssetClass.dummy(0)

            const configureContext = (props?: { assetClass?: AssetClass }) => {
                const portfolio = makePortfolio({
                    nGroups: 1,
                    state: {
                        Reducing: {
                            group_iter: 1,
                            start_tick: 0,
                            mode: {
                                DoesNotExist: {
                                    asset_class: assetClass
                                }
                            }
                        }
                    }
                })

                const scb = configureParentContext({
                    proposal: {
                        AddingAssetClass: {
                            asset_class: props?.assetClass ?? assetClass
                        }
                    }
                }).addPortfolioRef({ portfolio })
                .addDummyInput()

                return scb
            }

            it("config_validator::main #03 (succeeds if the portfolio datum is in Reducing::DoesNotExist state for the asset class being added)", () => {
                configureContext().use((ctx) => {
                    strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config0,
                        _: redeemer
                    }), undefined)
                })
            })

            it("config_validator::main #04 (throws an error if the portfolio Reducing::DoesNotExist asset class doesn't correspond to the asset class being added)", () => {
                configureContext({ assetClass: AssetClass.dummy(1) }).use(
                    (ctx) => {
                        throws(() => {
                            main.eval({
                                $scriptContext: ctx,
                                $datum: config0,
                                _: redeemer
                            })
                        }, /asset class doesn't correspond with asset class in portfolio reduction/)
                    }
                )
            })
        })

        describe("RemovingAssetClass", () => {
            const assetClass = AssetClass.dummy(0)

            const configureContext = (props?: {
                assetClass?: AssetClass
                found?: boolean
            }) => {
                const portfolio = makePortfolio({
                    nGroups: 1,
                    state: {
                        Reducing: {
                            group_iter: 1,
                            start_tick: 0,
                            mode: {
                                Exists: {
                                    asset_class: assetClass,
                                    found: props?.found ?? true
                                }
                            }
                        }
                    }
                })

                const scb = configureParentContext({
                    proposal: {
                        RemovingAssetClass: {
                            asset_class: props?.assetClass ?? assetClass
                        }
                    }
                }).addPortfolioRef({ portfolio })
                .addDummyInput()

                return scb
            }

            it("config_validator::main #05 (succeeds if the portfolio datum is in Reducing::Exists state for the asset class being removed)", () => {
                configureContext().use((ctx) => {
                    strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config0,
                        _: redeemer
                    }), undefined)
                })
            })

            it("config_validator::main #06 (throws an error if the portfolio Reducing::Exists asset class doesn't correspond)", () => {
                configureContext({ assetClass: AssetClass.dummy(1) }).use(
                    (ctx) => {
                        throws(() => {
                            main.eval({
                                $scriptContext: ctx,
                                $datum: config0,
                                _: redeemer
                            })
                        }, /asset class doesn't correspond with asset class in portfolio reduction/)
                    }
                )
            })

            it("config_validator::main #07 (throws an error if the portfolio Reducing::Exists found flag is false)", () => {
                configureContext({ found: false }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /the asset class to be removed doesn't exist/)
                })
            })
        })

        describe("UpdatingSuccessFee", () => {
            const benchmark = StakingValidatorHash.dummy(1)
            const configureContext = (props?: {
                benchmark?: StakingValidatorHash
                newPeriod?: IntLike
                currentPeriod?: IntLike
                successFee?: SuccessFeeType
            }) => {
                const supply = makeSupply({
                    successFee: {
                        start_time: 0,
                        period: props?.currentPeriod ?? 6 * 24 * 60 * 60 * 1000 // 6 days
                    }
                })
                const scb = configureParentContext({
                    proposal: {
                        UpdatingSuccessFee: {
                            period:
                                props?.newPeriod ?? 365 * 24 * 60 * 60 * 1000,
                            benchmark,
                            fee: props?.successFee ?? makeSuccessFee()
                        }
                    }
                })
                    .setTimeRange({ end: 1000, start: 0 })
                    .observeBenchmark({
                        hash: props?.benchmark ?? benchmark,
                        redeemer: [1, 1]
                    })
                    .addSupplyRef({ supply })

                return scb
            }

            it("config_validator::main #08 (succeeds if the new period is in the correct range, the tx is observed by the new benchmark staking validator, the fee is valid, and the year ended)", () => {
                configureContext().use((ctx) => {
                    strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config0,
                        _: redeemer
                    }), undefined)
                })
            })

            it("config_validator::main #09 (throws an error if not witnessed by correct benchmark staking validator)", () => {
                configureContext({
                    benchmark: StakingValidatorHash.dummy(2)
                }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /not witnessed by new benchmark/)
                })
            })

            it("config_validator::main #10 (throws an error if the new period is zero)", () => {
                configureContext({ newPeriod: 0 }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /new period not larger than 0/)
                })
            })

            it("config_validator::main #12 (throws an error if the new success fee cycle period is too large)", () => {
                configureContext({
                    newPeriod: 11 * 366 * 24 * 60 * 60 * 1000
                }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /new period not smaller than upper limit/)
                })
            })

            it("config_validator::main #13 (throws an error if the new success fee structure is invalid)", () => {
                configureContext({
                    successFee: makeSuccessFee({ c0: -0.1, steps: [] })
                }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /new success fee isn't valid/)
                })
            })

            it("config_validator::main #14 (throws an error if the success fee period ends too soon (so the change is too late))", () => {
                configureContext({
                    currentPeriod: 4 * 24 * 60 * 60 * 1000
                }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /too late/)
                })
            })

            it("config_validator::main #15 (throws an error if the success fee period ends too far in the future (so the change is too soon))", () => {
                configureContext({
                    currentPeriod: 9 * 24 * 60 * 60 * 1000
                }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /too soon/)
                })
            })
        })

        describe("IncreasingMaxTokenSupply", () => {
            const configureContext = (props?: { maxSupply?: IntLike }) => {
                const scb = configureParentContext({
                    proposal: {
                        IncreasingMaxTokenSupply: {
                            max_supply: props?.maxSupply ?? 200_000_000_000
                        }
                    }
                })

                return scb
            }

            it("config_validator::main #16 (succeeds if new max supply is larger than old max supply)", () => {
                configureContext().use((ctx) => {
                    strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config0,
                        _: redeemer
                    }), undefined)
                })
            })

            it("config_validator::main #17 (throws an error if the new max supply is equal to the old max supply)", () => {
                configureContext({ maxSupply: 100_000_000_000 }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /new max token supply is larger than previous max token supply/)
                })
            })
        })

        describe("ChangingAgent", () => {
            const configureContext = (props?: {
                signingAgent?: PubKeyHash | null
            }) => {
                const agent = PubKeyHash.dummy(2)

                const scb = configureParentContext({
                    proposal: {
                        ChangingAgent: {
                            agent
                        }
                    }
                })

                if (props?.signingAgent !== undefined) {
                    if (props.signingAgent !== null) {
                        scb.addDummySigners(10)
                        scb.addSigner(props.signingAgent)
                    }
                } else {
                    scb.addDummySigners(10)
                    scb.addSigner(agent)
                }

                return scb
            }

            it("config_validator::main #18 (succeeds if tx is signed by agent)", () => {
                configureContext().use((ctx) => {
                    strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config0,
                        _: redeemer
                    }), undefined)
                })
            })

            it("config_validator::main #19 (throws an error if not signed by correct agent)", () => {
                configureContext({ signingAgent: PubKeyHash.dummy(3) }).use(
                    (ctx) => {
                        throws(() => {
                            main.eval({
                                $scriptContext: ctx,
                                $datum: config0,
                                _: redeemer
                            })
                        }, /not signed by new agent/)
                    }
                )
            })

            it("config_validator::main #20 (throws an error if not signed by anyone)", () => {
                configureContext({ signingAgent: null }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /not signed by new agent/)
                })
            })
        })

        describe("ChangingOracle", () => {
            const newOracle = StakingValidatorHash.dummy(5)
            const configureContext = (props?: {
                oracle?: StakingValidatorHash
            }) => {
                const scb = configureParentContext({
                    proposal: {
                        ChangingOracle: {
                            oracle: newOracle
                        }
                    }
                }).observeOracle({ hash: props?.oracle ?? newOracle })

                return scb
            }

            it("config_validator::main #21 (succeeds if witnessed by corresponding oracle staking validator)", () => {
                configureContext().use((ctx) => {
                    strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config0,
                        _: redeemer
                    }), undefined)
                })
            })

            it("config_validator::main #22 (throws an error if not witnessed by the corresponding oracle staking validator)", () => {
                configureContext({ oracle: StakingValidatorHash.dummy(6) }).use(
                    (ctx) => {
                        throws(() => {
                            main.eval({
                                $scriptContext: ctx,
                                $datum: config0,
                                _: redeemer
                            })
                        }, /not witnessed by new oracle delegate/)
                    }
                )
            })
        })

        describe("ChangingGovernance", () => {
            const newGovernance = StakingValidatorHash.dummy(5)
            const configureContext = (props?: {
                governance?: StakingValidatorHash
                updateDelay?: IntLike
            }) => {
                const scb = configureParentContext({
                    proposal: {
                        ChangingGovernance: {
                            delegate: newGovernance,
                            update_delay: props?.updateDelay ?? updateDelay
                        }
                    }
                }).observeOracle({ hash: props?.governance ?? newGovernance })

                return scb
            }

            it("config_validator::main #23 (succeeds if witnessed by corresponding governance staking validator)", () => {
                configureContext().use((ctx) => {
                    strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config0,
                        _: redeemer
                    }), undefined)
                })
            })

            it("config_validator::main #24 (throws an error if not witnessed by the corresponding governance staking validator)", () => {
                configureContext({
                    governance: StakingValidatorHash.dummy(6)
                }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /not witnessed by new gov delegate/)
                })
            })

            it("config_validator::main #25 (throws an error if the new update delay is 0)", () => {
                configureContext({ updateDelay: 0 }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /new gov delay isn't larger than 0/)
                })
            })
        })

        describe("ChangingMintFee", () => {
            const configureContext = (props?: {
                relative?: number
                minimum?: IntLike
            }) => {
                const scb = configureParentContext({
                    proposal: {
                        ChangingMintFee: {
                            relative: props?.relative ?? 0.005,
                            minimum: props?.minimum ?? 20_000n
                        }
                    }
                })

                return scb
            }

            it("config_validator::main #26 (succeeds if new mint fee parameters lie within the valid ranges)", () => {
                configureContext().use((ctx) => {
                    strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config0,
                        _: redeemer
                    }), undefined)
                })
            })

            it("config_validator::main #27 (succeeds if the new relative mint fee is zero)", () => {
                configureContext({ relative: 0 }).use((ctx) => {
                    strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config0,
                        _: redeemer
                    }), undefined)
                })
            })

            it("config_validator::main #28 (succeeds if both the new relative mint fee and minimum mint fee are zero)", () => {
                configureContext({ relative: 0, minimum: 0 }).use((ctx) => {
                    strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config0,
                        _: redeemer
                    }), undefined)
                })
            })

            it("config_validator::main #29 (throws an error if the relative mint fee is negative)", () => {
                configureContext({ relative: -0.005 }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /new relative mint fee is negative/)
                })
            })

            it("config_validator::main #30 (throws an error if the relative mint fee is too large)", () => {
                configureContext({ relative: 0.1 }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /new relative mint fee is too large/)
                })
            })

            it("config_validator::main #31 (throws an error if the minimum mint fee is negative)", () => {
                configureContext({ minimum: -1 }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /new min mint fee is negative/)
                })
            })

            it("config_validator::main #32 (throws an error if the minimum mint fee is too large)", () => {
                configureContext({ minimum: 1_000_001 }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /new min mint fee is out of bounds/)
                })
            })
        })

        describe("ChangingBurnFee", () => {
            const configureContext = (props?: {
                relative?: number
                minimum?: IntLike
            }) => {
                const scb = configureParentContext({
                    proposal: {
                        ChangingBurnFee: {
                            relative: props?.relative ?? 0.005,
                            minimum: props?.minimum ?? 20_000n
                        }
                    }
                })

                return scb
            }

            it("config_validator::main #33 (succeeds if new burn fee parameters lie within the valid ranges)", () => {
                configureContext().use((ctx) => {
                    strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config0,
                        _: redeemer
                    }), undefined)
                })
            })

            it("config_validator::main #34 (succeeds if the new relative burn fee is zero)", () => {
                configureContext({ relative: 0 }).use((ctx) => {
                    strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config0,
                        _: redeemer
                    }), undefined)
                })
            })

            it("config_validator::main #35 (succeeds if both the new relative burn fee and minimum burn fee are zero)", () => {
                configureContext({ relative: 0, minimum: 0 }).use((ctx) => {
                    strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config0,
                        _: redeemer
                    }), undefined)
                })
            })

            it("config_validator::main #36 (throws an error if the relative burn fee is negative)", () => {
                configureContext({ relative: -0.005 }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /new relative burn fee is negative/)
                })
            })

            it("config_validator::main #37 (throws an error if the relative burn fee is too large)", () => {
                configureContext({ relative: 0.1 }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /new relative burn is too large/)
                })
            })

            it("config_validator::main #38 (throws an error if the minimum burn fee is negative)", () => {
                configureContext({ minimum: -1 }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /new min burn fee is negative/)
                })
            })

            it("config_validator::main #39 (throws an error if the minimum burn fee is too large)", () => {
                configureContext({ minimum: 1_000_001 }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /new min burn fee is out of bounds/)
                })
            })
        })

        describe("ChangingManagementFee", () => {
            const configureContext = (props?: {
                relative?: number
                period?: IntLike
            }) => {
                const scb = configureParentContext({
                    proposal: {
                        ChangingManagementFee: {
                            relative: props?.relative ?? 0.0001,
                            period: props?.period ?? 24 * 60 * 60 * 1000
                        }
                    }
                })

                return scb
            }

            it("config_validator::main #40 (succeeds if new management fee parameters lie within the valid ranges)", () => {
                configureContext().use((ctx) => {
                    strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config0,
                        _: redeemer
                    }), undefined)
                })
            })

            it("config_validator::main #41 (succeeds if the new relative management fee is zero)", () => {
                configureContext({ relative: 0 }).use((ctx) => {
                    strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config0,
                        _: redeemer
                    }), undefined)
                })
            })

            it("config_validator::main #42 (throws an error if the relative management fee is negative)", () => {
                configureContext({ relative: -0.005 }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /new relative management is negative/)
                })
            })

            it("config_validator::main #43 (throws an error if the relative management fee is too large)", () => {
                configureContext({ relative: 0.1 }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /new relative management is too large/)
                })
            })

            it("config_validator::main #44 (throws an error if the new management fee period is negative)", () => {
                configureContext({ period: -1 }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /new management fee period isn't larger than 0/)
                })
            })

            it("config_validator::main #45 (throws an error if the new management fee period is too large)", () => {
                configureContext({ period: 367 * 24 * 60 * 60 * 1000 }).use(
                    (ctx) => {
                        throws(() => {
                            main.eval({
                                $scriptContext: ctx,
                                $datum: config0,
                                _: redeemer
                            })
                        }, /new management fee period is out of bounds/)
                    }
                )
            })
        })

        describe("ChangingMaxPriceAge", () => {
            const configureContext = (props?: { maxPriceAge?: IntLike }) => {
                const scb = configureParentContext({
                    proposal: {
                        ChangingMaxPriceAge: {
                            max_price_age:
                                props?.maxPriceAge ?? 1 * 60 * 60 * 1000
                        }
                    }
                })

                return scb
            }

            it("config_validator::main #46 (succeeds if the new max price age lies in the valid range)", () => {
                configureContext().use((ctx) => {
                    strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config0,
                        _: redeemer
                    }), undefined)
                })
            })

            it("config_validator::main #47 (throws an error if the new max price age is negative)", () => {
                configureContext({ maxPriceAge: -1 }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /new tau_p not larger than 0/)
                })
            })

            it("config_validator::main #48 (throws an error if the new max price age is too large)", () => {
                configureContext({
                    maxPriceAge: 367 * 24 * 60 * 60 * 1000
                }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /new tau_p out of bounds/)
                })
            })
        })

        describe("ChangingMetadata", () => {
            const configureContext = (props?: { hash?: number[] }) => {
                const scb = configureParentContext({
                    proposal: {
                        ChangingMetadata: {
                            metadata_hash: props?.hash ?? new Array(32).fill(0)
                        }
                    }
                })

                return scb
            }

            it("config_validator::main #49 (succeeds if the new hash has the correct length)", () => {
                configureContext().use((ctx) => {
                    strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config0,
                        _: redeemer
                    }), undefined)
                })
            })

            it("config_validator::main #50 (throws an error if the new hash doesn't have the correct length)", () => {
                configureContext({ hash: new Array(31).fill(0) }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /new metadata hash not 32 bytes long/)
                })
            })
        })

        describe("all Changing proposals", () => {
            it("config_validator::main #51 (throws an error if not witnessed by correct governance hash)", () => {
                configureContext({
                    governance: StakingValidatorHash.dummy()
                }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /not witnessed by governance/)
                })
            })

            it("config_validator::main #52 (throws an error if not witnessed by any governance hash)", () => {
                configureContext({ governance: null }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /not witnessed by governance/)
                })
            })

            it("config_validator::main #53 (throws an error if the something else in the config datum changed)", () => {
                configureContext({ prevAgent: PubKeyHash.dummy(123) }).use(
                    (ctx) => {
                        throws(() => {
                            main.eval({
                                $scriptContext: ctx,
                                $datum: config0,
                                _: redeemer
                            })
                        }, /bad new config data/)
                    }
                )
            })

            it("config_validator::main #54 (throws an error if the proposal timestamp is in the past)", () => {
                configureContext({ proposalTimestamp: -1 }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /proposal time not set to after tx validity time range/)
                })
            })

            it("config_validator::main #55 (throws an error if the proposal timestamp is too far in the future)", () => {
                configureContext({
                    proposalTimestamp: 25 * 60 * 60 * 1000
                }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /proposal time set too far in the future/)
                })
            })
        })

        const configureParentContext = configureContext
    })

    describe("Changing -> Idle", () => {
        const redeemer = new IntData(0)

        const updateDelay = 4 * 24 * 60 * 60 * 1000
        const origMaxSupply = 100_000_000_000
        const signingAgent = PubKeyHash.dummy(10)

        const makeConfig0 = (props?: {
            agent?: PubKeyHash
            proposal?: ConfigChangeProposal
            proposalTimestamp?: number
        }) => {
            const proposalTimestamp = props?.proposalTimestamp ?? 1000

            const state0: ConfigStateType = {
                Changing: {
                    proposal_timestamp: proposalTimestamp,
                    proposal: props?.proposal ?? {
                        AddingAssetClass: {
                            asset_class: AssetClass.dummy()
                        }
                    }
                }
            }

            const config0 = makeConfig({
                state: state0,
                agent: props?.agent ?? signingAgent,
                token: {
                    maxSupply: origMaxSupply
                },
                governance: {
                    updateDelay
                }
            })

            return config0
        }

        const configureContext = (props: {
            agent?: PubKeyHash
            config0: ConfigType
            governance?: StakingValidatorHash
            updateDelay?: IntLike
            successFee?: {
                fee?: SuccessFeeType
                benchmark?: StakingValidatorHash
            }
            mintFee?: {
                relative?: number
                minimum?: IntLike
            }
            burnFee?: {
                relative?: number
                minimum?: IntLike
            }
            managementFee?: {
                relative?: number
                period?: IntLike
            }
            t0?: number
            proposalTimestamp?: number
            oracle?: StakingValidatorHash
            maxSupply?: IntLike
            maxPriceAge?: IntLike
        }) => {
            const proposalTimestamp = props?.proposalTimestamp ?? 1000
            const config0 = props.config0

            const state1: ConfigStateType = {
                Idle: {}
            }

            const config1 = makeConfig({
                state: state1,
                agent: props?.agent ?? signingAgent,
                token: {
                    maxSupply: props?.maxSupply ?? origMaxSupply,
                    maxPriceAge: props?.maxPriceAge
                },
                governance: {
                    updateDelay: props?.updateDelay ?? updateDelay,
                    delegate: props?.governance
                },
                relManagementFee: props?.managementFee?.relative,
                managementFeePeriod: props?.managementFee?.period,
                mintFee: props?.mintFee,
                burnFee: props?.burnFee,
                oracle: props?.oracle,
                successFee: props?.successFee?.fee,
                benchmark: props?.successFee?.benchmark
            })

            const t0 = props?.t0 ?? proposalTimestamp + updateDelay + 1

            return new ScriptContextBuilder()
                .addConfigThread({
                    inputConfig: config0,
                    outputConfig: config1,
                    redeemer
                })
                .setTimeRange({ end: t0 + 1000, start: t0 })
                .addSigner(signingAgent)
        }

        const configureParentContext = configureContext

        describe("AddingAssetClass", () => {
            const assetClass = AssetClass.dummy()

            const config0 = makeConfig0({
                proposal: {
                    AddingAssetClass: {
                        asset_class: assetClass
                    }
                }
            })

            const configureContext = (props?: {
                governance?: StakingValidatorHash
                inputAssets?: AssetType[]
                outputAssets?: AssetType[]
            }) => {
                const groupId = 0
                const assets0: AssetType[] = props?.inputAssets ?? []

                const assets1 = props?.outputAssets ?? [
                    makeAsset({ assetClass })
                ]

                return configureParentContext({
                    config0,
                    governance: props?.governance
                }).addAssetGroupThread({
                    id: groupId,
                    inputAssets: assets0,
                    outputAssets: assets1
                })
                .addDummyInput()
            }

            it("config_validator::main #56 (succeeds if the tx has only one asset group thread and the added asset class is included in the group output but not in the group input)", () => {
                configureContext().use((ctx) => {
                    strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config0,
                        _: redeemer
                    }), undefined)
                })
            })

            it("config_validator::main #57 (throws an error if the tx contains another asset group input)", () => {
                configureContext()
                    .addAssetGroupInput({ id: 1 })
                    .use((ctx) => {
                        throws(() => {
                            main.eval({
                                $scriptContext: ctx,
                                $datum: config0,
                                _: redeemer
                            })
                        }, /not a singleton list/)
                    })
            })

            it("config_validator::main #58 (throws an error if the input asset group also contains the asset class)", () => {
                configureContext({
                    inputAssets: [makeAsset({ assetClass })]
                }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /asset class exists in group input/)
                })
            })

            it("config_validator::main #59 (throws an error of the output asset group doesn't contain the asset class)", () => {
                configureContext({
                    outputAssets: [
                        makeAsset({ assetClass: AssetClass.dummy(12) })
                    ]
                }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /asset class doesn't exist in group output/)
                })
            })

            it("config_validator::main #60 (succeeds if the output asset group contains the asset class twice (portfolio_validator is responsible for this))", () => {
                configureContext({
                    outputAssets: [
                        makeAsset({ assetClass }),
                        makeAsset({ assetClass })
                    ]
                }).use((ctx) => {
                    strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config0,
                        _: redeemer
                    }), undefined)
                })
            })

            it("config_validator::main #61 (throws an error if the output config data contains an invalid change)", () => {
                configureContext({
                    governance: StakingValidatorHash.dummy(1)
                }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /invalid datum change/)
                })
            })
        })

        describe("RemovingAssetClass", () => {
            const assetClass = AssetClass.dummy()

            const config0 = makeConfig0({
                proposal: {
                    RemovingAssetClass: {
                        asset_class: assetClass
                    }
                }
            })

            const configureContext = (props?: {
                governance?: StakingValidatorHash
                inputAssets?: AssetType[]
                outputAssets?: AssetType[]
            }) => {
                const groupId = 0
                const assets0: AssetType[] = props?.inputAssets ?? [
                    makeAsset({ assetClass })
                ]
                const assets1 = props?.outputAssets ?? []

                return configureParentContext({
                    config0,
                    governance: props?.governance
                }).addAssetGroupThread({
                    id: groupId,
                    inputAssets: assets0,
                    outputAssets: assets1
                })
                .addDummyInput()
            }

            it("config_validator::main #62 (succeeds if the tx has only one asset group thread and the added asset class is included in the group input but not in the group output)", () => {
                configureContext().use((ctx) => {
                    strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config0,
                        _: redeemer
                    }), undefined)
                })
            })

            it("config_validator::main #63 (throws an error if the tx contains another asset group input)", () => {
                configureContext()
                    .addAssetGroupInput({ id: 1 })
                    .use((ctx) => {
                        throws(() => {
                            main.eval({
                                $scriptContext: ctx,
                                $datum: config0,
                                _: redeemer
                            })
                        }, /not a singleton list/)
                    })
            })

            it("config_validator::main #64 (throws an error if the output asset group also contains the asset class)", () => {
                configureContext({
                    outputAssets: [makeAsset({ assetClass })]
                }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /asset class exists in group output/)
                })
            })

            it("config_validator::main #65 (throws an error of the input asset group doesn't contain the asset class)", () => {
                configureContext({
                    inputAssets: [
                        makeAsset({ assetClass: AssetClass.dummy(12) })
                    ]
                }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /asset class doesn't exist in group input/)
                })
            })

            it("config_validator::main #66 (throws an error if the output config data contains an invalid change)", () => {
                configureContext({
                    governance: StakingValidatorHash.dummy(1)
                }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /invalid datum change/)
                })
            })
        })

        describe("UpdatingSuccessFee", () => {
            const benchmark = StakingValidatorHash.dummy(1)
            const fee = makeSuccessFee()
            const config0 = makeConfig0({
                proposal: {
                    UpdatingSuccessFee: {
                        period: 365 * 24 * 60 * 80 * 1000,
                        benchmark: benchmark,
                        fee: fee
                    }
                }
            })

            const configureContext = (props?: {
                reimbursementTokenId?: number
                supplyToken?: Assets
            }) => {
                const prevPeriodId = 0

                return configureParentContext({
                    config0,
                    successFee: {
                        benchmark,
                        fee
                    }
                })
                    .addSupplyInput({
                        token: props?.supplyToken,
                        supply: makeSupply({
                            successFee: {
                                periodId: prevPeriodId
                            }
                        })
                    })
                    .mint({
                        assets: makeReimbursementToken(
                            props?.reimbursementTokenId ?? prevPeriodId
                        )
                    })
            }

            it("config_validator::main #67 (succeeds if the reimbursement token is minted and the supply UTxO is spent)", () => {
                configureContext().use((ctx) => {
                    strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config0,
                        _: redeemer
                    }), undefined)
                })
            })

            it("config_validator::main #68 (throws an error if the wrong reimbursement token is minted)", () => {
                configureContext({ reimbursementTokenId: 1 }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /not exactly one reimbursement token minted/)
                })
            })

            it("config_validator::main #69 (throws an error if the supply UTxO isn't spent)", () => {
                configureContext({ supplyToken: makeDvpTokens(1) }).use(
                    (ctx) => {
                        throws(() => {
                            main.eval({
                                $scriptContext: ctx,
                                $datum: config0,
                                _: redeemer
                            })
                        }, /not found/)
                    }
                )
            })
        })

        describe("IncreasingMaxTokenSupply", () => {
            const newMaxSupply = 200_000_000_000
            const config0 = makeConfig0({
                proposal: {
                    IncreasingMaxTokenSupply: {
                        max_supply: newMaxSupply
                    }
                }
            })

            const configureContext = (props?: {
                maxSupplyInConfig?: IntLike
            }) => {
                return configureParentContext({
                    config0,
                    maxSupply: props?.maxSupplyInConfig ?? newMaxSupply
                })
            }

            it("config_validator::main #70 (succeeds if output config data contains correct max_supply)", () => {
                configureContext().use((ctx) => {
                    strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config0,
                        _: redeemer
                    }), undefined)
                })
            })

            it("config_validator::main #71 (throws an error if the output data doesn't contain the correct max_supply)", () => {
                configureContext({ maxSupplyInConfig: 200_000_000_001n }).use(
                    (ctx) => {
                        throws(() => {
                            main.eval({
                                $scriptContext: ctx,
                                $datum: config0,
                                _: redeemer
                            })
                        }, /invalid datum change/)
                    }
                )
            })
        })

        describe("ChangingAgent", () => {
            const newAgent = PubKeyHash.dummy(123)
            const config0 = makeConfig0({
                proposal: {
                    ChangingAgent: {
                        agent: newAgent
                    }
                }
            })

            const configureContext = (props?: {
                agentInConfig?: PubKeyHash
            }) => {
                const agentInConfig = props?.agentInConfig ?? newAgent
                return configureParentContext({
                    config0,
                    agent: agentInConfig
                }).addSigner(agentInConfig)
            }

            it("config_validator::main #72 (succeeds if the output config data contains the correct agent)", () => {
                configureContext().use((ctx) => {
                    strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config0,
                        _: redeemer
                    }), undefined)
                })
            })

            it("config_validator::main #73 (throws an error if the output data doesn't contain the correct agent)", () => {
                configureContext({ agentInConfig: PubKeyHash.dummy(124) }).use(
                    (ctx) => {
                        throws(() => {
                            main.eval({
                                $scriptContext: ctx,
                                $datum: config0,
                                _: redeemer
                            })
                        }, /invalid datum change/)
                    }
                )
            })
        })

        describe("ChangingOracle", () => {
            const newOracle = StakingValidatorHash.dummy(123)
            const config0 = makeConfig0({
                proposal: {
                    ChangingOracle: {
                        oracle: newOracle
                    }
                }
            })

            const configureContext = (props?: {
                oracleInConfig?: StakingValidatorHash
            }) => {
                const oracleInConfig = props?.oracleInConfig ?? newOracle
                return configureParentContext({
                    config0,
                    oracle: oracleInConfig
                })
            }

            it("config_validator::main #74 (succeeds if the output config data contains the correct oracle staking validator hash)", () => {
                configureContext().use((ctx) => {
                    strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config0,
                        _: redeemer
                    }), undefined)
                })
            })

            it("config_validator::main #75 (throws an error if the output data doesn't contain the correct oracle staking validator hash)", () => {
                configureContext({
                    oracleInConfig: StakingValidatorHash.dummy(124)
                }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /invalid datum change/)
                })
            })
        })

        describe("ChangingGovernance", () => {
            const newGovernance = StakingValidatorHash.dummy(123)
            const newUpdateDelay = 7 * 24 * 60 * 60 * 1000
            const config0 = makeConfig0({
                proposal: {
                    ChangingGovernance: {
                        delegate: newGovernance,
                        update_delay: newUpdateDelay
                    }
                }
            })

            const configureContext = (props?: {
                governanceInConfig?: StakingValidatorHash
                updateDelayInConfig?: IntLike
            }) => {
                const governanceInConfig =
                    props?.governanceInConfig ?? newGovernance
                const updateDelayInConfig =
                    props?.updateDelayInConfig ?? newUpdateDelay
                return configureParentContext({
                    config0,
                    governance: governanceInConfig,
                    updateDelay: updateDelayInConfig
                })
            }

            it("config_validator::main #76 (succeeds if the output config data contains the correct governance staking validator hash)", () => {
                configureContext().use((ctx) => {
                    strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config0,
                        _: redeemer
                    }), undefined)
                })
            })

            it("config_validator::main #77 (throws an error if the output data doesn't contain the correct governance staking validator hash)", () => {
                configureContext({
                    governanceInConfig: StakingValidatorHash.dummy(124)
                }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /invalid datum change/)
                })
            })

            it("config_validator::main #78 (throws an error if the output data doesn't contain the correct update delay)", () => {
                configureContext({
                    updateDelayInConfig: 8 * 24 * 60 * 60 * 1000
                }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /invalid datum change/)
                })
            })
        })

        describe("ChangingMintFee", () => {
            const newRelativeFee = 0.004
            const newMinFee = 20_000n
            const config0 = makeConfig0({
                proposal: {
                    ChangingMintFee: {
                        relative: newRelativeFee,
                        minimum: newMinFee
                    }
                }
            })

            const configureContext = (props?: {
                relFeeInConfig?: number
                minFeeInConfig?: IntLike
            }) => {
                const relFeeInConfig = props?.relFeeInConfig ?? newRelativeFee
                const minFeeInConfig = props?.minFeeInConfig ?? newMinFee
                return configureParentContext({
                    config0,
                    mintFee: {
                        relative: relFeeInConfig,
                        minimum: minFeeInConfig
                    }
                })
            }

            it("config_validator::main #79 (succeeds if the output config data contains the correct mint fee parameters)", () => {
                configureContext().use((ctx) => {
                    strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config0,
                        _: redeemer
                    }), undefined)
                })
            })

            it("config_validator::main #80 (throws an error if the output data doesn't contain the correct relative mint fee)", () => {
                configureContext({ relFeeInConfig: 0.005 }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /invalid datum change/)
                })
            })

            it("config_validator::main #81 (throws an error if the output data doesn't contain the correct minimum mint fee)", () => {
                configureContext({ minFeeInConfig: 25_000n }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /invalid datum change/)
                })
            })
        })

        describe("ChangingBurnFee", () => {
            const newRelativeFee = 0.004
            const newMinFee = 20_000n
            const config0 = makeConfig0({
                proposal: {
                    ChangingBurnFee: {
                        relative: newRelativeFee,
                        minimum: newMinFee
                    }
                }
            })

            const configureContext = (props?: {
                relFeeInConfig?: number
                minFeeInConfig?: IntLike
            }) => {
                const relFeeInConfig = props?.relFeeInConfig ?? newRelativeFee
                const minFeeInConfig = props?.minFeeInConfig ?? newMinFee
                return configureParentContext({
                    config0,
                    burnFee: {
                        relative: relFeeInConfig,
                        minimum: minFeeInConfig
                    }
                })
            }

            it("config_validator::main #82 (succeeds if the output config data contains the correct burn fee parameters)", () => {
                configureContext().use((ctx) => {
                    strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config0,
                        _: redeemer
                    }), undefined)
                })
            })

            it("config_validator::main #83 (throws an error if the output data doesn't contain the correct relative burn fee)", () => {
                configureContext({ relFeeInConfig: 0.005 }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /invalid datum change/)
                })
            })

            it("config_validator::main #84 (throws an error if the output data doesn't contain the correct minimum burn fee)", () => {
                configureContext({ minFeeInConfig: 25_000n }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /invalid datum change/)
                })
            })
        })

        describe("ChangingManagementFee", () => {
            const newRelativeFee = 0.00009
            const newPeriod = 24 * 60 * 60 * 1000
            const config0 = makeConfig0({
                proposal: {
                    ChangingManagementFee: {
                        relative: newRelativeFee,
                        period: newPeriod
                    }
                }
            })

            const configureContext = (props?: {
                relFeeInConfig?: number
                periodInConfig?: IntLike
            }) => {
                const relFeeInConfig = props?.relFeeInConfig ?? newRelativeFee
                const periodInConfig = props?.periodInConfig ?? newPeriod
                return configureParentContext({
                    config0,
                    managementFee: {
                        relative: relFeeInConfig,
                        period: periodInConfig
                    }
                })
            }

            it("config_validator::main #85 (succeeds if the output config data contains the correct management fee parameters)", () => {
                configureContext().use((ctx) => {
                    strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config0,
                        _: redeemer
                    }), undefined)
                })
            })

            it("config_validator::main #86 (throws an error if the output data doesn't contain the correct relative management fee)", () => {
                configureContext({ relFeeInConfig: 0.0001 }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /invalid datum change/)
                })
            })

            it("config_validator::main #87 (throws an error if the output data doesn't contain the correct management fee period)", () => {
                configureContext({ periodInConfig: 25 * 60 * 60 * 1000 }).use(
                    (ctx) => {
                        throws(() => {
                            main.eval({
                                $scriptContext: ctx,
                                $datum: config0,
                                _: redeemer
                            })
                        }, /invalid datum change/)
                    }
                )
            })
        })

        describe("ChangingMaxPriceAge", () => {
            const newMaxPriceAge = 10 * 60 * 60 * 1000

            const config0 = makeConfig0({
                proposal: {
                    ChangingMaxPriceAge: {
                        max_price_age: newMaxPriceAge
                    }
                }
            })

            const configureContext = (props?: {
                maxPriceAgeInConfig?: IntLike
            }) => {
                const maxPriceAgeInConfig =
                    props?.maxPriceAgeInConfig ?? newMaxPriceAge
                return configureParentContext({
                    config0,
                    maxPriceAge: maxPriceAgeInConfig
                })
            }

            it("config_validator::main #88 (succeeds if the output config data contains the correct max price age)", () => {
                configureContext().use((ctx) => {
                    strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config0,
                        _: redeemer
                    }), undefined)
                })
            })

            it("config_validator::main #89 (throws an error if the output data doesn't contain the correct max price age)", () => {
                configureContext({
                    maxPriceAgeInConfig: 12 * 60 * 60 * 1000
                }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /invalid datum change/)
                })
            })
        })

        describe("ChangingMetadata", () => {
            const config0 = makeConfig0({
                proposal: {
                    ChangingMetadata: {
                        metadata_hash: new Array(32).fill(0)
                    }
                }
            })

            const configureContext = (props?: {
                governance?: StakingValidatorHash
                metadataToken?: Assets
            }) => {
                return configureParentContext({
                    config0,
                    governance: props?.governance
                }).addMetadataInput({ token: props?.metadataToken })
            }

            it("config_validator::main #90 (succeeds if metadata UTxO is spent and config remains unchanged)", () => {
                configureContext().use((ctx) => {
                    strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        $datum: config0,
                        _: redeemer
                    }), undefined)
                })
            })

            it("config_validator::main #91 (throws an error if the output config data contains an invalid change)", () => {
                configureContext({
                    governance: StakingValidatorHash.dummy(200)
                }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /invalid datum change/)
                })
            })

            it("config_validator::main #92 (throws an error if the returned metadata UTxO doesn't contain the metadata token)", () => {
                configureContext({ metadataToken: makeDvpTokens(1) }).use(
                    (ctx) => {
                        throws(() => {
                            main.eval({
                                $scriptContext: ctx,
                                $datum: config0,
                                _: redeemer
                            })
                        }, /metadata utxo not spent/)
                    }
                )
            })
        })

        describe("all Changing proposals", () => {
            it("config_validator::main #93 (throws an error if the tx validity time-range isn't far enough after the proposal timestamp)", () => {
                const config0 = makeConfig0()

                configureContext({
                    config0,
                    t0: 2000,
                    proposalTimestamp: 1000
                }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /update delay hasn't passed/)
                })
            })

            it("config_validator::main #94 (throws an error if the tx isn't signed by the agent)", () => {
                const config0 = makeConfig0()

                configureContext({ config0, agent: PubKeyHash.dummy(1) }).use(
                    (ctx) => {
                        throws(() => {
                            main.eval({
                                $scriptContext: ctx,
                                $datum: config0,
                                _: redeemer
                            })
                        }, /not signed by new agent/)
                    }
                )
            })

            it("config_validator::main #95 (throws an error if the output config data contains an invalid change)", () => {
                const assetClass = AssetClass.dummy()
                const config0 = makeConfig0()
                const groupId = 0
                const assets0: AssetType[] = []

                const assets1 = [
                    makeAsset({ assetClass })
                ]

                configureContext({
                    config0,
                    governance: StakingValidatorHash.dummy(13)
                }).addAssetGroupThread({
                    id: groupId,
                    inputAssets: assets0,
                    outputAssets: assets1
                }).use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: config0,
                            _: redeemer
                        })
                    }, /invalid datum change/)
                })
            })
        })
    })
})

describe("config_validator metrics", () => {
    const program = contract.config_validator.$hash.context.program
    
    const n = program.toCbor().length

    it(`program doesn't exceed ${MAX_SCRIPT_SIZE} bytes (${n})`, () => {
        if (n > MAX_SCRIPT_SIZE) {
            throw new Error("program too large")
        }
    })

    const ir = program.ir

    if (ir) {
        it("ir doesn't contain trace", () => {
            strictEqual(!!/__core__trace/.exec(ir), false)
        })
    }  
})