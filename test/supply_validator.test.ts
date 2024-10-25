import { strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { IntLike } from "@helios-lang/codec-utils"
import {
    AssetClass,
    PubKeyHash,
    StakingValidatorHash,
    Value
} from "@helios-lang/ledger"
import contract from "pbg-token-validators-test-context"
import { MAX_SCRIPT_SIZE } from "./constants"
import {
    ConfigStateType,
    RatioType,
    SuccessFeeType,
    SupplyType,
    makeAsset,
    makeAssetPtr,
    makeConfig,
    makePrice,
    makeExtractingReimbursement,
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
} = contract.supply_validator

describe("charge the success fee by diluting the token supply", () => {
    const startPrice: RatioType = [100, 1]
    const endPrice: RatioType = [140, 1]
    const periodDuration = 1000
    const periodId = 1
    const expectedDilution = 8108108108n
    const lastVoucherId = 0
    const supply0 = makeSupply({
        startPrice,
        tick: 0,
        nTokens: 100_000_000_000,
        nLovelace: 14_000_000_000_000,
        nVouchers: 0,
        lastVoucherId,
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
        lastVoucherId?: IntLike
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
            lastVoucherId: props?.lastVoucherId ?? lastVoucherId,
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
        reimbursementPeriodId?: IntLike
        signingAgent?: PubKeyHash
        supply1?: SupplyType
    }) => {
        const price = makePrice({
            ratio: endPrice,
            timestamp: props?.priceTimestamp ?? 1000
        })
        const agent = PubKeyHash.dummy(12)
        const successFee = makeSuccessFee({
            c0: 0,
            steps: [{ c: 0.3, sigma: 1.05 }]
        })
        const config0 = makeConfig({
            state: props?.configState ?? { Idle: {} },
            successFee,
            token: {
                maxPriceAge: 100
            },
            agent
        })

        const reimbursement = makeExtractingReimbursement({
            nRemainingVouchers: props?.nVouchersToBeReimbursed ?? 0,
            startPrice: props?.reimbursementStartPrice ?? startPrice,
            endPrice: props?.reimbursementEndPrice ?? endPrice,
            successFee: successFee
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
            .mint({ assets: makeReimbursementToken(periodId + 1, 1) })
            .mint({ assets: makeDvpTokens(nMinted) })
            .setTimeRange({ start: 0, end: 1001 })
            .addReimbursementInput({
                id: props?.reimbursementPeriodId ?? periodId,
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
        const defaultTestArgs = {
            supply0,
            supply1,
            D: expectedDilution
        }

        it("supply_validator::validate_reward_success #01 (succeeds of the config UTxO is referenced and precisely the expected dilution is minted)", () => {
            configureContext().use((ctx) => {
                validate_reward_success.eval({
                    $scriptContext: ctx,
                    ...defaultTestArgs
                })
            })
        })

        it("supply_validator::validate_reward_success #02 (throws an error if too many DVP tokens are minted)", () => {
            configureContext({ dilution: expectedDilution + 1n }).use((ctx) => {
                throws(() => {
                    validate_reward_success.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        D: expectedDilution + 1n
                    })
                }, /incorrect number of tokens minted/)
            })
        })

        it("supply_validator::validate_reward_success #03 (throws an error if too few DVP tokens are minted)", () => {
            configureContext({ dilution: expectedDilution - 1n }).use((ctx) => {
                throws(() => {
                    validate_reward_success.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        D: expectedDilution - 1n
                    })
                }, /incorrect number of tokens minted/)
            })
        })

        it("supply_validator::validate_reward_success #04 (throws an error if the token price is too old)", () => {
            configureContext({ priceTimestamp: 899 }).use((ctx) => {
                throws(() => {
                    validate_reward_success.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })
                }, /price expired/)
            })
        })

        it("supply_validator::validate_reward_success #05 (throws an error if the new start time is not set to the expected value)", () => {
            const supply1 = configureSupply1({ startTime: 1001 })
            configureContext().use((ctx) => {
                throws(() => {
                    validate_reward_success.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    })
                }, /new success fee start time not set to correct value/)
            })
        })

        it("supply_validator::validate_reward_success #06 (throws an error if the new period id isn't incremented by 1)", () => {
            const supply1 = configureSupply1({ periodId: periodId })
            configureContext().use((ctx) => {
                throws(() => {
                    validate_reward_success.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    })
                }, /new success fee period id not set to correct value/)
            })
        })

        it("supply_validator::validate_reward_success #07 (throws an error if the lovelace count in the new supply datum differs from that in the old supply datum)", () => {
            const supply1 = configureSupply1({ nLovelace: 0 })
            configureContext().use((ctx) => {
                throws(() => {
                    validate_reward_success.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    })
                }, /n_lovelace count changed/)
            })
        })

        it("supply_validator::validate_reward_success #08 (succeeds even if the remaining vouchers count in the new reimbursement datum isn't copied from the old supply datum (validated by reimbursement validator))", () => {
            configureContext({ nVouchersToBeReimbursed: 10 }).use((ctx) => {
                strictEqual(
                    validate_reward_success.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    }),
                    undefined
                )
            })
        })

        it("supply_validator::validate_reward_success #09 (succeeds even if the start price in the new reimbursement datum isn't copied from the old supply datum (validated by reimbursement validator))", () => {
            configureContext({ reimbursementStartPrice: [101, 1] }).use(
                (ctx) => {
                    strictEqual(
                        validate_reward_success.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        }),
                        undefined
                    )
                }
            )
        })

        it("supply_validator::validate_reward_success #10 (succeeds even if the end price in the new reimbursement datum isn't the current price relative to the benchmark (validated by reimbursement validator))", () => {
            configureContext({ reimbursementEndPrice: [139, 1] }).use((ctx) => {
                strictEqual(
                    validate_reward_success.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    }),
                    undefined
                )
            })
        })

        it("supply_validator::validate_reward_success #11 (returns true if the config UTxO is spent and new supply start price is correctly set using the new benchmark)", () => {
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
                validate_reward_success.eval({
                    $scriptContext: ctx,
                    ...defaultTestArgs,
                    supply1
                })
            })
        })

        it("supply_validator::validate_reward_success #12 (throws an error if the config UTxO is spent but the new supply success fee period duration isn't set correctly)", () => {
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
                throws(() => {
                    validate_reward_success.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    })
                }, /period not updated correctly/)
            })
        })

        it("supply_validator::validate_reward_success #13 (throws an error if the config UTxO is spent but the new supply success start price isn't set correctly)", () => {
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
                throws(() => {
                    validate_reward_success.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    })
                }, /unexpected cycle start price/)
            })
        })

        it("supply_validator::validate_reward_success #14 (returns false if other tokens are minted)", () => {
            configureContext()
                .mint({ assets: makeConfigToken() })
                .use((ctx) => {
                    throws(() => {
                        validate_reward_success.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        })
                    }, /no other tokens can be minted\/burned/)
                })
        })

        it("supply_validator::validate_reward_success #15 (throws an error if we try to mint the current reimbursement token instead of the next)", () => {
            configureContext()
                .mint({
                    assets: makeReimbursementToken(periodId + 1, -1).add(
                        makeReimbursementToken(periodId, 1)
                    )
                })
                .use((ctx) => {
                    throws(() => {
                        validate_reward_success.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        })
                    }, /key not found/)
                })
        })

        it("supply_validator::validate_reward_success #16 (throws an error if the next reimbursement token is minted more than once)", () => {
            configureContext()
                .mint({ assets: makeReimbursementToken(periodId + 1, 1) })
                .use((ctx) => {
                    throws(() => {
                        validate_reward_success.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        })
                    }, /next reimbursement token not minted/)
                })
        })

        it("supply_validator::validate_reward_success #17 (succeeds if the config datum is in Changing state, but not in UpdatingSuccessFee state)", () => {
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
                validate_reward_success.eval({
                    $scriptContext: ctx,
                    ...defaultTestArgs
                })
            })
        })

        it("supply_validator::validate_reward_success #18 (throws an error if the config datum is in Changing::UpdatingSuccessFee state)", () => {
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
                throws(() => {
                    validate_reward_success.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })
                }, /config must be spent/)
            })
        })

        it("supply_validator::validate_reward_success #19 (throws an error if something is spent from the vault)", () => {
            configureContext()
                .takeFromVault()
                .use((ctx) => {
                    throws(() => {
                        validate_reward_success.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        })
                    }, /something spent from vault or assets validator/)
                })
        })

        it("supply_validator::validate_reward_success #20 (throws an error if not witnessed by the reimbursement validator)", () => {
            configureContext({
                reimbursementPeriodId: 999
            }).use((ctx) => {
                throws(() => {
                    validate_reward_success.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })
                }, /not witnessed by reimbursement validator/)
            })
        })

        it("supply_validator::validate_reward_success #21 (throws an error if the supply output last voucher id isn't equal to the supply input last voucher id)", () => {
            const supply1 = configureSupply1({ lastVoucherId: 123 })
            configureContext().use((ctx) => {
                throws(() => {
                    validate_reward_success.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    })
                }, /last voucher id must be persisted/)
            })
        })
    })

    describe("supply_validator::main", () => {
        const defaultTestArgs = {
            _: supply0,
            ptrs: { asset_group_output_ptrs: [], asset_input_ptrs: [] }
        }

        it("supply_validator::main #01 (succeeds if the config UTxO is referenced and precisely the expected dilution is minted)", () => {
            configureContext().use((ctx) => {
                main.eval({
                    $scriptContext: ctx,
                    ...defaultTestArgs
                })
            })
        })

        it("supply_validator::main #02 (throws an error if not signed by the correct agent)", () => {
            configureContext({ signingAgent: PubKeyHash.dummy(4) }).use(
                (ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        })
                    }, /not signed by agent/)
                }
            )
        })

        it("supply_validator::main #03 (throws an error if tick in the supply datum hasn't increased by 1)", () => {
            configureContext({ supply1: configureSupply1({ tick: 2 }) }).use(
                (ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        })
                    }, /tick not increment by 1/)
                }
            )
        })

        it("supply_validator::main #04 (throws an error if the token count didn't increase by the number of minted tokens)", () => {
            configureContext({ supply1: configureSupply1({ nTokens: 0 }) }).use(
                (ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        })
                    }, /token count not incremented by minted amount/)
                }
            )
        })

        it("supply_validator::main #05 (throws an error if the tx validity interval is large than 1 day)", () => {
            configureContext()
                .setTimeRange({ start: 0, end: 25 * 60 * 60 * 1000 })
                .use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        })
                    }, /validity time range too large/)
                })
        })

        it("supply_validator::main #06 (throws an error if the cycle hasn't been completed yet)", () => {
            configureContext()
                .setTimeRange({ start: 0, end: 999 })
                .use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        })
                    }, /empty list in headList/)
                })
        })

        it("supply_validator::main #07 (throws an error if the transaction isn't witnessed by the reimbursement validator)", () => {
            configureContext({
                reimbursementPeriodId: 999
            }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })
                }, /not witnessed by reimbursement validator/)
            })
        })

        it("supply_validator::main #08 (throws an error if the last voucher id isn't persisted", () => {
            const supply1 = configureSupply1({ lastVoucherId: 123 })
            configureContext({ supply1 }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })
                }, /last voucher id must be persisted/)
            })
        })
    })
})

