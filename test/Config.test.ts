import { deepEqual, strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { ConstrData, IntData, ListData, UplcData } from "@helios-lang/uplc"
import {
    Address,
    AssetClass,
    Assets,
    PubKeyHash,
    StakingValidatorHash
} from "@helios-lang/ledger"
import contract from "pbg-token-validators-test-context"
import { orderValidatorScripts, scripts } from "./constants"
import {
    ConfigChangeProposal,
    ConfigType,
    RatioType,
    castConfig,
    equalsConfig,
    equalsConfigChangeProposal,
    makeConfig,
    makeSuccessFee
} from "./data"
import { makeConfigToken, makeDvpTokens } from "./tokens"
import { ScriptContextBuilder, withScripts } from "./tx"

const {
    INITIAL_PRICE,
    "MintFeeConfig::apply": apply_mint_fee,
    "MintFeeConfig::deduct": deduct_mint_fee_internal,
    "BurnFeeConfig::apply": apply_burn_fee,
    "BurnFeeConfig::deduct": deduct_burn_fee_internal,
    "SuccessFeeConfig::get_benchmark_price": get_benchmark_price_internal,
    "ConfigState::is_idle": is_idle,
    "ConfigState::get_proposal": get_proposal,
    "Config::find": find_config,
    "Config::find_input": find_config_input,
    "Config::find_output": find_config_output,
    "Config::find_ref": find_config_ref,
    "Config::find_thread": find_config_thread,
    "Config::get_benchmark_price": get_benchmark_price,
    deduct_burn_fee,
    deduct_mint_fee,
    price_expiry,
    signed_by_agent,
    witnessed_by_oracle,
    witnessed_by_governance
} = contract.ConfigModule

describe("ConfigModule::INITIAL_PRICE", () => {
    it("equal to 100/1", () => {
        deepEqual(INITIAL_PRICE.eval({}), [100n, 1n])
    })
})

describe("ConfigModule::MintFeeConfig::apply", () => {
    describe("non-zero relative and minimum mint fees", () => {
        const mintFee = {
            relative: 0.005,
            minimum: 20_000
        }

        it("charges the minimum fee if only a small amount of tokens are minted", () => {
            strictEqual(
                apply_mint_fee.eval({
                    self: mintFee,
                    n: 2_000_000
                }),
                20_000n
            )
        })

        it("charges the relative fee if a large amount of tokens are minted", () => {
            strictEqual(
                apply_mint_fee.eval({
                    self: mintFee,
                    n: 20_000_000
                }),
                100_000n
            )
        })

        it("charges the correct fee for a very specific order", () => {
            strictEqual(
                apply_mint_fee.eval({
                    self: mintFee,
                    n: Math.floor(200000000 / 140)
                }),
                20_000n
            )
        })
    })

    describe("non-zero minimum mint fee, but zero relative mint fee", () => {
        const mintFee = {
            relative: 0.0,
            minimum: 20_000
        }

        it("charges the minimum fee", () => {
            strictEqual(
                apply_mint_fee.eval({
                    self: mintFee,
                    n: 20_000_000
                }),
                20_000n
            )
        })
    })

    describe("zero relative and minimum mint fee", () => {
        const mintFee = {
            relative: 0.0,
            minimum: 0
        }

        it("charges nothing", () => {
            strictEqual(
                apply_mint_fee.eval({
                    self: mintFee,
                    n: 20_000_000
                }),
                0n
            )
        })
    })

    describe("garbage mint fee data", () => {
        const mintFeeData = new ListData([])

        it("throws an error", () => {
            throws(() => {
                apply_mint_fee.evalUnsafe({
                    self: mintFeeData,
                    n: new IntData(2_000_000n)
                })
            })
        })
    })
})

describe("ConfigModule::MintFeeConfig::deduct", () => {
    describe("non-zero relative and minimum mint fee", () => {
        const mintFee = {
            relative: 0.005,
            minimum: 20_000
        }

        it("deducts the minimum fee if only a small amount of tokens are minted", () => {
            strictEqual(
                deduct_mint_fee_internal.eval({
                    self: mintFee,
                    n: 2_000_000
                }),
                1_980_000n
            )
        })

        it("deducts the relative fee if large amount of tokens are minted", () => {
            strictEqual(
                deduct_mint_fee_internal.eval({
                    self: mintFee,
                    n: 20_000_000
                }),
                19_900_000n
            )
        })

        it("deducts the correct relative fee for a very specific order", () => {
            strictEqual(
                deduct_mint_fee_internal.eval({
                    self: mintFee,
                    n: Math.floor(200000000 / 140)
                }),
                1408571n
            )
        })
    })

    describe("non-zero minimum mint fee, but zero relative mint fee", () => {
        const mintFee = {
            relative: 0.0,
            minimum: 20_000
        }

        it("deducts the minimum fee", () => {
            strictEqual(
                deduct_mint_fee_internal.eval({
                    self: mintFee,
                    n: 20_000_000
                }),
                19_980_000n
            )
        })
    })

    describe("zero relative and minimum mint fee", () => {
        const mintFee = {
            relative: 0.0,
            minimum: 0
        }

        it("deducts nothing", () => {
            strictEqual(
                deduct_mint_fee_internal.eval({
                    self: mintFee,
                    n: 20_000_000
                }),
                20_000_000n
            )
        })
    })
})

describe("ConfigModule::BurnFeeConfig::apply", () => {
    describe("non-zero relative and minimum burn fee", () => {
        const burnFee = {
            relative: 0.005,
            minimum: 20_000
        }

        it("charges the minimum fee if only a small amount of tokens are burned", () => {
            strictEqual(
                apply_burn_fee.eval({
                    self: burnFee,
                    n: 2_000_000
                }),
                20_000n
            )
        })

        it("charges relative fee if a large amount of tokens are burned", () => {
            strictEqual(
                apply_burn_fee.eval({
                    self: burnFee,
                    n: 20_000_000
                }),
                100_000n
            )
        })
    })

    describe("non-zero minimum burn fee, but zero relative burn fee", () => {
        const burnFee = {
            relative: 0.0,
            minimum: 20_000
        }

        it("charges the minimum fee", () => {
            strictEqual(
                apply_burn_fee.eval({
                    self: burnFee,
                    n: 20_000_000
                }),
                20_000n
            )
        })
    })

    describe("zero relative and minimum burn fee", () => {
        const burnFee = {
            relative: 0.0,
            minimum: 0
        }

        it("charges nothing", () => {
            strictEqual(
                apply_burn_fee.eval({
                    self: burnFee,
                    n: 20_000_000
                }),
                0n
            )
        })
    })

    describe("garbage burn fee data", () => {
        const burnFeeData = new ListData([])

        it("throws an error", () => {
            throws(() => {
                apply_burn_fee.evalUnsafe({
                    self: burnFeeData,
                    n: new IntData(2_000_000n)
                })
            })
        })
    })
})

describe("ConfigModule::BurnFeeConfig::deduct", () => {
    describe("non-zero relative and minimum burn fee", () => {
        const burnFee = {
            relative: 0.005,
            minimum: 20_000
        }

        it("deducts the minimum fee if only a small amount of tokens are burned", () => {
            strictEqual(
                deduct_burn_fee_internal.eval({
                    self: burnFee,
                    n: 2_000_000
                }),
                1_980_000n
            )
        })

        it("deducts the relative fee if large amount of tokens are burned", () => {
            strictEqual(
                deduct_burn_fee_internal.eval({
                    self: burnFee,
                    n: 20_000_000
                }),
                19_900_000n
            )
        })
    })

    describe("non-zero minimum burn fee, but zero relative burn fee", () => {
        const burnFee = {
            relative: 0.0,
            minimum: 20_000
        }

        it("deducts minimum", () => {
            strictEqual(
                deduct_burn_fee_internal.eval({
                    self: burnFee,
                    n: 20_000_000
                }),
                19_980_000n
            )
        })
    })

    describe("zero relative and minimum burn fee", () => {
        const burnFee = {
            relative: 0.0,
            minimum: 0
        }

        it("deducts nothing", () => {
            strictEqual(
                deduct_burn_fee_internal.eval({
                    self: burnFee,
                    n: 20_000_000
                }),
                20_000_000n
            )
        })
    })
})

describe("ConfigModule::SuccessFeeConfig::get_benchmark_price", () => {
    const benchmark = contract.benchmark_delegate.$hash
    const price: RatioType = [100n, 1n]
    const successFeeConfig = {
        fee: makeSuccessFee(),
        benchmark
    }

    const configureContext = (props?: { ratio?: RatioType }) => {
        return new ScriptContextBuilder()
            .observeBenchmark({ redeemer: props?.ratio ?? [1, 1] })
            .redeemDummyTokenWithDvpPolicy()
    }

    describe("implicit benchmark hash taken from config", () => {
        it("returns the same value as the input value if the benchmark is ADA itself (i.e. 1/1)", () => {
            configureContext().use((ctx) => {
                deepEqual(
                    get_benchmark_price_internal.eval({
                        $scriptContext: ctx,
                        self: successFeeConfig,
                        lovelace_price: price
                    }),
                    price
                )
            })
        })

        it("returns a ratio with  denominator 0 if the benchmark price denominator is 0", () => {
            configureContext({ ratio: [1, 0] }).use((ctx) => {
                deepEqual(
                    get_benchmark_price_internal.eval({
                        $scriptContext: ctx,
                        self: successFeeConfig,
                        lovelace_price: price
                    }),
                    [100n, 0n]
                )
            })
        })
    })

    describe("explicit benchmark hash, benchmark is ADA", () => {
        it("returns the same value as the input value", () => {
            configureContext().use((ctx) => {
                deepEqual(
                    get_benchmark_price_internal.eval({
                        $scriptContext: ctx,
                        self: successFeeConfig,
                        lovelace_price: price,
                        benchmark
                    }),
                    price
                )
            })
        })

        it("throws an error when specifying another explicit benchmark hash than the benchmark delegate that is observing the tx", () => {
            configureContext().use((ctx) => {
                throws(() => {
                    get_benchmark_price_internal.eval({
                        $scriptContext: ctx,
                        self: successFeeConfig,
                        lovelace_price: price,
                        benchmark: StakingValidatorHash.dummy()
                    })
                })
            })
        })
    })
})

describe("ConfigModule::ConfigState::is_idle", () => {
    it("returns true if in Idle state", () => {
        strictEqual(
            is_idle.eval({
                self: { Idle: {} }
            }),
            true
        )
    })

    it("returns false if in Changing(AddingAssetClass) state", () => {
        strictEqual(
            is_idle.eval({
                self: {
                    Changing: {
                        proposal_timestamp: 0,
                        proposal: {
                            AddingAssetClass: {
                                asset_class: AssetClass.dummy()
                            }
                        }
                    }
                }
            }),
            false
        )
    })

    it("returns false if in Changing(RemovingAssetClass) state", () => {
        strictEqual(
            is_idle.eval({
                self: {
                    Changing: {
                        proposal_timestamp: 0,
                        proposal: {
                            RemovingAssetClass: {
                                asset_class: AssetClass.dummy()
                            }
                        }
                    }
                }
            }),
            false
        )
    })

    it("returns false if in Changing(UpdatingSuccessFee) state", () => {
        strictEqual(
            is_idle.eval({
                self: {
                    Changing: {
                        proposal_timestamp: 0,
                        proposal: {
                            UpdatingSuccessFee: {
                                period: 1000000,
                                benchmark: contract.benchmark_delegate.$hash,
                                fee: makeSuccessFee()
                            }
                        }
                    }
                }
            }),
            false
        )
    })

    it("returns false if in Changing(IncreasingMaxTokenSupply) state", () => {
        strictEqual(
            is_idle.eval({
                self: {
                    Changing: {
                        proposal_timestamp: 0,
                        proposal: {
                            IncreasingMaxTokenSupply: {
                                max_supply: 100000000
                            }
                        }
                    }
                }
            }),
            false
        )
    })

    it("returns false if in Changing(ChangingAgent) state", () => {
        strictEqual(
            is_idle.eval({
                self: {
                    Changing: {
                        proposal_timestamp: 0,
                        proposal: {
                            ChangingAgent: {
                                agent: PubKeyHash.dummy()
                            }
                        }
                    }
                }
            }),
            false
        )
    })

    it("returns false if in Changing(ChangingOracle) state", () => {
        strictEqual(
            is_idle.eval({
                self: {
                    Changing: {
                        proposal_timestamp: 0,
                        proposal: {
                            ChangingOracle: {
                                oracle: StakingValidatorHash.dummy()
                            }
                        }
                    }
                }
            }),
            false
        )
    })

    it("returns false if in Changing(ChangingGovernance) state", () => {
        strictEqual(
            is_idle.eval({
                self: {
                    Changing: {
                        proposal_timestamp: 0,
                        proposal: {
                            ChangingGovernance: {
                                delegate: StakingValidatorHash.dummy(),
                                update_delay: 10000
                            }
                        }
                    }
                }
            }),
            false
        )
    })

    it("returns false if in Changing(ChangingMintFee) state", () => {
        strictEqual(
            is_idle.eval({
                self: {
                    Changing: {
                        proposal_timestamp: 0,
                        proposal: {
                            ChangingMintFee: {
                                relative: 0.005,
                                minimum: 20_000
                            }
                        }
                    }
                }
            }),
            false
        )
    })

    it("returns false if in Changing(ChangingBurnFee) state", () => {
        strictEqual(
            is_idle.eval({
                self: {
                    Changing: {
                        proposal_timestamp: 0,
                        proposal: {
                            ChangingBurnFee: {
                                relative: 0.005,
                                minimum: 20_000
                            }
                        }
                    }
                }
            }),
            false
        )
    })

    it("returns false if in Changing(ChangingManagementFee) state", () => {
        strictEqual(
            is_idle.eval({
                self: {
                    Changing: {
                        proposal_timestamp: 0,
                        proposal: {
                            ChangingManagementFee: {
                                relative: 0.0001,
                                period: 24 * 60 * 60 * 1000
                            }
                        }
                    }
                }
            }),
            false
        )
    })

    it("returns false if in Changing(ChangingMaxPriceAge) state", () => {
        strictEqual(
            is_idle.eval({
                self: {
                    Changing: {
                        proposal_timestamp: 0,
                        proposal: {
                            ChangingMaxPriceAge: {
                                max_price_age: 12 * 60 * 60 * 1000
                            }
                        }
                    }
                }
            }),
            false
        )
    })

    it("returns false if in Changing(ChangingMetadata) state", () => {
        strictEqual(
            is_idle.eval({
                self: {
                    Changing: {
                        proposal_timestamp: 0,
                        proposal: {
                            ChangingMetadata: {
                                metadata_hash: []
                            }
                        }
                    }
                }
            }),
            false
        )
    })
})

describe("ConfigModule::ConfigState::get_proposal", () => {
    it("throws an error if in Idle state", () => {
        throws(() => {
            get_proposal.eval({
                self: {
                    Idle: {}
                }
            })
        })
    })

    it("returns the proposal data if in Changing(AddingAssetClass) state", () => {
        const proposal: ConfigChangeProposal = {
            AddingAssetClass: {
                asset_class: AssetClass.dummy()
            }
        }

        equalsConfigChangeProposal(
            get_proposal.eval({
                self: {
                    Changing: {
                        proposal_timestamp: 0,
                        proposal
                    }
                }
            }),
            proposal
        )
    })

    it("returns the proposal data if in Changing(RemovingAssetClass) state", () => {
        const proposal: ConfigChangeProposal = {
            RemovingAssetClass: {
                asset_class: AssetClass.dummy()
            }
        }

        equalsConfigChangeProposal(
            get_proposal.eval({
                self: {
                    Changing: {
                        proposal_timestamp: 0,
                        proposal
                    }
                }
            }),
            proposal
        )
    })

    it("returns the proposal data if in Changing(UpdatingSuccessFee) state", () => {
        const proposal: ConfigChangeProposal = {
            UpdatingSuccessFee: {
                period: 1000000,
                benchmark: contract.benchmark_delegate.$hash,
                fee: makeSuccessFee()
            }
        }

        equalsConfigChangeProposal(
            get_proposal.eval({
                self: {
                    Changing: {
                        proposal_timestamp: 0,
                        proposal
                    }
                }
            }),
            proposal
        )
    })

    it("returns the proposal data if in Changing(IncreasingMaxTokenSupply) state", () => {
        const proposal: ConfigChangeProposal = {
            IncreasingMaxTokenSupply: {
                max_supply: 100000000
            }
        }

        equalsConfigChangeProposal(
            get_proposal.eval({
                self: {
                    Changing: {
                        proposal_timestamp: 0,
                        proposal
                    }
                }
            }),
            proposal
        )
    })

    it("returns the proposal data if in Changing(ChangingAgent) state", () => {
        const proposal: ConfigChangeProposal = {
            ChangingAgent: {
                agent: PubKeyHash.dummy()
            }
        }

        equalsConfigChangeProposal(
            get_proposal.eval({
                self: {
                    Changing: {
                        proposal_timestamp: 0,
                        proposal
                    }
                }
            }),
            proposal
        )
    })

    it("returns the proposal data if in Changing(ChangingOracle) state", () => {
        const proposal: ConfigChangeProposal = {
            ChangingOracle: {
                oracle: StakingValidatorHash.dummy()
            }
        }

        equalsConfigChangeProposal(
            get_proposal.eval({
                self: {
                    Changing: {
                        proposal_timestamp: 0,
                        proposal
                    }
                }
            }),
            proposal
        )
    })

    it("returns the proposal data if in Changing(ChangingGovernance) state", () => {
        const proposal: ConfigChangeProposal = {
            ChangingGovernance: {
                delegate: StakingValidatorHash.dummy(),
                update_delay: 10000
            }
        }

        equalsConfigChangeProposal(
            get_proposal.eval({
                self: {
                    Changing: {
                        proposal_timestamp: 0,
                        proposal
                    }
                }
            }),
            proposal
        )
    })

    it("returns the proposal data if in Changing(ChangingMintFee) state", () => {
        const proposal: ConfigChangeProposal = {
            ChangingMintFee: {
                relative: 0.005,
                minimum: 20_000
            }
        }

        equalsConfigChangeProposal(
            get_proposal.eval({
                self: {
                    Changing: {
                        proposal_timestamp: 0,
                        proposal
                    }
                }
            }),
            proposal
        )
    })

    it("returns the proposal data if in Changing(ChangingBurnFee) state", () => {
        const proposal: ConfigChangeProposal = {
            ChangingBurnFee: {
                relative: 0.005,
                minimum: 20_000
            }
        }

        equalsConfigChangeProposal(
            get_proposal.eval({
                self: {
                    Changing: {
                        proposal_timestamp: 0,
                        proposal
                    }
                }
            }),
            proposal
        )
    })

    it("returns the proposal data if in Changing(ChangingManagementFee) state", () => {
        const proposal: ConfigChangeProposal = {
            ChangingManagementFee: {
                relative: 0.0001,
                period: 24 * 60 * 60 * 1000
            }
        }

        equalsConfigChangeProposal(
            get_proposal.eval({
                self: {
                    Changing: {
                        proposal_timestamp: 0,
                        proposal
                    }
                }
            }),
            proposal
        )
    })

    it("returns the proposal data if in Changing(ChangingMaxPriceAge) state", () => {
        const proposal: ConfigChangeProposal = {
            ChangingMaxPriceAge: {
                max_price_age: 12 * 60 * 60 * 1000
            }
        }

        equalsConfigChangeProposal(
            get_proposal.eval({
                self: {
                    Changing: {
                        proposal_timestamp: 0,
                        proposal
                    }
                }
            }),
            proposal
        )
    })

    it("returns the proposal data if in Changing(ChangingMetadata) state", () => {
        const proposal: ConfigChangeProposal = {
            ChangingMetadata: {
                metadata_hash: []
            }
        }

        equalsConfigChangeProposal(
            get_proposal.eval({
                self: {
                    Changing: {
                        proposal_timestamp: 0,
                        proposal
                    }
                }
            }),
            proposal
        )
    })
})

describe("ConfigModule::Config::find", () => {
    const config = makeConfig()

    describe("for the fund_policy", () => {
        it("returns the config data and the fact that the config UTxO is spent if the config UTxO is actually spent", () => {
            new ScriptContextBuilder()
                .addConfigInput({ config })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    // can't use deepEqual() because of Hash objects
                    const actual = find_config.eval({
                        $currentScript: "fund_policy",
                        $scriptContext: ctx
                    })

                    equalsConfig(actual[0], config)
                    strictEqual(actual[1], true)
                })
        })
    })

    describe("for the config_validator", () => {
        it("returns the config data and the fact that the config UTxO is spent if the config UTxO is the current input", () => {
            new ScriptContextBuilder()
                .addConfigInput({ config, redeemer: new IntData(0) })
                .use((ctx) => {
                    // can't use deepEqual() because of Hash objects
                    const actual = find_config.eval({
                        $currentScript: "config_validator",
                        $scriptContext: ctx
                    })

                    equalsConfig(actual[0], config)
                    strictEqual(actual[1], true)
                })
        })

        it("throws an error if the config UTxO isn't the current input", () => {
            new ScriptContextBuilder()
                .addConfigInput({ config })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    throws(() => {
                        find_config.eval({
                            $currentScript: "config_validator",
                            $scriptContext: ctx
                        })
                    })
                })
        })
    })

    describe("for the burn_order_validator and the mint_order_validator", () => {
        it("returns the config data and the fact that the config UTxO isn't spent if the config UTxO is referenced", () => {
            new ScriptContextBuilder()
                .addConfigRef({ config })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    orderValidatorScripts.forEach((currentScript) => {
                        const actual = find_config.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })

                        equalsConfig(actual[0], config)
                        strictEqual(actual[1], false)
                    })
                })
        })

        it("throws an error if the config UTxO is spent instead of referenced", () => {
            new ScriptContextBuilder()
                .addConfigInput({ config, redeemer: new IntData(0) })
                .use((ctx) => {
                    orderValidatorScripts.forEach((currentScript) => {
                        throws(() => {
                            find_config.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                        })
                    })
                })
        })

        it("throws an error if the config UTxO isn't at the config_validator address", () => {
            new ScriptContextBuilder()
                .addConfigRef({ config, address: Address.dummy(false) })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    orderValidatorScripts.forEach((currentScript) => {
                        throws(() => {
                            find_config.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                        })
                    })
                })
        })

        it("throws an error if the config UTxO doesn't contain the config token", () => {
            new ScriptContextBuilder()
                .addConfigRef({ config, token: makeDvpTokens(1) })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    orderValidatorScripts.forEach((currentScript) => {
                        throws(() => {
                            find_config.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                        })
                    })
                })
        })
    })

    describe("for all validators except the config_validator, the burn_order_validator and the mint_order_validator", () => {
        const otherScripts = scripts.filter(
            (s) =>
                ![
                    "mint_order_validator",
                    "burn_order_validator",
                    "config_validator"
                ].includes(s)
        )

        it("returns the config data and the fact that the config UTxO isn't spent if the config UTxO is referenced", () => {
            new ScriptContextBuilder()
                .addConfigRef({ config })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    otherScripts.forEach((currentScript) => {
                        const actual = find_config.eval({
                            $scriptContext: ctx,
                            $currentScript: currentScript
                        })

                        strictEqual(actual[1], false)
                        equalsConfig(actual[0], config)
                    })
                })
        })

        it("throws an error if the referenced config UTxO isn't at the config_validator address", () => {
            new ScriptContextBuilder()
                .addConfigRef({ config, address: Address.dummy(false) })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    otherScripts.forEach((currentScript) => {
                        throws(() => {
                            find_config.eval({
                                $scriptContext: ctx,
                                $currentScript: currentScript
                            })
                        })
                    })
                })
        })

        it("throws an error if the referenced config UTxO doesn't contain the config token", () => {
            new ScriptContextBuilder()
                .addConfigRef({ config, token: makeDvpTokens(1) })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    otherScripts.forEach((currentScript) => {
                        throws(() => {
                            find_config.eval({
                                $scriptContext: ctx,
                                $currentScript: currentScript
                            })
                        })
                    })
                })
        })

        it("returns the config data and the fact that the config UTxO is spent if the config UTxO is actually spent", () => {
            new ScriptContextBuilder()
                .addConfigInput({ config })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    otherScripts.forEach((currentScript) => {
                        const actual = find_config.eval({
                            $scriptContext: ctx,
                            $currentScript: currentScript
                        })

                        strictEqual(actual[1], true)
                        equalsConfig(actual[0], config)
                    })
                })
        })

        it("throws an error if the spent config UTxO isn't at the config_validator address", () => {
            new ScriptContextBuilder()
                .addConfigInput({ config, address: Address.dummy(false) })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    otherScripts.forEach((currentScript) => {
                        throws(() => {
                            find_config.eval({
                                $scriptContext: ctx,
                                $currentScript: currentScript
                            })
                        })
                    })
                })
        })

        it("throws an error if the spent config UTxO doesn't contain the config token", () => {
            new ScriptContextBuilder()
                .addConfigInput({ config, token: makeDvpTokens(1) })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    otherScripts.forEach((currentScript) => {
                        throws(() => {
                            find_config.eval({
                                $scriptContext: ctx,
                                $currentScript: currentScript
                            })
                        })
                    })
                })
        })
    })
})

