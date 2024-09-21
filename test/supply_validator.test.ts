import { strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { IntLike } from "@helios-lang/codec-utils"
import {
    AssetClass,
    PubKeyHash,
    StakingValidatorHash,
    Value
} from "@helios-lang/ledger"
import context from "pbg-token-validators-test-context"
import {
    ConfigStateType,
    RatioType,
    SupplyType,
    makeAsset,
    makeAssetPtr,
    makeConfig,
    makePrice,
    makeReimbursement,
    makeSuccessFee,
    makeSupply,
    makeVoucher
} from "./data"
import {
    makeConfigToken,
    makeDvpTokens,
    makeReimbursementToken,
    makeVoucherPair
} from "./tokens"
import { ScriptContextBuilder } from "./tx"

const {
    validate_reward_success,
    validate_reward_management,
    validate_mint_user_tokens,
    validate_burn_user_tokens,
    validate_swap,
    main
} = context.supply_validator

describe("charge the success fee by diluting the token supply", () => {
    const startPrice: RatioType = [100, 1]
    const endPrice: RatioType = [140, 1]
    const periodDuration = 1000
    const periodId = 1
    const expectedDilution = 8108108108n
    const supply0 = makeSupply({
        startPrice,
        tick: 0,
        nTokens: 100_000_000_000,
        nLovelace: 14_000_000_000_000,
        nVouchers: 0,
        lastVoucherId: 0,
        successFee: {
            start_time: 0,
            period: periodDuration,
            periodId: periodId
        }
    })
    const configureSupply1 = (props?: {
        periodId?: IntLike
        periodDuration?: IntLike
        startTime?: IntLike
        nVouchers?: IntLike
        nLovelace?: IntLike
        nTokens?: IntLike
        startPrice?: RatioType
        tick?: IntLike
    }) => {
        return makeSupply({
            tick: props?.tick ?? 1,
            startPrice: props?.startPrice ?? endPrice,
            nTokens: props?.nTokens ?? 100_000_000_000n + expectedDilution,
            nLovelace: props?.nLovelace ?? 14_000_000_000_000n,
            lastVoucherId: 0,
            nVouchers: props?.nVouchers ?? 0,
            successFee: {
                start_time: props?.startTime ?? 0 + periodDuration,
                period: props?.periodDuration ?? periodDuration,
                periodId: props?.periodId ?? periodId + 1
            }
        })
    }

    const supply1 = configureSupply1()

    const configureContext = (props?: {
        newBenchmark?: StakingValidatorHash
        configState?: ConfigStateType
        spendConfig?: boolean
        dilution?: IntLike
        priceTimestamp?: IntLike
        nVouchersToBeReimbursed?: IntLike
        reimbursementStartPrice?: RatioType
        reimbursementEndPrice?: RatioType
        signingAgent?: PubKeyHash
        supply1?: SupplyType
    }) => {
        const price = makePrice({
            ratio: endPrice,
            timestamp: props?.priceTimestamp ?? 1000
        })
        const agent = PubKeyHash.dummy(12)
        const config0 = makeConfig({
            state: props?.configState ?? { Idle: {} },
            successFee: makeSuccessFee({
                c0: 0,
                steps: [{ c: 0.3, sigma: 1.05 }]
            }),
            token: {
                maxPriceAge: 100
            },
            agent
        })

        const reimbursement = makeReimbursement({
            nRemainingVouchers: props?.nVouchersToBeReimbursed ?? 0,
            startPrice: props?.reimbursementStartPrice ?? startPrice,
            endPrice: props?.reimbursementEndPrice ?? endPrice
        })
        const nMinted = props?.dilution ?? expectedDilution

        const scb = new ScriptContextBuilder()
            .addPriceRef({ price })
            .addSupplyThread({
                redeemer: [],
                inputSupply: supply0,
                outputSupply: props?.supply1 ?? supply1
            })
            .observeBenchmark({ redeemer: [1, 1] })
            .mint({ assets: makeReimbursementToken(periodId, 1) })
            .mint({ assets: makeDvpTokens(nMinted) })
            .setTimeRange({ start: 0, end: 1001 })
            .addReimbursementOutput({
                id: periodId,
                reimbursement,
                extraTokens: makeDvpTokens(nMinted)
            })
            .addSigner(props?.signingAgent ?? agent)

        if (props?.spendConfig) {
            const config1 = makeConfig({
                state: props?.configState ?? { Idle: {} },
                successFee: makeSuccessFee({
                    c0: 0,
                    steps: [{ c: 0.3, sigma: 1.05 }]
                }),
                token: {
                    maxPriceAge: 100
                },
                benchmark: props?.newBenchmark
            })
            scb.addConfigThread({
                inputConfig: config0,
                outputConfig: config1
            }).observeBenchmark({ redeemer: [2, 1], hash: props?.newBenchmark })
        } else {
            scb.addConfigRef({ config: config0 })
        }

        return scb
    }

    describe("supply_validator::validate_reward_success", () => {
        it("returns true of the config UTxO is referenced and precisely the expected dilution is minted", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_reward_success.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: expectedDilution
                    }),
                    true
                )
            })
        })

        it("returns false if too many DVP tokens are minted", () => {
            configureContext({ dilution: expectedDilution + 1n }).use((ctx) => {
                strictEqual(
                    validate_reward_success.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: expectedDilution + 1n
                    }),
                    false
                )
            })
        })

        it("returns false if too few DVP tokens are minted", () => {
            configureContext({ dilution: expectedDilution - 1n }).use((ctx) => {
                strictEqual(
                    validate_reward_success.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: expectedDilution - 1n
                    }),
                    false
                )
            })
        })

        it("returns false if the token price is too old", () => {
            configureContext({ priceTimestamp: 899 }).use((ctx) => {
                strictEqual(
                    validate_reward_success.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: expectedDilution
                    }),
                    false
                )
            })
        })

        it("returns false if the new start time is not set to the expected value", () => {
            const supply1 = configureSupply1({ startTime: 1001 })
            configureContext().use((ctx) => {
                strictEqual(
                    validate_reward_success.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: expectedDilution
                    }),
                    false
                )
            })
        })

        it("returns false if the new period id isn't incremented by 1", () => {
            const supply1 = configureSupply1({ periodId: periodId })
            configureContext().use((ctx) => {
                strictEqual(
                    validate_reward_success.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: expectedDilution
                    }),
                    false
                )
            })
        })

        it("returns false if the lovelace count in the new supply datum differs from that in the old supply datum", () => {
            const supply1 = configureSupply1({ nLovelace: 0 })
            configureContext().use((ctx) => {
                strictEqual(
                    validate_reward_success.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: expectedDilution
                    }),
                    false
                )
            })
        })

        it("returns false if the remaining vouchers count in the new reimbursement datum isn't copied from the old supply datum", () => {
            configureContext({ nVouchersToBeReimbursed: 10 }).use((ctx) => {
                strictEqual(
                    validate_reward_success.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: expectedDilution
                    }),
                    false
                )
            })
        })

        it("returns false if the start price in the new reimbursement datum isn't copied from the old supply datum", () => {
            configureContext({ reimbursementStartPrice: [101, 1] }).use(
                (ctx) => {
                    strictEqual(
                        validate_reward_success.eval({
                            $scriptContext: ctx,
                            supply0,
                            supply1,
                            D: expectedDilution
                        }),
                        false
                    )
                }
            )
        })

        it("returns false if the end price in the new reimbursement datum isn't the current price relative to the benchmark", () => {
            configureContext({ reimbursementEndPrice: [139, 1] }).use((ctx) => {
                strictEqual(
                    validate_reward_success.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: expectedDilution
                    }),
                    false
                )
            })
        })

        it("returns true if the config UTxO is spent and new supply start price is correctly set using the new benchmark", () => {
            const benchmark = StakingValidatorHash.dummy(12)
            const supply1 = configureSupply1({
                startPrice: [280, 1],
                periodDuration: 2000
            })

            configureContext({
                spendConfig: true,
                newBenchmark: benchmark,
                configState: {
                    Changing: {
                        proposal_timestamp: 0,
                        proposal: {
                            UpdatingSuccessFee: {
                                period: 2000,
                                benchmark,
                                fee: makeSuccessFee()
                            }
                        }
                    }
                }
            }).use((ctx) => {
                strictEqual(
                    validate_reward_success.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: expectedDilution
                    }),
                    true
                )
            })
        })

        it("returns false if the config UTxO is spent but the new supply success fee period duration isn't set correctly", () => {
            const benchmark = StakingValidatorHash.dummy(12)
            const supply1 = configureSupply1({
                startPrice: [280, 1],
                periodDuration: 2001
            })

            configureContext({
                spendConfig: true,
                newBenchmark: benchmark,
                configState: {
                    Changing: {
                        proposal_timestamp: 0,
                        proposal: {
                            UpdatingSuccessFee: {
                                period: 2000,
                                benchmark,
                                fee: makeSuccessFee()
                            }
                        }
                    }
                }
            }).use((ctx) => {
                strictEqual(
                    validate_reward_success.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: expectedDilution
                    }),
                    false
                )
            })
        })

        it("returns false if the config UTxO is spent but the new supply success start price isn't set correctly", () => {
            const benchmark = StakingValidatorHash.dummy(12)
            const supply1 = configureSupply1({
                startPrice: [281, 1],
                periodDuration: 2000
            })

            configureContext({
                spendConfig: true,
                newBenchmark: benchmark,
                configState: {
                    Changing: {
                        proposal_timestamp: 0,
                        proposal: {
                            UpdatingSuccessFee: {
                                period: 2000,
                                benchmark,
                                fee: makeSuccessFee()
                            }
                        }
                    }
                }
            }).use((ctx) => {
                strictEqual(
                    validate_reward_success.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: expectedDilution
                    }),
                    false
                )
            })
        })

        it("returns false if other tokens are minted", () => {
            configureContext()
                .mint({ assets: makeConfigToken() })
                .use((ctx) => {
                    strictEqual(
                        validate_reward_success.eval({
                            $scriptContext: ctx,
                            supply0,
                            supply1,
                            D: expectedDilution
                        }),
                        false
                    )
                })
        })

        it("returns false if the reimbursement token is minted more than once", () => {
            configureContext()
                .mint({ assets: makeReimbursementToken(periodId, 1) })
                .use((ctx) => {
                    strictEqual(
                        validate_reward_success.eval({
                            $scriptContext: ctx,
                            supply0,
                            supply1,
                            D: expectedDilution
                        }),
                        false
                    )
                })
        })

        it("returns true if the config datum is in Changing state, but not in UpdatingSuccessFee state", () => {
            configureContext({
                configState: {
                    Changing: {
                        proposal_timestamp: 0,
                        proposal: {
                            AddingAssetClass: {
                                asset_class: AssetClass.dummy()
                            }
                        }
                    }
                }
            }).use((ctx) => {
                strictEqual(
                    validate_reward_success.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: expectedDilution
                    }),
                    true
                )
            })
        })

        it("returns false if the config datum is in Changing::UpdatingSuccessFee state", () => {
            configureContext({
                configState: {
                    Changing: {
                        proposal_timestamp: 0,
                        proposal: {
                            UpdatingSuccessFee: {
                                fee: makeSuccessFee(),
                                benchmark: StakingValidatorHash.dummy(),
                                period: 1000
                            }
                        }
                    }
                }
            }).use((ctx) => {
                strictEqual(
                    validate_reward_success.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: expectedDilution
                    }),
                    false
                )
            })
        })

        it("returns false if something is spent from the vault", () => {
            configureContext()
                .takeFromVault()
                .use((ctx) => {
                    strictEqual(
                        validate_reward_success.eval({
                            $scriptContext: ctx,
                            supply0,
                            supply1,
                            D: expectedDilution
                        }),
                        false
                    )
                })
        })
    })

    describe("supply_validator::main", () => {
        it("succeeds if the config UTxO is referenced and precisely the expected dilution is minted", () => {
            configureContext().use((ctx) => {
                main.eval({
                    $scriptContext: ctx,
                    _: supply0,
                    ptrs: []
                })
            })
        })

        it("throws an error if not signed by the correct agent", () => {
            configureContext({ signingAgent: PubKeyHash.dummy(4) }).use(
                (ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            _: supply0,
                            ptrs: []
                        })
                    })
                }
            )
        })

        it("throws an error if tick in the supply datum hasn't increased by 1", () => {
            configureContext({ supply1: configureSupply1({ tick: 2 }) }).use(
                (ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            _: supply0,
                            ptrs: []
                        })
                    })
                }
            )
        })

        it("throws an error if the token count didn't increase by the number of minted tokens", () => {
            configureContext({ supply1: configureSupply1({ nTokens: 0 }) }).use(
                (ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            _: supply0,
                            ptrs: []
                        })
                    })
                }
            )
        })

        it("throws an error if the tx validity interval is large than 1 day", () => {
            configureContext()
                .setTimeRange({ start: 0, end: 25 * 60 * 60 * 1000 })
                .use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            _: supply0,
                            ptrs: []
                        })
                    })
                })
        })

        it("throws an error if the cycle hasn't been completed yet", () => {
            configureContext()
                .setTimeRange({ start: 0, end: 999 })
                .use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            _: supply0,
                            ptrs: []
                        })
                    })
                })
        })
    })
})