describe("charge the management fee by diluting the token supply", () => {
    const expectedDilution = Math.floor(
        100_000_000_000 * (0.0001 / (1 - 0.0001))
    )
    const defaultManagementFeePeriod = 50
    const managementFeeTime0 = 49
    const managementFeeTime1 = managementFeeTime0 + defaultManagementFeePeriod

    const supply0 = makeSupply({
        nTokens: 100_000_000_000,
        nLovelace: 14_000_000_000_000,
        nVouchers: 0,
        lastVoucherId: 0,
        tick: 0,
        managementFeeTimestamp: managementFeeTime0
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
            managementFeeTimestamp:
                props?.managementFeeTimestamp ?? managementFeeTime1,
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
            managementFeePeriod: defaultManagementFeePeriod,
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
            .setTimeRange({ start: 100 + timeOffset, end: 120 + timeOffset })
    }

    describe("supply_validator::validate_reward_management", () => {
        const defaultTestArgs = {
            supply0,
            supply1,
            D: expectedDilution
        }

        it("supply_validator::validate_reward_management #01 (throws an error if precisely the allowed amount is minted)", () => {
            configureContext().use((ctx) => {
                validate_reward_management.eval({
                    $scriptContext: ctx,
                    ...defaultTestArgs
                })
            })
        })

        it("supply_validator::validate_reward_management #02 (throws an error if more than the allowed amount is minted)", () => {
            configureContext().use((ctx) => {
                throws(() => {
                    validate_reward_management.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        D: expectedDilution + 1
                    })
                }, /minted too many tokens/)
            })
        })

        it("supply_validator::validate_reward_management #03 (succeeds if less than the allowed amount is minted)", () => {
            configureContext().use((ctx) => {
                validate_reward_management.eval({
                    $scriptContext: ctx,
                    ...defaultTestArgs,
                    D: expectedDilution - 1
                })
            })
        })

        it("supply_validator::validate_reward_management #04 (throws an error if the minted amount is negative)", () => {
            configureContext().use((ctx) => {
                throws(() => {
                    validate_reward_management.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        D: -1
                    })
                }, /can't burn tokens/)
            })
        })

        it("supply_validator::validate_reward_management #05 (throws an error if the previous management fee time isn't before the start of the tx validity time-range)", () => {
            configureContext({ timeOffset: -51 }).use((ctx) => {
                throws(() => {
                    validate_reward_management.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })
                }, /previous management fee timestamp not in past/)
            })
        })

        it("supply_validator::validate_reward_management #06 (throws an error if the next management fee time isn't before the end of the tx validity time-range)", () => {
            configureContext({ timeOffset: -21 }).use((ctx) => {
                throws(() => {
                    validate_reward_management.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })
                }, /next management fee timestamp not before validity time range end/)
            })
        })

        it("supply_validator::validate_reward_management #07 (throws an error if the management fee timestamp is more than the management fee period ahead of the previous value)", () => {
            const supply1 = configureSupply1({
                managementFeeTimestamp: managementFeeTime1 + 1
            })
            configureContext().use((ctx) => {
                throws(() => {
                    validate_reward_management.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    })
                }, /management fee timestamp not updated correctly/)
            })
        })

        it("supply_validator::validate_reward_management #08 (throws an error if the management fee timestamp is less than the management fee period ahead of the previous value)", () => {
            const supply1 = configureSupply1({
                managementFeeTimestamp: managementFeeTime1 - 1
            })
            configureContext().use((ctx) => {
                throws(() => {
                    validate_reward_management.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    })
                }, /management fee timestamp not updated correctly/)
            })
        })

        it("supply_validator::validate_reward_management #09 (throws an error if the voucher count in the supply datum changed)", () => {
            const supply1 = configureSupply1({ nVouchers: 1 })
            configureContext().use((ctx) => {
                throws(() => {
                    validate_reward_management.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    })
                }, /n vouchers can't change/)
            })
        })

        it("supply_validator::validate_reward_management #10 (throws an error if the last voucher id in the supply datum changed)", () => {
            const supply1 = configureSupply1({ lastVoucherId: 1 })
            configureContext().use((ctx) => {
                throws(() => {
                    validate_reward_management.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    })
                }, /last voucher id can't change/)
            })
        })

        it("supply_validator::validate_reward_management #11 (throws an error if the lovelace countin the supply datum changed)", () => {
            const supply1 = configureSupply1({ nLovelace: 0 })
            configureContext().use((ctx) => {
                throws(() => {
                    validate_reward_management.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    })
                }, /vault lovelace count can't change/)
            })
        })

        it("supply_validator::validate_reward_management #12 (throws an error if the success fee settings in the supply datum changed)", () => {
            const supply1 = configureSupply1({ successFeeStartTime: 123 })
            configureContext().use((ctx) => {
                throws(() => {
                    validate_reward_management.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    })
                }, /success fee can't change/)
            })
        })

        it("supply_validator::validate_reward_management #13 (throws an error if other tokens are minted)", () => {
            configureContext()
                .mint({ assets: makeVoucherPair(1) })
                .use((ctx) => {
                    throws(() => {
                        validate_reward_management.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        })
                    }, /minted other tokens/)
                })
        })

        it("supply_validator::validate_reward_management #14 (throws an error if something is spent from the vault)", () => {
            configureContext()
                .takeFromVault()
                .use((ctx) => {
                    throws(() => {
                        validate_reward_management.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        })
                    }, /something spent from vault or assets validator/)
                })
        })
    })

    describe("supply_validator::main", () => {
        const defaultTestArgs = {
            _: supply0,
            ptrs: { asset_group_output_ptrs: [], asset_input_ptrs: [] }
        }

        it("supply_validator::main #09 (succeeds if the not precisely the allowed amount is minted)", () => {
            configureContext().use((ctx) => {
                main.eval({
                    $scriptContext: ctx,
                    ...defaultTestArgs
                })
            })
        })

        it("supply_validator::main #10 (throws an error if signed by the wrong agent)", () => {
            configureContext({ signingAgent: PubKeyHash.dummy(4) }).use(
                (ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        })
                    }, /not signed by agent/)
                }
            )
        })

        it("supply_validator::main #11 (throws an error supply datum tick hasn't been incremented by 1)", () => {
            const supply1 = configureSupply1({ tick: 0 })
            configureContext({ supply1 }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })
                }, /tick not increment by 1/)
            })
        })

        it("supply_validator::main #12 (throws an error if the token count in the supply datum hasn't been updated correclty)", () => {
            const supply1 = configureSupply1({ nTokens: 0 })
            configureContext({ supply1 }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })
                }, /token count not incremented by minted amount/)
            })
        })

        it("supply_validator::main #13 (throws an error tx validity interval is larger than 1 day)", () => {
            configureContext({ supply1 })
                .setTimeRange({ start: 100, end: 25 * 60 * 60 * 1000 })
                .use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        })
                    }, /validity time range too large/)
                })
        })

        it("supply_validator::main #14 (throws an error if the management fee timestamp didn't change)", () => {
            const supply1 = configureSupply1({ managementFeeTimestamp: 49 })
            configureContext({ supply1 }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })
                }, /management fee timestamp not updated correctly/)
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

        const defaultTestArgs = {
            supply0,
            supply1,
            D: mintedTokens,
            ptrs: {
                asset_input_ptrs: [makeAssetPtr()],
                asset_group_output_ptrs: []
            }
        }

        it("supply_validator::validate_mint_user_tokens #01 (succeeds if an equivalent amount of lovelace is sent to the vault as has been minted)", () => {
            configureContext().use((ctx) => {
                validate_mint_user_tokens.eval({
                    $scriptContext: ctx,
                    ...defaultTestArgs
                })
            })
        })

        it("supply_validator::validate_mint_user_tokens #02 (throws an error if the price is too old)", () => {
            configureContext({ priceTimestamp: 49 }).use((ctx) => {
                throws(() => {
                    validate_mint_user_tokens.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })
                }, /price expired/)
            })
        })

        it("supply_validator::validate_mint_user_tokens #03 (throws an error if too little value is sent to vault)", () => {
            configureContext({ lovelaceToVault: 99_000_000 }).use((ctx) => {
                throws(() => {
                    validate_mint_user_tokens.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })
                }, /too little value sent to vault/)
            })
        })

        it("supply_validator::validate_mint_user_tokens #04 (throws an error if the max token supply is exceeded)", () => {
            configureContext({ maxTokenSupply: 999_999 }).use((ctx) => {
                throws(() => {
                    validate_mint_user_tokens.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })
                }, /exceeding max supply/)
            })
        })

        it("supply_validator::validate_mint_user_tokens #05 (throws an error if the voucher count didn't change)", () => {
            const supply1 = configureSupply1({ nVouchers: 0 })
            configureContext().use((ctx) => {
                throws(() => {
                    validate_mint_user_tokens.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    })
                }, /unexpected new voucher count/)
            })
        })

        it("supply_validator::validate_mint_user_tokens #06 (throws an error if the last voucher id didn't change)", () => {
            const supply1 = configureSupply1({ lastVoucherId: 0 })
            configureContext().use((ctx) => {
                throws(() => {
                    validate_mint_user_tokens.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    })
                }, /unexpected last voucher id/)
            })
        })

        it("supply_validator::validate_mint_user_tokens #07 (throws an error if the management fee timestamp changed)", () => {
            const supply1 = configureSupply1({ managementFeeTimestamp: 123 })
            configureContext().use((ctx) => {
                throws(() => {
                    validate_mint_user_tokens.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    })
                }, /management fee timestamp changed/)
            })
        })

        it("supply_validator::validate_mint_user_tokens #08 (throws an error if the success fee settings changed)", () => {
            const supply1 = configureSupply1({ successFeeStartTime: 123 })
            configureContext().use((ctx) => {
                throws(() => {
                    validate_mint_user_tokens.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    })
                }, /success fee changed/)
            })
        })

        it("supply_validator::validate_mint_user_tokens #09 (succeeds if the tx includes an asset group without any changes except the count tick)", () => {
            configureContext()
                .addAssetGroupThread({
                    id: 0,
                    inputAssets: [makeAsset()],
                    outputAssets: [makeAsset({ count: 0 })]
                })
                .use((ctx) => {
                    validate_mint_user_tokens.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        ptrs: {
                            asset_input_ptrs: [makeAssetPtr()],
                            asset_group_output_ptrs: [2]
                        }
                    })
                })
        })

        it("supply_validator::validate_mint_user_tokens #10 (throws an error if the tx includes an asset group with a count change)", () => {
            configureContext()
                .addAssetGroupThread({
                    id: 0,
                    inputAssets: [makeAsset()],
                    outputAssets: [makeAsset({ count: 10 })]
                })
                .use((ctx) => {
                    throws(() => {
                        validate_mint_user_tokens.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs,
                            ptrs: {
                                asset_input_ptrs: [makeAssetPtr()],
                                asset_group_output_ptrs: [2]
                            }
                        })
                    }, /counters aren't consistent/)
                })
        })
    })
})