describe("ConfigModule::Config::find_input", () => {
    const config = makeConfig()

    describe("@ config_validator", () => {
        it("returns the config data if the config UTxO is the current input", () => {
            new ScriptContextBuilder()
                .addConfigInput({ config, redeemer: new IntData(0) })
                .use((ctx) => {
                    // can't use deepEqual() because of Hash objects
                    const actual = find_config_input.eval({
                        $currentScript: "config_validator",
                        $scriptContext: ctx
                    })

                    equalsConfig(actual, config)
                })
        })

        it("throws an error if the config UTxO is spent but isn't the current input", () => {
            new ScriptContextBuilder()
                .addConfigInput({ config })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    throws(() => {
                        find_config_input.eval({
                            $currentScript: "config_validator",
                            $scriptContext: ctx
                        })
                    })
                })
        })

        it("throws an error if the config UTxO is merely referenced", () => {
            new ScriptContextBuilder()
                .addConfigRef({ config })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    throws(() => {
                        find_config_input.eval({
                            $currentScript: "config_validator",
                            $scriptContext: ctx
                        })
                    })
                })
        })
    })

    describe("@ other validators", () => {
        const otherScripts = scripts.filter((s) => s != "config_validator")

        it("returns the config data if the config UTxO is the current input", () => {
            new ScriptContextBuilder()
                .addConfigInput({ config, redeemer: new IntData(0) })
                .use((ctx) => {
                    otherScripts.forEach((currentScript) => {
                        const actual = find_config_input.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })

                        equalsConfig(actual, config)
                    })
                })
        })

        it("returns the config data if the config UTxO is spent, but is not the current input", () => {
            new ScriptContextBuilder()
                .addConfigInput({ config })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    otherScripts.forEach((currentScript) => {
                        const actual = find_config_input.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })

                        equalsConfig(actual, config)
                    })
                })
        })

        it("returns the config data even if the spent config UTxO contains more than one config token", () => {
            new ScriptContextBuilder()
                .addConfigInput({ config, token: makeConfigToken(2) })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    otherScripts.forEach((currentScript) => {
                        const actual = find_config_input.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })

                        equalsConfig(actual, config)
                    })
                })
        })

        it("throws an error if the spent config UTxO is at wrong address", () => {
            new ScriptContextBuilder()
                .addConfigInput({ config, address: Address.dummy(false) })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    otherScripts.forEach((currentScript) => {
                        throws(() => {
                            find_config_input.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                        })
                    })
                })
        })

        it("throws an error if the spent config UTxO doesn't contain config token", () => {
            new ScriptContextBuilder()
                .addConfigInput({ config, token: makeDvpTokens(1) })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    otherScripts.forEach((currentScript) => {
                        throws(() => {
                            find_config_input.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                        })
                    })
                })
        })
    })
})