describe("charge the management fee by diluting the token supply", () => {
    const expectedDilution = Math.floor(
        100_000_000_000 * (0.0001 / (1 - 0.0001))
    )
    const supply0 = makeSupply({
        nTokens: 100_000_000_000,
        nLovelace: 14_000_000_000_000,
        nVouchers: 0,
        lastVoucherId: 0,
        tick: 0,
        managementFeeTimestamp: 49
    })
    const configureSupply1 = (props?: {
        tick?: IntLike
        periodId?: IntLike
        periodDuration?: IntLike
        startTime?: IntLike
        nVouchers?: IntLike
        nTokens?: IntLike
        lastVoucherId?: IntLike
        nLovelace?: IntLike
        startPrice?: RatioType
        successFeeStartTime?: IntLike
        managementFeeTimestamp?: number
    }) => {
        return makeSupply({
            tick: props?.tick ?? 1,
            nTokens: props?.nTokens ?? 100_000_000_000 + expectedDilution,
            nLovelace: props?.nLovelace ?? 14_000_000_000_000n,
            lastVoucherId: props?.lastVoucherId ?? 0,
            nVouchers: props?.nVouchers ?? 0,
            managementFeeTimestamp: props?.managementFeeTimestamp ?? 200,
            successFee: {
                start_time: props?.successFeeStartTime
            }
        })
    }

    const supply1 = configureSupply1()

    const configureContext = (props?: {
        supply1?: SupplyType
        timeOffset?: number
        signingAgent?: PubKeyHash
    }) => {
        const agent = PubKeyHash.dummy(12)
        const config = makeConfig({
            relManagementFee: 0.0001,
            managementFeePeriod: 50,
            agent
        })
        const timeOffset = props?.timeOffset ?? 0

        return new ScriptContextBuilder()
            .addConfigRef({ config })
            .addSigner(props?.signingAgent ?? agent)
            .addSupplyThread({
                inputSupply: supply0,
                outputSupply: props?.supply1 ?? supply1,
                redeemer: []
            })
            .mint({ assets: makeDvpTokens(expectedDilution) })
            .setTimeRange({ start: 100 + timeOffset, end: 200 + timeOffset })
    }

    describe("supply_validator::validate_reward_management", () => {
        it("returns true if the not precisely the allowed amount is minted", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_reward_management.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: expectedDilution
                    }),
                    true
                )
            })
        })

        it("returns false if more than the allowed amount is minted", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_reward_management.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: expectedDilution + 1
                    }),
                    false
                )
            })
        })

        it("returns true if less than the allowed amount is minted", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_reward_management.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: expectedDilution - 1
                    }),
                    true
                )
            })
        })

        it("returns false if the minted amount is negative", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_reward_management.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: -1
                    }),
                    false
                )
            })
        })

        it("returns false if the management fee period hasn't yet passed (i.e. it's still too soon)", () => {
            configureContext({ timeOffset: -10 }).use((ctx) => {
                strictEqual(
                    validate_reward_management.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: expectedDilution
                    }),
                    false
                )
            })
        })

        it("returns false if the management fee timestamp in the supply output datum isn't after the end of the current tx validity time-range", () => {
            const supply1 = configureSupply1({ managementFeeTimestamp: 199 })
            configureContext().use((ctx) => {
                strictEqual(
                    validate_reward_management.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: expectedDilution
                    }),
                    false
                )
            })
        })

        it("returns false if the management fee timestamp is too far into the future", () => {
            const supply1 = configureSupply1({ managementFeeTimestamp: 251 })
            configureContext().use((ctx) => {
                strictEqual(
                    validate_reward_management.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: expectedDilution
                    }),
                    false
                )
            })
        })

        it("returns false if the voucher count in the supply datum  changed", () => {
            const supply1 = configureSupply1({ nVouchers: 1 })
            configureContext().use((ctx) => {
                strictEqual(
                    validate_reward_management.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: expectedDilution
                    }),
                    false
                )
            })
        })

        it("returns false if the last voucher id in the supply datum changed", () => {
            const supply1 = configureSupply1({ lastVoucherId: 1 })
            configureContext().use((ctx) => {
                strictEqual(
                    validate_reward_management.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: expectedDilution
                    }),
                    false
                )
            })
        })

        it("returns false if the lovelace countin the supply datum changed", () => {
            const supply1 = configureSupply1({ nLovelace: 0 })
            configureContext().use((ctx) => {
                strictEqual(
                    validate_reward_management.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: expectedDilution
                    }),
                    false
                )
            })
        })

        it("returns false if the success fee settings in the supply datum changed", () => {
            const supply1 = configureSupply1({ successFeeStartTime: 123 })
            configureContext().use((ctx) => {
                strictEqual(
                    validate_reward_management.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: expectedDilution
                    }),
                    false
                )
            })
        })

        it("returns false if other tokens are minted", () => {
            configureContext()
                .mint({ assets: makeVoucherPair(1) })
                .use((ctx) => {
                    strictEqual(
                        validate_reward_management.eval({
                            $scriptContext: ctx,
                            supply0,
                            supply1,
                            D: expectedDilution
                        }),
                        false
                    )
                })
        })

        it("returns false if something is spent from the vault", () => {
            configureContext()
                .takeFromVault()
                .use((ctx) => {
                    strictEqual(
                        validate_reward_management.eval({
                            $scriptContext: ctx,
                            supply0,
                            supply1,
                            D: expectedDilution
                        }),
                        false
                    )
                })
        })
    })

    describe("supply_validator::main", () => {
        it("succeeds if the not precisely the allowed amount is minted", () => {
            configureContext().use((ctx) => {
                main.eval({
                    $scriptContext: ctx,
                    _: supply0,
                    ptrs: []
                }),
                    true
            })
        })

        it("throws an error if signed by the wrong agent", () => {
            configureContext({ signingAgent: PubKeyHash.dummy(4) }).use(
                (ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            _: supply0,
                            ptrs: []
                        })
                    })
                }
            )
        })

        it("throws an error supply datum tick hasn't been incremented by 1", () => {
            const supply1 = configureSupply1({ tick: 0 })
            configureContext({ supply1 }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        _: supply0,
                        ptrs: []
                    })
                })
            })
        })

        it("throws an error if the token count in the supply datum hasn't been updated correclty", () => {
            const supply1 = configureSupply1({ nTokens: 0 })
            configureContext({ supply1 }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        _: supply0,
                        ptrs: []
                    })
                })
            })
        })

        it("throws an error tx validity interval is larger than 1 day", () => {
            configureContext({ supply1 })
                .setTimeRange({ start: 100, end: 25 * 60 * 60 * 1000 })
                .use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            _: supply0,
                            ptrs: []
                        })
                    })
                })
        })


        it("throws an error if the management fee timestamp didn't change", () => {
            const supply1 = configureSupply1({managementFeeTimestamp: 49})
            configureContext({supply1})
                .use(ctx => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            _: supply0,
                            ptrs: []
                        })     
                    })
                })
        })
    })
})