describe("supply_validator::validate_burn_user_tokens", () => {
    describe("takes pure lovelace from vault, one voucher burned", () => {
        const lastVoucherId = 1
        const periodId = 1
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
            periodId?: IntLike
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
                    start_time: props?.successFeeStartTime,
                    periodId: props?.periodId ?? 0
                }
            })
        }

        const supply1 = configureSupply1()

        const configureContext = (props?: {
            priceTimestamp?: number
            lovelaceFromVault?: IntLike
            maxTokenSupply?: IntLike
            reimbursementId?: IntLike
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
                .addReimbursementInput({ id: props?.reimbursementId ?? 0 })
        }

        const defaultTestArgs = {
            supply0,
            supply1,
            D: -burnedTokens,
            ptrs: {
                asset_input_ptrs: [makeAssetPtr()],
                asset_group_output_ptrs: []
            } // dummy for lovelace
        }

        it("supply_validator::validate_burn_user_tokens #01 (succeeds if the lovelace value taken taken out of the vault is equivalent to the tokens burned)", () => {
            configureContext().use((ctx) => {
                validate_burn_user_tokens.eval({
                    $scriptContext: ctx,
                    ...defaultTestArgs
                })
            })
        })

        it("supply_validator::validate_burn_user_tokens #02 (throws an error if the price is expired)", () => {
            configureContext({ priceTimestamp: 49 }).use((ctx) => {
                throws(() => {
                    validate_burn_user_tokens.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })
                }, /price expired/)
            })
        })

        it("supply_validator::validate_burn_user_tokens #03 (throws an error if more lovelace is taken from vault)", () => {
            configureContext({ lovelaceFromVault: 100_000_001 }).use((ctx) => {
                throws(() => {
                    validate_burn_user_tokens.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })
                }, /too much value taken from vault/)
            })
        })

        it("supply_validator::validate_burn_user_tokens #04 (throws an error if the voucher count in the supply datum didn't decrease by 1)", () => {
            const supply1 = configureSupply1({ nVouchers: 1 })

            configureContext().use((ctx) => {
                throws(() => {
                    validate_burn_user_tokens.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    })
                }, /voucher count not updated correctly/)
            })
        })

        it("supply_validator::validate_burn_user_tokens #05 (throws an error if the last voucher id in the supply datum changed)", () => {
            const supply1 = configureSupply1({ lastVoucherId: 0 })
            configureContext().use((ctx) => {
                throws(() => {
                    validate_burn_user_tokens.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    })
                }, /last voucher id changed/)
            })
        })

        it("supply_validator::validate_burn_user_tokens #06 (throws an error if the management fee timestamp changed)", () => {
            const supply1 = configureSupply1({ managementFeeTimestamp: 123 })
            configureContext().use((ctx) => {
                throws(() => {
                    validate_burn_user_tokens.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    })
                }, /management fee timestamp changed/)
            })
        })

        it("supply_validator::validate_burn_user_tokens #07 (throws an error if the success fee settings changed)", () => {
            const supply1 = configureSupply1({ successFeeStartTime: 123 })
            configureContext().use((ctx) => {
                throws(() => {
                    validate_burn_user_tokens.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    })
                }, /success fee changed/)
            })
        })

        it("supply_validator::validate_burn_user_tokens #08 (succeeds if the tx includes an asset group without any changes)", () => {
            configureContext()
                .addAssetGroupThread({
                    id: 0,
                    inputAssets: [makeAsset()],
                    outputAssets: [makeAsset({ count: 0 })]
                })
                .use((ctx) => {
                    validate_burn_user_tokens.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        ptrs: {
                            asset_input_ptrs: [makeAssetPtr()],
                            asset_group_output_ptrs: [0]
                        }
                    })
                })
        })

        it("supply_validator::validate_burn_user_tokens #09 (throws an error if the tx includes an asset group with a count change)", () => {
            configureContext()
                .addAssetGroupThread({
                    id: 0,
                    inputAssets: [makeAsset()],
                    outputAssets: [makeAsset({ count: 10 })]
                })
                .use((ctx) => {
                    throws(() => {
                        validate_burn_user_tokens.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs,
                            ptrs: {
                                asset_input_ptrs: [makeAssetPtr()],
                                asset_group_output_ptrs: [0]
                            }
                        })
                    }, /counters aren't consistent/)
                })
        })

        it("supply_validator::validate_burn_user_tokens #10 (throws an error if the transaction isn't witnessed by spending the correct reimbursement token)", () => {
            configureContext({ reimbursementId: 10 }).use((ctx) => {
                throws(() => {
                    validate_burn_user_tokens.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    })
                }, /token burn not witnessed by reimbursement/)
            })
        })
    })
})