describe("ConfigModule::Config::find_output", () => {
    const config = makeConfig()

    const configureParentContext = (props?: {
        address?: Address
        datum?: UplcData
        token?: Assets
    }) => {
        return new ScriptContextBuilder()
            .addConfigOutput({
                config,
                address: props?.address,
                datum: props?.datum,
                token: props?.token
            })
            .redeemDummyTokenWithDvpPolicy()
    }

    describe("@ all validators", () => {
        const configureContext = withScripts(configureParentContext, scripts)

        it("returns the config data if the config UTxO is returned to the config_validator address and contains the config token", () => {
            configureContext().use((currentScript, ctx) => {
                equalsConfig(
                    find_config_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    }),
                    config
                )
            })
        })

        it("throws an error if a garbage datum is given", () => {
            configureContext({ datum: new IntData(0) }).use(
                (currentScript, ctx) => {
                    throws(() => {
                        find_config_output.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })
                    })
                }
            )
        })

        it("throws an error if a garbage ConfigState::Changing proposal is given", () => {
            const configData = ListData.expect(castConfig.toUplcData(config))
            configData.items[5] = new ConstrData(1, [
                new IntData(0),
                new ConstrData(0, [
                    AssetClass.dummy().toUplcData(),
                    new IntData(0)
                ])
            ])

            configureContext({ datum: configData }).use(
                (currentScript, ctx) => {
                    throws(() => {
                        find_config_output.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })
                    })
                }
            )
        })

        it("throws an error if the config UTxO is returned to the wrong address", () => {
            configureContext({ address: Address.dummy(false) }).use(
                (currentScript, ctx) => {
                    throws(() => {
                        find_config_output.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })
                    })
                }
            )
        })

        it("throws an error if the returned config UTxO doesn't contain the config token", () => {
            configureContext({ token: makeDvpTokens(1) }).use(
                (currentScript, ctx) => {
                    throws(() => {
                        find_config_output.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })
                    })
                }
            )
        })

        it("throws an error if the returned config UTxO contains more than one config token", () => {
            configureContext({ token: makeConfigToken(2) }).use(
                (currentScript, ctx) => {
                    throws(() => {
                        find_config_output.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })
                    })
                }
            )
        })
    })
})