describe("supply_validator::validate_mint_user_tokens", () => {
    describe("send pure lovelace the vault, one voucher minted", () => {
        const lastVoucherId = 0
        const supply0 = makeSupply({
            lastVoucherId,
            tick: 0,
            startPrice: [90, 1],
            nLovelace: 0,
            nTokens: 0,
            nVouchers: 0
        })
        const mintedTokens = 1_000_000

        const configureSupply1 = (props?: {
            lastVoucherId?: IntLike
            nVouchers?: IntLike
            managementFeeTimestamp?: number
            successFeeStartTime?: IntLike
        }) => {
            return makeSupply({
                lastVoucherId: props?.lastVoucherId ?? lastVoucherId + 1,
                tick: 1,
                nLovelace: 100_000_000,
                startPrice: [90, 1],
                nTokens: mintedTokens,
                nVouchers: props?.nVouchers ?? 1,
                managementFeeTimestamp: props?.managementFeeTimestamp,
                successFee: {
                    start_time: props?.successFeeStartTime
                }
            })
        }

        const supply1 = configureSupply1()

        const configureContext = (props?: {
            priceTimestamp?: number
            lovelaceToVault?: IntLike
            maxTokenSupply?: IntLike
        }) => {
            const price = makePrice({
                ratio: [100, 1],
                timestamp: props?.priceTimestamp ?? 90
            })
            const config = makeConfig({
                token: {
                    maxPriceAge: 50,
                    maxSupply: props?.maxTokenSupply ?? 100_000_000_000
                }
            })

            const voucherId = 1
            const voucher = makeVoucher({
                tokens: mintedTokens
            })

            return new ScriptContextBuilder()
                .addPriceRef({ price })
                .observeBenchmark({ redeemer: [1, 1] })
                .setTimeRange({ end: 100 })
                .addConfigRef({ config })
                .mint({ assets: makeDvpTokens(mintedTokens) })
                .mint({ assets: makeVoucherPair(voucherId) })
                .addVoucherOutput({ id: voucherId, voucher })
                .sendToVault({
                    value: new Value(props?.lovelaceToVault ?? 100_000_000)
                })
                .addSupplyInput({ supply: supply0, redeemer: [] })
        }

        it("succeeds if an equivalent amount of lovelace is sent to the vault as has been minted", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_mint_user_tokens.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: mintedTokens,
                        ptrs: [makeAssetPtr()] // dummy needed for ADA
                    }),
                    true
                )
            })
        })

        it("returns false if the price is too old", () => {
            configureContext({ priceTimestamp: 49 }).use((ctx) => {
                strictEqual(
                    validate_mint_user_tokens.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: mintedTokens,
                        ptrs: [makeAssetPtr()] // dummy needed for ADA
                    }),
                    false
                )
            })
        })

        it("returns false if too little value is sent to vault", () => {
            configureContext({ lovelaceToVault: 99_000_000 }).use((ctx) => {
                strictEqual(
                    validate_mint_user_tokens.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: mintedTokens,
                        ptrs: [makeAssetPtr()] // dummy needed for ADA
                    }),
                    false
                )
            })
        })

        it("returns false if the max token supply is exceeded", () => {
            configureContext({ maxTokenSupply: 999_999 }).use((ctx) => {
                strictEqual(
                    validate_mint_user_tokens.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: mintedTokens,
                        ptrs: [makeAssetPtr()] // dummy needed for ADA
                    }),
                    false
                )
            })
        })

        it("returns false if the voucher count didn't change", () => {
            const supply1 = configureSupply1({ nVouchers: 0 })
            configureContext().use((ctx) => {
                strictEqual(
                    validate_mint_user_tokens.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: mintedTokens,
                        ptrs: [makeAssetPtr()] // dummy needed for ADA
                    }),
                    false
                )
            })
        })

        it("returns false if the last voucher id didn't change", () => {
            const supply1 = configureSupply1({ lastVoucherId: 0 })
            configureContext().use((ctx) => {
                strictEqual(
                    validate_mint_user_tokens.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: mintedTokens,
                        ptrs: [makeAssetPtr()] // dummy needed for ADA
                    }),
                    false
                )
            })
        })

        it("returns false if the management fee timestamp changed", () => {
            const supply1 = configureSupply1({ managementFeeTimestamp: 123 })
            configureContext().use((ctx) => {
                strictEqual(
                    validate_mint_user_tokens.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: mintedTokens,
                        ptrs: [makeAssetPtr()] // dummy needed for ADA
                    }),
                    false
                )
            })
        })

        it("returns false if the success fee settings changed", () => {
            const supply1 = configureSupply1({ successFeeStartTime: 123 })
            configureContext().use((ctx) => {
                strictEqual(
                    validate_mint_user_tokens.eval({
                        $scriptContext: ctx,
                        supply0,
                        supply1,
                        D: mintedTokens,
                        ptrs: [makeAssetPtr()] // dummy needed for ADA
                    }),
                    false
                )
            })
        })

        it("returns true if the tx includes an asset group without any changes except the count tick", () => {
            configureContext()
                .addAssetGroupThread({
                    id: 0,
                    inputAssets: [makeAsset()],
                    outputAssets: [makeAsset({ count: 0, countTick: 1 })]
                })
                .use((ctx) => {
                    strictEqual(
                        validate_mint_user_tokens.eval({
                            $scriptContext: ctx,
                            supply0,
                            supply1,
                            D: mintedTokens,
                            ptrs: [makeAssetPtr()] // dummy needed for ADA
                        }),
                        true
                    )
                })
        })

        it("returns false if the tx includes an asset group with a count change", () => {
            configureContext()
                .addAssetGroupThread({
                    id: 0,
                    inputAssets: [makeAsset()],
                    outputAssets: [makeAsset({ count: 10, countTick: 1 })]
                })
                .use((ctx) => {
                    strictEqual(
                        validate_mint_user_tokens.eval({
                            $scriptContext: ctx,
                            supply0,
                            supply1,
                            D: mintedTokens,
                            ptrs: [makeAssetPtr()] // dummy needed for ADA
                        }),
                        false
                    )
                })
        })

        it("throws an error if the updated asset group doesn't have the correct tick", () => {
            configureContext()
                .addAssetGroupThread({
                    id: 0,
                    inputAssets: [makeAsset()],
                    outputAssets: [makeAsset({ countTick: 2 })]
                })
                .use((ctx) => {
                    throws(() => {
                        validate_mint_user_tokens.eval({
                            $scriptContext: ctx,
                            supply0,
                            supply1,
                            D: mintedTokens,
                            ptrs: [makeAssetPtr()] // dummy needed for ADA
                        })
                    })
                })
        })
    })
})