describe("supply_validator::validate_swap", () => {
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
            ptrs: {
                asset_input_ptrs: [makeAssetPtr()],
                asset_group_output_ptrs: []
            } // dummy for lovelace
        }

        it("supply_validator::validate_swap #01 (succeeds if nothing is minted and the supply datum is correctly updated)", () => {
            configureContext().use((ctx) => {
                validate_swap.eval({
                    $scriptContext: ctx,
                    ...defaultTestArgs
                })
            })
        })

        it("supply_validator::validate_swap #02 (throws an error if more is taken from vault)", () => {
            configureContext()
                .takeFromVault({ value: new Value(100_000_001) })
                .use((ctx) => {
                    throws(() => {
                        validate_swap.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        })
                    }, /value lost from vault/)
                })
        })

        it("supply_validator::validate_swap #03 (throws an error if the voucher count in the supply datum changed)", () => {
            const supply1 = configureSupply1({ nVouchers: 123 })
            configureContext().use((ctx) => {
                throws(() => {
                    validate_swap.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    })
                }, /voucher count changed/)
            })
        })

        it("supply_validator::validate_swap #04 (throws an error if the management fee timestamp in the supply datum changed)", () => {
            const supply1 = configureSupply1({ managementFeeTimestamp: 123 })
            configureContext().use((ctx) => {
                throws(() => {
                    validate_swap.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    })
                }, /management fee timestamp changed/)
            })
        })

        it("supply_validator::validate_swap #05 (throws an error if the success fee settings in the supply datum changed)", () => {
            const supply1 = configureSupply1({ successFeeStartTime: 123 })
            configureContext().use((ctx) => {
                throws(() => {
                    validate_swap.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        supply1
                    })
                }, /success fee changed/)
            })
        })

        it("supply_validator::validate_swap #06 (throws an error if a token is minted with the fund policy)", () => {
            configureContext()
                .mint({ assets: makeConfigToken(1) })
                .use((ctx) => {
                    throws(() => {
                        validate_swap.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs,
                            supply1
                        })
                    }, /some tokens minted\/burned/)
                })
        })

        it("supply_validator::validate_swap #07 (throws an error if a token is burned with the fund policy)", () => {
            configureContext()
                .mint({ assets: makeConfigToken(-1) })
                .use((ctx) => {
                    throws(() => {
                        validate_swap.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs,
                            supply1
                        })
                    }, /some tokens minted\/burned/)
                })
        })

        it("supply_validator::validate_swap #08 (succeeds if the tx includes an asset group without any changes except the count tick)", () => {
            configureContext()
                .addAssetGroupThread({
                    id: 0,
                    inputAssets: [makeAsset()],
                    outputAssets: [makeAsset({ count: 0 })]
                })
                .use((ctx) => {
                    validate_swap.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        ptrs: {
                            asset_input_ptrs: [makeAssetPtr()],
                            asset_group_output_ptrs: [1]
                        }
                    })
                })
        })

        it("supply_validator::validate_swap #09 (throws an error if the tx includes an asset group with a count change)", () => {
            configureContext()
                .addAssetGroupThread({
                    id: 0,
                    inputAssets: [makeAsset()],
                    outputAssets: [makeAsset({ count: 10 })]
                })
                .use((ctx) => {
                    throws(() => {
                        validate_swap.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs,
                            ptrs: {
                                asset_input_ptrs: [makeAssetPtr()],
                                asset_group_output_ptrs: [1]
                            }
                        })
                    }, /counters aren't consistent/)
                })
        })
    })
})

describe("supply_validator metrics", () => {
    const program = contract.supply_validator.$hash.context.program

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

        // TODO: this can be fixed by making __helios__ratio__show() safe
        it("ir doesn't contain appendString", () => {
            if (!!/__core__appendString/.exec(ir)) {
                console.log(ir)

                throw new Error("optimized ir shouldn't contain appendString")
            }
        })
    }
})