describe("ConfigModule::Config::find_ref", () => {
    const config = makeConfig()

    describe("for all validators", () => {
        it("returns the config data if the referenced config UTxO is at the config_validator address and contains the config token", () => {
            new ScriptContextBuilder()
                .addConfigRef({ config })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    scripts.forEach((currentScript) => {
                        equalsConfig(
                            find_config_ref.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            }),
                            config
                        )
                    })
                })
        })

        it("returns the config data even if the referenced config UTxO contains more than one config token", () => {
            new ScriptContextBuilder()
                .addConfigRef({ config, token: makeConfigToken(2) })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    scripts.forEach((currentScript) => {
                        equalsConfig(
                            find_config_ref.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            }),
                            config
                        )
                    })
                })
        })

        it("throws an error if the referenced config UTxO is at the wrong address", () => {
            new ScriptContextBuilder()
                .addConfigRef({ config, address: Address.dummy(false) })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    scripts.forEach((currentScript) => {
                        throws(() => {
                            find_config_ref.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                        })
                    })
                })
        })

        it("throws an error if the referenced config UTxO doesn't contain the config token", () => {
            new ScriptContextBuilder()
                .addConfigRef({ config, token: makeDvpTokens(1) })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    scripts.forEach((currentScript) => {
                        throws(() => {
                            find_config_ref.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                        })
                    })
                })
        })
    })
})