describe("supply_validator::validate_burn_user_tokens", () => {
    describe("takes pure lovelace from vault, one voucher burned", () => {
        const lastVoucherId = 1
        const burnedTokens = 1_000_000
        const supply0 = makeSupply({
            lastVoucherId,
            tick: 0,
            startPrice: [100, 1],
            nLovelace: 100_000_000,
            nTokens: burnedTokens,
            nVouchers: 1
        })

        const configureSupply1 = (props?: {
            lastVoucherId?: IntLike
            nVouchers?: IntLike
            managementFeeTimestamp?: number
            successFeeStartTime?: IntLike
        }) => {
            return makeSupply({
                lastVoucherId: props?.lastVoucherId ?? lastVoucherId,
                tick: 1,
                nLovelace: 0,
                startPrice: [100, 1],
                nTokens: 0,
                nVouchers: props?.nVouchers ?? 0,
                managementFeeTimestamp: props?.managementFeeTimestamp,
                successFee: {
                    start_time: props?.successFeeStartTime
                }
            })
        }

        const supply1 = configureSupply1()

        const configureContext = (props?: {
            priceTimestamp?: number
            lovelaceFromVault?: IntLike
            maxTokenSupply?: IntLike
        }) => {
            const price = makePrice({
                ratio: [100, 1],
                timestamp: props?.priceTimestamp ?? 90
            })
            const config = makeConfig({
                token: {
                    maxPriceAge: 50,
                    maxSupply: props?.maxTokenSupply ?? 100_000_000_000
                }
            })

            const voucherId = 1
            const voucher = makeVoucher({
                tokens: burnedTokens
            })

            return new ScriptContextBuilder()
                .addPriceRef({ price })
                .setTimeRange({ end: 100 })
                .addConfigRef({ config })
                .mint({ assets: makeDvpTokens(-burnedTokens) })
                .mint({ assets: makeVoucherPair(voucherId, -1) })
                .addVoucherInput({ id: voucherId, voucher })
                .takeFromVault({
                    value: new Value(props?.lovelaceFromVault ?? 100_000_000)
                })
                .addSupplyInput({ supply: supply0, redeemer: [] })
        }

        const defaultTestArgs = {
            supply0,
            supply1,
            D: -burnedTokens,
            ptrs: [makeAssetPtr()] // dummy for lovelace
        }

        it("returns true if the lovelace value taken taken out of the vault is equivalent to the tokens burned", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_burn_user_tokens.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    }),
                    true
                )
            })
        })

        it("returns false if the price is expired", () => {
            configureContext({ priceTimestamp: 49 }).use((ctx) => {
                strictEqual(
                    validate_burn_user_tokens.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    }),
                    false
                )
            })
        })

        it("returns false if more lovelace is taken from vault", () => {
            configureContext({ lovelaceFromVault: 100_000_001 }).use((ctx) => {
                strictEqual(
                    validate_burn_user_tokens.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    }),
                    false
                )
            })
        })

        it("returns false if the voucher count in the supply datum didn't decrease by 1", () => {
            const supply1 = configureSupply1({ nVouchers: 1 })

            configureContext().use((ctx) => {
                strictEqual(
                    validate_burn_user_tokens.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    }),
                    false
                )
            })
        })

        it("returns false if the last voucher id in the supply datum changed", () => {
            const supply1 = configureSupply1({ lastVoucherId: 0 })
            configureContext().use((ctx) => {
                strictEqual(
                    validate_burn_user_tokens.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    }),
                    false
                )
            })
        })

        it("returns false if the management fee timestamp changed", () => {
            const supply1 = configureSupply1({ managementFeeTimestamp: 123 })
            configureContext().use((ctx) => {
                strictEqual(
                    validate_burn_user_tokens.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    }),
                    false
                )
            })
        })

        it("returns false if the success fee settings changed", () => {
            const supply1 = configureSupply1({ successFeeStartTime: 123 })
            configureContext().use((ctx) => {
                strictEqual(
                    validate_burn_user_tokens.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    }),
                    false
                )
            })
        })

        it("returns true if the tx includes an asset group without any changes except the count tick", () => {
            configureContext()
                .addAssetGroupThread({
                    id: 0,
                    inputAssets: [makeAsset()],
                    outputAssets: [makeAsset({ count: 0, countTick: 1 })]
                })
                .use((ctx) => {
                    strictEqual(
                        validate_burn_user_tokens.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        }),
                        true
                    )
                })
        })

        it("returns false if the tx includes an asset group with a count change", () => {
            configureContext()
                .addAssetGroupThread({
                    id: 0,
                    inputAssets: [makeAsset()],
                    outputAssets: [makeAsset({ count: 10, countTick: 1 })]
                })
                .use((ctx) => {
                    strictEqual(
                        validate_burn_user_tokens.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        }),
                        false
                    )
                })
        })

        it("throws an error if the updated asset group doesn't have the correct tick", () => {
            configureContext()
                .addAssetGroupThread({
                    id: 0,
                    inputAssets: [makeAsset()],
                    outputAssets: [makeAsset({ countTick: 2 })]
                })
                .use((ctx) => {
                    throws(() => {
                        validate_burn_user_tokens.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        })
                    })
                })
        })
    })
})