describe("ConfigModule::Config::find_thread", () => {
    const config = makeConfig()

    describe("for the config_validator", () => {
        it("returns the config data twice if the config UTxO datum remains unchanged when spent and returned, and the config thread input is the current input", () => {
            new ScriptContextBuilder()
                .addConfigThread({ config, redeemer: new IntData(0) })
                .use((ctx) => {
                    const actual = find_config_thread.eval({
                        $currentScript: "config_validator",
                        $scriptContext: ctx
                    })

                    equalsConfig(actual[0], config)
                    equalsConfig(actual[1], config)
                })
        })

        it("throws an error if the config thread input isn't the current input", () => {
            new ScriptContextBuilder()
                .addConfigThread({ config })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    throws(() => {
                        find_config_thread.eval({
                            $currentScript: "config_validator",
                            $scriptContext: ctx
                        })
                    })
                })
        })
    })

    describe("for the other validators", () => {
        const otherScripts = scripts.filter((s) => s != "config_validator")

        it("returns the config data twice if the config UTxO datum remains unchanged when spent and returned", () => {
            new ScriptContextBuilder()
                .addConfigThread({ config })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    otherScripts.forEach((currentScript) => {
                        const actual = find_config_thread.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })

                        equalsConfig(actual[0], config)
                        equalsConfig(actual[1], config)
                    })
                })
        })
    })
})

describe("ConfigModule::Config::get_benchmark_price", () => {
    const benchmark = contract.benchmark_delegate.$hash
    const config = makeConfig({
        successFee: makeSuccessFee(),
        benchmark
    })
    const price: RatioType = [100n, 1n]

    describe("implicit benchmark hash taken from config", () => {
        it("returns the input value if the benchmark is ADA itself (i.e. 1/1)", () => {
            new ScriptContextBuilder()
                .observeBenchmark({ redeemer: [1, 1] })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    deepEqual(
                        get_benchmark_price.eval({
                            self: config,
                            $scriptContext: ctx,
                            lovelace_price: price
                        }),
                        price
                    )
                })
        })

        it("returns a ratio with denominator 0 if the benchmark price denominator is 0", () => {
            new ScriptContextBuilder()
                .observeBenchmark({ redeemer: [1, 0] })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    deepEqual(
                        get_benchmark_price.eval({
                            self: config,
                            $scriptContext: ctx,
                            lovelace_price: price
                        }),
                        [100n, 0n]
                    )
                })
        })
    })

    describe("explicitly specified benchmark hash", () => {
        it("returns the input value if the benchmark is ADA", () => {
            new ScriptContextBuilder()
                .observeBenchmark({ redeemer: [1, 1] })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    deepEqual(
                        get_benchmark_price.eval({
                            self: config,
                            $scriptContext: ctx,
                            lovelace_price: price,
                            benchmark
                        }),
                        price
                    )
                })
        })

        it("throws an error when explicitly specifying a benchmark hash that differs from the benchmark delegate observing the tx", () => {
            new ScriptContextBuilder()
                .observeBenchmark({ redeemer: [1, 1] })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    throws(() => {
                        get_benchmark_price.eval({
                            self: config,
                            $scriptContext: ctx,
                            lovelace_price: price,
                            benchmark: StakingValidatorHash.dummy()
                        })
                    })
                })
        })
    })
})

describe("ConfigModule::deduct_burn_fee", () => {
    const config = makeConfig({
        burnFee: {
            relative: 0.005,
            minimum: 20_000
        }
    })

    describe("for the burn_order_validator (which is the only relevant validator, as deduct_burn_fee() isn't called in other validators)", () => {
        it("deducts the mininum burn fee if a small number of tokens is burned and the config UTxO is correctly referenced", () => {
            new ScriptContextBuilder().addConfigRef({ config }).use((ctx) => {
                strictEqual(
                    deduct_burn_fee.eval({
                        $scriptContext: ctx,
                        $currentScript: "burn_order_validator",
                        n: 2_000_000
                    }),
                    1_980_000n
                )
            })
        })

        it("deducts the relative burn fee if a large number of tokens is burned and the config UTxO is correctly referenced", () => {
            new ScriptContextBuilder().addConfigRef({ config }).use((ctx) => {
                strictEqual(
                    deduct_burn_fee.eval({
                        $scriptContext: ctx,
                        $currentScript: "burn_order_validator",
                        n: 20_000_000
                    }),
                    19_900_000n
                )
            })
        })

        it("throws an error if the config UTxO is spent instead of referenced", () => {
            new ScriptContextBuilder().addConfigInput({ config }).use((ctx) => {
                throws(() => {
                    deduct_burn_fee.eval({
                        $scriptContext: ctx,
                        $currentScript: "burn_order_validator",
                        n: 2_000_000
                    })
                })
            })
        })
    })
})