describe("supply_validate::validate_swap", () => {
    describe("lovelace sent to vault", () => {
        const supply0 = makeSupply({
            nLovelace: 100_000_000,
            nVouchers: 0,
            lastVoucherId: 0
        })
        const configureSupply1 = (props?: {
            lastVoucherId?: IntLike
            nVouchers?: IntLike
            managementFeeTimestamp?: number
            successFeeStartTime?: IntLike
        }) => {
            return makeSupply({
                tick: 1,
                nLovelace: 200_000_000,
                nVouchers: props?.nVouchers ?? 0,
                lastVoucherId: props?.lastVoucherId ?? 0,
                managementFeeTimestamp: props?.managementFeeTimestamp,
                successFee: {
                    start_time: props?.successFeeStartTime
                }
            })
        }

        const supply1 = configureSupply1()

        const configureContext = () => {
            const config = makeConfig()

            return new ScriptContextBuilder()
                .addConfigRef({ config })
                .setTimeRange({ end: 100 })
                .sendToVault({ value: new Value(100_000_000) })
                .addSupplyInput({ supply: supply0, redeemer: [] })
        }
        const defaultTestArgs = {
            supply0,
            supply1,
            ptrs: [makeAssetPtr()] // dummy for lovelace
        }

        it("returns true if nothing is minted and the supply datum is correctly updated", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    validate_swap.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    }),
                    true
                )
            })
        })

        it("returns false if more is taken from vault", () => {
            configureContext()
                .takeFromVault({ value: new Value(100_000_001) })
                .use((ctx) => {
                    strictEqual(
                        validate_swap.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        }),
                        false
                    )
                })
        })

        it("returns false if the voucher count in the supply datum changed", () => {
            const supply1 = configureSupply1({ nVouchers: 123 })
            configureContext().use((ctx) => {
                strictEqual(
                    validate_swap.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    }),
                    false
                )
            })
        })

        it("returns false if the management fee timestamp in the supply datum changed", () => {
            const supply1 = configureSupply1({ managementFeeTimestamp: 123 })
            configureContext().use((ctx) => {
                strictEqual(
                    validate_swap.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    }),
                    false
                )
            })
        })

        it("returns false if the success fee settings in the supply datum changed", () => {
            const supply1 = configureSupply1({ successFeeStartTime: 123 })
            configureContext().use((ctx) => {
                strictEqual(
                    validate_swap.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    }),
                    false
                )
            })
        })

        it("returns false if a token is minted with the fund policy", () => {
            configureContext()
                .mint({ assets: makeConfigToken(1) })
                .use((ctx) => {
                    strictEqual(
                        validate_swap.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs,
                            supply1
                        }),
                        false
                    )
                })
        })

        it("returns false if a token is burned with the fund policy", () => {
            configureContext()
                .mint({ assets: makeConfigToken(-1) })
                .use((ctx) => {
                    strictEqual(
                        validate_swap.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs,
                            supply1
                        }),
                        false
                    )
                })
        })

        it("returns true if the tx includes an asset group without any changes except the count tick", () => {
            configureContext()
                .addAssetGroupThread({
                    id: 0,
                    inputAssets: [makeAsset()],
                    outputAssets: [makeAsset({ count: 0, countTick: 1 })]
                })
                .use((ctx) => {
                    strictEqual(
                        validate_swap.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        }),
                        true
                    )
                })
        })

        it("returns false if the tx includes an asset group with a count change", () => {
            configureContext()
                .addAssetGroupThread({
                    id: 0,
                    inputAssets: [makeAsset()],
                    outputAssets: [makeAsset({ count: 10, countTick: 1 })]
                })
                .use((ctx) => {
                    strictEqual(
                        validate_swap.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        }),
                        false
                    )
                })
        })

        it("throws an error if the updated asset group doesn't have the correct tick", () => {
            configureContext()
                .addAssetGroupThread({
                    id: 0,
                    inputAssets: [makeAsset()],
                    outputAssets: [makeAsset({ countTick: 2 })]
                })
                .use((ctx) => {
                    throws(() => {
                        validate_swap.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        })
                    })
                })
        })
    })
})