describe("ConfigModule::deduct_mint_fee", () => {
    const config = makeConfig({
        mintFee: {
            relative: 0.005,
            minimum: 20_000
        }
    })

    describe("for the mint_order_validator (which is the only relevant validator, as deduct_mint_fee() isn't called in other validators)", () => {
        it("deducts the mininum mint fee if a small number of tokens is minted and the config UTxO is correctly referenced", () => {
            new ScriptContextBuilder().addConfigRef({ config }).use((ctx) => {
                strictEqual(
                    deduct_mint_fee.eval({
                        $scriptContext: ctx,
                        $currentScript: "mint_order_validator",
                        n: 2_000_000
                    }),
                    1_980_000n
                )
            })
        })

        it("deducts the relative mint fee if a large number of tokens is minted and the config UTxO is correctly referenced", () => {
            new ScriptContextBuilder().addConfigRef({ config }).use((ctx) => {
                strictEqual(
                    deduct_mint_fee.eval({
                        $scriptContext: ctx,
                        $currentScript: "mint_order_validator",
                        n: 20_000_000
                    }),
                    19_900_000n
                )
            })
        })

        it("throws an error if the config UTxO is spent instead of referenced", () => {
            new ScriptContextBuilder().addConfigInput({ config }).use((ctx) => {
                throws(() => {
                    deduct_mint_fee.eval({
                        $scriptContext: ctx,
                        $currentScript: "mint_order_validator",
                        n: 2_000_000
                    })
                })
            })
        })
    })
})

describe("ConfigModule::price_expiry", () => {
    const config = makeConfig({
        token: {
            maxPriceAge: 100
        }
    })

    describe("for the config_validator", () => {
        it("returns a time before the tx validity time range end if the config UTxO is the current input", () => {
            new ScriptContextBuilder()
                .addConfigInput({ config, redeemer: new IntData(0) })
                .setTimeRange({ end: 200 })
                .use((ctx) => {
                    strictEqual(
                        price_expiry.eval({
                            $scriptContext: ctx,
                            $currentScript: "config_validator"
                        }),
                        100
                    )
                })
        })

        it("throws an error if the config UTxO isn't the current input", () => {
            new ScriptContextBuilder()
                .addConfigInput({ config })
                .redeemDummyTokenWithDvpPolicy()
                .setTimeRange({ end: 200 })
                .use((ctx) => {
                    throws(() => {
                        price_expiry.eval({
                            $scriptContext: ctx,
                            $currentScript: "config_validator"
                        })
                    })
                })
        })
    })

    describe("for the mint_order_validator and the burn_order_validator", () => {
        it("returns a time before the tx validity time range end if the config UTxO is correctly referenced", () => {
            new ScriptContextBuilder()
                .addConfigRef({ config })
                .setTimeRange({ end: 200 })
                .use((ctx) => {
                    orderValidatorScripts.forEach((currentScript) => {
                        strictEqual(
                            price_expiry.eval({
                                $scriptContext: ctx,
                                $currentScript: currentScript
                            }),
                            100
                        )
                    })
                })
        })

        it("throws an error if the config UTxO is spent instead of referenced", () => {
            new ScriptContextBuilder()
                .addConfigInput({ config })
                .setTimeRange({ end: 200 })
                .use((ctx) => {
                    orderValidatorScripts.forEach((currentScript) => {
                        throws(() => {
                            price_expiry.eval({
                                $scriptContext: ctx,
                                $currentScript: currentScript
                            })
                        })
                    })
                })
        })
    })

    describe("for the other validators", () => {
        const otherScripts = scripts.filter(
            (s) =>
                ![
                    "mint_order_validator",
                    "burn_order_validator",
                    "config_validator"
                ].includes(s)
        )

        it("returns a time before the tx validity time range end if the config UTxO is referenced", () => {
            new ScriptContextBuilder()
                .addConfigRef({ config })
                .redeemDummyTokenWithDvpPolicy()
                .setTimeRange({ end: 200 })
                .use((ctx) => {
                    otherScripts.forEach((currentScript) => {
                        strictEqual(
                            price_expiry.eval({
                                $scriptContext: ctx,
                                $currentScript: currentScript
                            }),
                            100
                        )
                    })
                })
        })

        it("returns a time before the tx validity time range end if the config UTxO is spent", () => {
            new ScriptContextBuilder()
                .addConfigInput({ config })
                .redeemDummyTokenWithDvpPolicy()
                .setTimeRange({ end: 200 })
                .use((ctx) => {
                    otherScripts.forEach((currentScript) => {
                        strictEqual(
                            price_expiry.eval({
                                $scriptContext: ctx,
                                $currentScript: currentScript
                            }),
                            100
                        )
                    })
                })
        })
    })
})

describe("ConfigModule::signed_by_agent", () => {
    const agent = PubKeyHash.dummy(0)
    const config = makeConfig({ agent })

    const configureParentContext = (props?: {
        config?: ConfigType
        signingAgent?: PubKeyHash
        referConfig?: boolean
    }) => {
        const scb = new ScriptContextBuilder()

        if (props?.referConfig) {
            scb.addConfigRef({
                config: props?.config ?? config
            }).redeemDummyTokenWithDvpPolicy()
        } else {
            scb.addConfigInput({
                config: props?.config ?? config,
                redeemer: new IntData(0)
            })
        }

        return scb.addSigner(props?.signingAgent ?? agent)
    }

    describe("@ config_validator", () => {
        const configureContext = withScripts(configureParentContext, [
            "config_validator"
        ])

        it("ConfigModule::signed_by_agent #01 (returns true if the config UTxO is the current input and the tx is signed by the agent)", () => {
            configureContext().use((currentScript, ctx) => {
                strictEqual(
                    signed_by_agent.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    }),
                    true
                )
            })
        })

        it("ConfigModule::signed_by_agent #02 (returns true if the config UTxO is the current input and the tx is signed by an explicitly specified agent)", () => {
            configureContext({ config: makeConfig() }).use(
                (currentScript, ctx) => {
                    strictEqual(
                        signed_by_agent.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            agent
                        }),
                        true
                    )
                }
            )
        })

        it("ConfigModule::signed_by_agent #03 (returns false if the config UTxO is the current input but the tx isn't signed by the agent)", () => {
            configureContext({ signingAgent: PubKeyHash.dummy(1) }).use(
                (currentScript, ctx) => {
                    strictEqual(
                        signed_by_agent.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }),
                        false
                    )
                }
            )
        })
    })

    describe("@ other validators", () => {
        const configureContext = withScripts(
            configureParentContext,
            scripts.filter((s) => s != "config_validator")
        )

        it("ConfigModule::signed_by_agent #04 (returns true if the config UTxO is referenced and the tx is signed by the agent)", () => {
            configureContext({ referConfig: true }).use(
                (currentScript, ctx) => {
                    strictEqual(
                        signed_by_agent.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }),
                        true
                    )
                }
            )
        })

        it("ConfigModule::signed_by_agent #05 (returns true if the config UTxO is referenced and the tx is signed by an explicitly specified agent)", () => {
            configureContext({ config: makeConfig(), referConfig: true }).use(
                (currentScript, ctx) => {
                    strictEqual(
                        signed_by_agent.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            agent
                        }),
                        true
                    )
                }
            )
        })

        it("ConfigModule::signed_by_agent #06 (returns false if the config UTxO referenced but the tx isn't signed by the agent)", () => {
            configureContext({
                referConfig: true,
                signingAgent: PubKeyHash.dummy(1)
            }).use((currentScript, ctx) => {
                strictEqual(
                    signed_by_agent.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    }),
                    false
                )
            })
        })
    })
})

describe("ConfigModule::witnessed_by_oracle", () => {
    const oracle = contract.oracle_delegate.$hash
    const config = makeConfig({ oracle })

    const configureParentContext = (props?: {
        config?: ConfigType | null
        oracle?: StakingValidatorHash | null
        reward?: StakingValidatorHash
        referConfig?: boolean
    }) => {
        const scb = new ScriptContextBuilder().observeDummy()

        if (props?.referConfig) {
            if (props?.config !== null) {
                scb.addConfigRef({ config: props?.config ?? config })
            }

            scb.redeemDummyTokenWithDvpPolicy()
        } else {
            if (props?.config !== null) {
                scb.addConfigInput({
                    config: props?.config ?? config,
                    redeemer: new IntData(0)
                })
            } else {
                scb.redeemDummyTokenWithDvpPolicy()
            }
        }

        if (props?.oracle !== null) {
            scb.observeOracle({ hash: oracle })
        }

        if (props?.reward) {
            scb.reward({
                hash: props.reward,
                redeemer: new IntData(0)
            })
        }

        return scb
    }

    describe("@ config_validator", () => {
        const configureContext = withScripts(configureParentContext, [
            "config_validator"
        ])

        it("ConfigModule::witnessed_by_oracle #01 (returns true if the config UTxO is the current input and the transaction is witnessed by the oracle_delegate)", () => {
            configureContext().use((currentScript, ctx) => {
                strictEqual(
                    witnessed_by_oracle.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    }),
                    true
                )
            })
        })

        it("ConfigModule::witnessed_by_oracle #02 (returns false if the config UTxO is the current input but the transaction isn't witnessed by the oracle_delegate)", () => {
            configureContext({
                oracle: null,
                reward: StakingValidatorHash.dummy(1)
            }).use((currentScript, ctx) => {
                strictEqual(
                    witnessed_by_oracle.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    }),
                    false
                )
            })
        })

        it("ConfigModule::witnessed_by_oracle #03 (returns true of the transaction is witnessed by an explicitly specified oracle, even if the config UTxO isn't the current input)", () => {
            configureContext({ config: null }).use((currentScript, ctx) => {
                strictEqual(
                    witnessed_by_oracle.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        oracle
                    }),
                    true
                )
            })
        })
    })

    describe("@ other validators", () => {
        const otherScripts = scripts.filter((s) => s != "config_validator")

        const configureContext = withScripts(
            configureParentContext,
            otherScripts
        )

        it("ConfigModule::witnessed_by_oracle #04 (returns true if the config UTxO is referenced and the transaction is witnessed by the oracle_delegate)", () => {
            configureContext({ referConfig: true }).use(
                (currentScript, ctx) => {
                    otherScripts.forEach((currentScript) => {
                        strictEqual(
                            witnessed_by_oracle.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            }),
                            true
                        )
                    })
                }
            )
        })

        it("ConfigModule::witnessed_by_oracle #05 (returns false if the config UTxO is referenced but the transaction isn't witnessed by the oracle_delegate)", () => {
            configureContext({ referConfig: true, oracle: null }).use(
                (currentScript, ctx) => {
                    strictEqual(
                        witnessed_by_oracle.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }),
                        false
                    )
                }
            )
        })

        it("ConfigModule::witnessed_by_oracle #06 (returns true if the transaction is witnessed by an explicitly specified oracle delegate, even if the config UTxO isn't referenced)", () => {
            configureContext({ config: null, referConfig: true }).use(
                (currentScript, ctx) => {
                    strictEqual(
                        witnessed_by_oracle.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            oracle
                        }),
                        true
                    )
                }
            )
        })
    })
})

describe("ConfigModule::witnessed_by_governance", () => {
    const governance = contract.governance_delegate.$hash
    const config = makeConfig({ governance: { delegate: governance } })

    describe("for the config_validator (which is the only relevant validator, as witnessed_by_governance() isn't called in other validators)", () => {
        it("returns true if the config UTxO is the current input and the transaction is witnessed by the governance_delegate", () => {
            new ScriptContextBuilder()
                .addConfigInput({ config, redeemer: new IntData(0) })
                .observeDummy() // dummy
                .observeGovernance({ hash: governance })
                .use((ctx) => {
                    strictEqual(
                        witnessed_by_governance.eval({
                            $currentScript: "config_validator",
                            $scriptContext: ctx
                        }),
                        true
                    )
                })
        })

        it("returns false if the config UTxO is the current input but the transaction isn't witnessed by the governance_delegate", () => {
            new ScriptContextBuilder()
                .addConfigInput({ config, redeemer: new IntData(0) })
                .observeDummy() // dummy
                .use((ctx) => {
                    strictEqual(
                        witnessed_by_governance.eval({
                            $currentScript: "config_validator",
                            $scriptContext: ctx
                        }),
                        false
                    )
                })
        })

        it("returns true of the transaction is witnessed by an explicitly specified governance delegate, even if the config UTxO isn't the current input", () => {
            new ScriptContextBuilder()
                .observeDummy() // dummy
                .observeGovernance({ hash: governance })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    strictEqual(
                        witnessed_by_governance.eval({
                            $currentScript: "config_validator",
                            $scriptContext: ctx,
                            governance
                        }),
                        true
                    )
                })
        })
    })
})
