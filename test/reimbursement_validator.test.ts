import { deepEqual, strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { type IntLike } from "@helios-lang/codec-utils"
import {
    type Assets,
    makeAssets,
    makeDummyAddress,
    makeDummyAssetClass,
    makeDummyPubKeyHash,
    makeValue,
    type PubKeyHash
} from "@helios-lang/ledger"
import {
    makeByteArrayData,
    makeIntData,
    type UplcData
} from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"
import { MAX_SCRIPT_SIZE } from "./constants"
import {
    makeCollectingReimbursement,
    makeConfig,
    makeExtractingReimbursement,
    makePrice,
    makeSuccessFee,
    makeSupply,
    makeVoucher,
    ReimbursementType
} from "./data"
import {
    makeDvpTokens,
    makeReimbursementToken,
    makeVoucherRefToken
} from "./tokens"
import { ScriptContextBuilder } from "./tx"

const {
    validate_burned_vouchers,
    sum_net_tokens,
    validate_start_extracting,
    validate_continue_collecting,
    main
} = contract.reimbursement_validator

describe("reimbursement_validator::validate_burned_vouchers", () => {
    describe("three vouchers burned", () => {
        const periodId = 0

        const reimbursement = makeExtractingReimbursement({
            startPrice: [100, 1],
            endPrice: [140, 1],
            nRemainingVouchers: 10,
            successFee: makeSuccessFee({
                c0: 0,
                steps: [{ c: 0.3, sigma: 1.05 }]
            })
        })

        const configureContext = (props?: {
            thirdVoucherToken?: Assets | null
            thirdVoucherPeriodId?: IntLike
            thirdReturnDatum?: UplcData
            nThirdVouchersBurned?: number
        }) => {
            const voucherId0 = 0
            const voucherId1 = 1
            const voucherId2 = 2

            const voucherAddr0 = makeDummyAddress(false, voucherId0)
            const voucherDatum0 = makeIntData(voucherId0)
            const voucher0 = makeVoucher({
                periodId,
                price: [120, 1],
                address: voucherAddr0,
                datum: voucherDatum0,
                tokens: 1_000_000
            })
            const expectedReim0 = 50153
            const voucherAddr1 = makeDummyAddress(false, voucherId1)
            const voucherDatum1 = makeIntData(voucherId1)
            const voucher1 = makeVoucher({
                periodId,
                price: [125, 1],
                address: voucherAddr1,
                datum: voucherDatum1,
                tokens: 2_000_000
            })
            const expectedReim1 = 123946
            const voucherAddr2 = makeDummyAddress(false, voucherId2)
            const voucherDatum2 = makeIntData(voucherId2)
            const voucher2 = makeVoucher({
                periodId: props?.thirdVoucherPeriodId ?? periodId,
                price: [115, 1],
                address: voucherAddr2,
                datum: voucherDatum2,
                tokens: 5_000_000
            })
            const expectedReim2 = 190285

            return new ScriptContextBuilder()
                .addReimbursementInput({
                    id: periodId,
                    reimbursement,
                    redeemer: makeIntData(0)
                })
                .mint({ assets: makeVoucherRefToken(voucherId0, -1) })
                .mint({ assets: makeVoucherRefToken(voucherId1, -1) })
                .mint({
                    assets:
                        props?.thirdVoucherToken === null
                            ? null
                            : (props?.thirdVoucherToken ??
                              makeVoucherRefToken(
                                  voucherId2,
                                  -(props?.nThirdVouchersBurned ?? 1)
                              ))
                })
                .addVoucherInput({ id: voucherId0, voucher: voucher0 })
                .addVoucherInput({ id: voucherId1, voucher: voucher1 })
                .addVoucherInput({ id: voucherId2, voucher: voucher2 })
                .addOutput({
                    address: voucherAddr0,
                    datum: voucherDatum0,
                    value: makeValue(0, makeDvpTokens(expectedReim0))
                })
                .addOutput({
                    address: voucherAddr1,
                    datum: voucherDatum1,
                    value: makeValue(0, makeDvpTokens(expectedReim1))
                })
                .addOutput({
                    address: voucherAddr2,
                    datum: props?.thirdReturnDatum ?? voucherDatum2,
                    value: makeValue(0, makeDvpTokens(expectedReim2))
                })
                .addConfigRef()
        }

        const defaultTestArgs = {
            reim: reimbursement,
            period_id: periodId,
            voucher_output_ptrs: [0, 1, 2]
        }

        it("reimbursement_validator::validate_burned_vouchers #01 (returns the number of vouchers burned and the total number of tokens reimbursed)", () => {
            configureContext().use((ctx) => {
                deepEqual(
                    validate_burned_vouchers.eval({
                        ...defaultTestArgs,
                        $scriptContext: ctx
                    }),
                    [3n, 50153n + 123946n + 190285n]
                )
            })
        })

        it("reimbursement_validator::validate_burned_vouchers #02 (returns the number of vouchers burned and the total number of tokens reimbursed even if one voucher doens't require reimbursement)", () => {
            configureContext()
                .addVoucherInput({
                    id: 3,
                    voucher: makeVoucher({
                        periodId,
                        price: [100, 1],
                        tokens: 100
                    })
                })
                .mint({ assets: makeVoucherRefToken(3, -1) })
                .use((ctx) => {
                    deepEqual(
                        validate_burned_vouchers.eval({
                            ...defaultTestArgs,
                            voucher_output_ptrs: [0, 1, 2, -1], // dummy ptrs are needed for voucher that are so small they don't require reimbursement
                            $scriptContext: ctx
                        }),
                        [4n, 50153n + 123946n + 190285n]
                    )
                })
        })

        it("reimbursement_validator::validate_burned_vouchers #03 (throws an error if an pointer is missing for a small voucher that doens't require reimbursement)", () => {
            configureContext()
                .addVoucherInput({
                    id: 3,
                    voucher: makeVoucher({
                        periodId,
                        price: [100, 1],
                        tokens: 100
                    })
                })
                .mint({ assets: makeVoucherRefToken(3, -1) })
                .use((ctx) => {
                    throws(() => {
                        validate_burned_vouchers.eval({
                            ...defaultTestArgs,
                            voucher_output_ptrs: [0, 1, 2], // dummy ptrs are needed for voucher that are so small they don't require reimbursement
                            $scriptContext: ctx
                        })
                    }, /empty list in headList/)
                })
        })

        it("reimbursement_validator::validate_burned_vouchers #04 (throws an error if one of the vouchers is burned more than once)", () => {
            configureContext({ nThirdVouchersBurned: 2 }).use((ctx) => {
                throws(() => {
                    validate_burned_vouchers.eval({
                        ...defaultTestArgs,
                        $scriptContext: ctx
                    })
                }, /voucher ref not burned/)
            })
        })

        it("reimbursement_validator::validate_burned_vouchers #05 (throws an error if one of the vouchers isn't actually burned)", () => {
            configureContext({ thirdVoucherToken: null }).use((ctx) => {
                throws(() => {
                    validate_burned_vouchers.eval({
                        ...defaultTestArgs,
                        $scriptContext: ctx
                    })
                }, /key not found/)
            })
        })

        it("reimbursement_validator::validate_burned_vouchers #06 (throws an error if a voucher datum doesn't match)", () => {
            configureContext({ thirdReturnDatum: makeByteArrayData([]) }).use(
                (ctx) => {
                    throws(() => {
                        validate_burned_vouchers.eval({
                            ...defaultTestArgs,
                            $scriptContext: ctx
                        })
                    }, /unexpected voucher return datum/)
                }
            )
        })

        it("reimbursement_validator::validate_burned_vouchers #07 (throws an error if the pointers are in the wrong order)", () => {
            configureContext({ thirdReturnDatum: makeByteArrayData([]) }).use(
                (ctx) => {
                    throws(() => {
                        validate_burned_vouchers.eval({
                            ...defaultTestArgs,
                            voucher_output_ptrs: [2, 1, 0],
                            $scriptContext: ctx
                        })
                    }, /unexpected voucher return address/)
                }
            )
        })

        it("reimbursement_validator::validate_burned_vouchers #08 (throws an error if one of the vouchers is from another period)", () => {
            configureContext({ thirdVoucherPeriodId: 123 }).use((ctx) => {
                throws(() => {
                    validate_burned_vouchers.eval({
                        ...defaultTestArgs,
                        $scriptContext: ctx
                    })
                }, /voucher is from other period/)
            })
        })
    })
})

describe("reimbursement_validator::sum_net_tokens", () => {
    it("reimbursement_validator::sum_net_tokens #01 (returns 0 for unrelated dummy transaction)", () => {
        new ScriptContextBuilder()
            .addDummyInputs(10)
            .addDummyOutputs(10)
            .redeemDummyTokenWithDvpPolicy()
            .mint({
                assets: makeAssets([[makeDummyAssetClass(), 10]])
            })
            .use((ctx) => {
                strictEqual(sum_net_tokens.eval({ $scriptContext: ctx }), 0n)
            })
    })

    it("reimbursement_validator::sum_net_tokens #02 (returns the number of minted dvp tokens if there are no dvp tokens in the inputs)", () => {
        new ScriptContextBuilder()
            .addDummyInputs(10)
            .addDummyOutputs(10)
            .redeemDummyTokenWithDvpPolicy()
            .mint({ assets: makeDvpTokens(1000) })
            .use((ctx) => {
                strictEqual(sum_net_tokens.eval({ $scriptContext: ctx }), 1000n)
            })
    })

    it("reimbursement_validator::sum_net_tokens #03 (returns a negative number if dvp tokens are burned and there are no dvp tokens in the inputs)", () => {
        new ScriptContextBuilder()
            .addDummyInputs(10)
            .addDummyOutputs(10)
            .redeemDummyTokenWithDvpPolicy()
            .mint({ assets: makeDvpTokens(-1000) })
            .use((ctx) => {
                strictEqual(
                    sum_net_tokens.eval({ $scriptContext: ctx }),
                    -1000n
                )
            })
    })

    it("reimbursement_validator::sum_net_tokens #04 (returns a negative number if there are some dvp tokens in the inputs but more dvp tokens are burned)", () => {
        new ScriptContextBuilder()
            .addDummyInput({ value: makeValue(0, makeDvpTokens(10)) })
            .addDummyOutputs(10)
            .redeemDummyTokenWithDvpPolicy()
            .mint({ assets: makeDvpTokens(-1000) })
            .use((ctx) => {
                strictEqual(sum_net_tokens.eval({ $scriptContext: ctx }), -990n)
            })
    })

    it("reimbursement_validator::sum_net_tokens #05 (the result is uninfluenced by dvp tokens in the outputs)", () => {
        new ScriptContextBuilder()
            .addDummyInput({ value: makeValue(0, makeDvpTokens(10)) })
            .addDummyOutput({ value: makeValue(0, makeDvpTokens(100000)) })
            .redeemDummyTokenWithDvpPolicy()
            .mint({ assets: makeDvpTokens(-1000) })
            .use((ctx) => {
                strictEqual(sum_net_tokens.eval({ $scriptContext: ctx }), -990n)
            })
    })

    it("reimbursement_validator::sum_net_tokens #06 (returns the number of dvp tokens in the inputs if no dvp tokens are burned or minted)", () => {
        new ScriptContextBuilder()
            .addDummyInputs(10)
            .addDummyInput({ value: makeValue(0, makeDvpTokens(123)) })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                strictEqual(sum_net_tokens.eval({ $scriptContext: ctx }), 123n)
            })
    })
})

describe("reimbursement_validator::validate_start_extracting", () => {
    const configureContext = (props?: {
        currentPrice?: [IntLike, IntLike]
        reim1?: ReimbursementType
        nMintedDvpTokens?: IntLike
        nInputDvpTokens?: IntLike
        nOutputDvpTokens?: IntLike
        threadOutputId?: IntLike
        nextReimOutputId?: IntLike
        nNextOutputDvpTokens?: IntLike
        nextReim?: ReimbursementType
        spendConfig?: boolean
    }) => {
        const successFee = makeSuccessFee()
        const config = makeConfig({ successFee })
        const price = makePrice({
            top: props?.currentPrice?.[0] ?? 100,
            bottom: props?.currentPrice?.[1] ?? 1
        })
        const supply = makeSupply({ nVouchers: 0 })

        const b = new ScriptContextBuilder()
            .addReimbursementInput({
                redeemer: makeIntData(0),
                id: 1,
                reimbursement: makeCollectingReimbursement(),
                nDvpTokens: props?.nInputDvpTokens ?? 0
            })
            .addReimbursementOutput({
                id: props?.threadOutputId ?? 1,
                reimbursement:
                    props?.reim1 ??
                    makeExtractingReimbursement({
                        startPrice: price.value,
                        endPrice: price.value
                    }),
                nDvpTokens: props?.nOutputDvpTokens ?? 0
            })
            .addReimbursementOutput({
                id: props?.nextReimOutputId ?? 2,
                reimbursement:
                    props?.nextReim ??
                    makeCollectingReimbursement({ startPrice: price.value }),
                nDvpTokens: props?.nNextOutputDvpTokens ?? 0
            })
            .mint({ assets: makeDvpTokens(props?.nMintedDvpTokens ?? 0) })
            .addConfigRef({ config })
            .addPriceRef({ price })
            .observeBenchmark()
            .addSupplyInput({ supply })

        if (props?.spendConfig) {
            b.addConfigInput({ config }).addConfigOutput({ config })
        } else {
            b.addConfigRef({ config })
        }

        return b
    }

    const defaultTestArgs = {
        id: 1,
        start_price0: [100, 1] as [IntLike, IntLike]
    }

    it("reimbursement_validator::validate_start_extracting #01 (succeeds if the new reimbursement state is Extracting and config is referenced)", () => {
        configureContext().use((ctx) => {
            strictEqual(
                validate_start_extracting.eval({
                    ...defaultTestArgs,
                    $scriptContext: ctx
                }),
                undefined
            )
        })
    })

    it("reimbursement_validator::validate_start_extracting #02 (succeeds if the new reimbursement state is Extractingand config is spent)", () => {
        configureContext({ spendConfig: true }).use((ctx) => {
            strictEqual(
                validate_start_extracting.eval({
                    ...defaultTestArgs,
                    $scriptContext: ctx
                }),
                undefined
            )
        })
    })

    it("reimbursement_validator::validate_start_extracting #03 (throws an error if there is no reimbursement output with the given id)", () => {
        configureContext({ threadOutputId: 3 }).use((ctx) => {
            throws(() => {
                validate_start_extracting.eval({
                    ...defaultTestArgs,
                    $scriptContext: ctx
                })
            }, /not found/)
        })
    })

    it("reimbursement_validator::validate_start_extracting #04 (throws an error if there is start_price in the reimbursement output isn't equal to the input start_price)", () => {
        configureContext().use((ctx) => {
            throws(() => {
                validate_start_extracting.eval({
                    ...defaultTestArgs,
                    $scriptContext: ctx,
                    start_price0: [1000, 10]
                })
            }, /start_price changed/)
        })
    })

    it("reimbursement_validator::validate_start_extracting #05 (throws an error if the output reimbursement datum isn't in Extracting state)", () => {
        configureContext({
            reim1: makeCollectingReimbursement({ startPrice: [100, 1] })
        }).use((ctx) => {
            throws(() => {
                validate_start_extracting.eval({
                    ...defaultTestArgs,
                    $scriptContext: ctx
                })
            }, /unexpected output reimbursement state/)
        })
    })

    it("reimbursement_validator::validate_start_extracting #06 (throws an error if not all the input tokens are contained in the reimbursement output)", () => {
        configureContext({ nInputDvpTokens: 1000 }).use((ctx) => {
            throws(() => {
                validate_start_extracting.eval({
                    ...defaultTestArgs,
                    $scriptContext: ctx
                })
            }, /not all output dvp tokens collected by reimbursement/)
        })
    })

    it("reimbursement_validator::validate_start_extracting #07 (throws an error if the reimbursement output end price doesn't match the current price)", () => {
        configureContext({
            reim1: makeExtractingReimbursement({ endPrice: [1000, 10] })
        }).use((ctx) => {
            throws(() => {
                validate_start_extracting.eval({
                    ...defaultTestArgs,
                    $scriptContext: ctx
                })
            }, /end price in reimbursement datum doesn't match dvp price datum/)
        })
    })

    it("reimbursement_validator::validate_start_extracting #08 (throws an error if the reimbursement output success fee doesn't match the config input success fee)", () => {
        configureContext({
            reim1: makeExtractingReimbursement({
                endPrice: [100, 1],
                successFee: makeSuccessFee({
                    c0: 0,
                    steps: [{ c: 0.3, sigma: 1.03 }]
                })
            })
        }).use((ctx) => {
            throws(() => {
                validate_start_extracting.eval({
                    ...defaultTestArgs,
                    $scriptContext: ctx
                })
            }, /success fee not copied from config0/)
        })
    })

    it("reimbursement_validator::validate_start_extracting #09 (throws an error if the reimbursement output n vouchers doesn't match the supply input n vouchers)", () => {
        configureContext({
            reim1: makeExtractingReimbursement({
                endPrice: [100, 1],
                nRemainingVouchers: 123
            })
        }).use((ctx) => {
            throws(() => {
                validate_start_extracting.eval({
                    ...defaultTestArgs,
                    $scriptContext: ctx
                })
            }, /n remaining vouchers in reimbursement datum doesn't match n_vouchers in input supply datum/)
        })
    })

    it("reimbursement_validator::validate_start_extracting #10 (throws an error if the next reimbursement output can't be found)", () => {
        configureContext({ nextReimOutputId: 3 }).use((ctx) => {
            throws(() => {
                validate_start_extracting.eval({
                    ...defaultTestArgs,
                    $scriptContext: ctx
                })
            }, /not found/)
        })
    })

    it("reimbursement_validator::validate_start_extracting #11 (throws an error if the next reimbursement output contains some dvp tokens)", () => {
        configureContext({ nNextOutputDvpTokens: 1 }).use((ctx) => {
            throws(() => {
                validate_start_extracting.eval({
                    ...defaultTestArgs,
                    $scriptContext: ctx
                })
            }, /unexpected dvp tokens in next reimbursement/)
        })
    })

    it("reimbursement_validator::validate_start_extracting #12 (throws an error if the next reimbursement output state isn't Collecting)", () => {
        configureContext({ nextReim: makeExtractingReimbursement() }).use(
            (ctx) => {
                throws(() => {
                    validate_start_extracting.eval({
                        ...defaultTestArgs,
                        $scriptContext: ctx
                    })
                }, /next reimbursement state not set to Collecting/)
            }
        )
    })

    it("reimbursement_validator::validate_start_extracting #13 (throws an error if the next reimbursement output start price isn't equal to the current price)", () => {
        configureContext({
            nextReim: makeCollectingReimbursement({ startPrice: [101, 1] })
        }).use((ctx) => {
            throws(() => {
                validate_start_extracting.eval({
                    ...defaultTestArgs,
                    $scriptContext: ctx
                })
            }, /start_price of next reimbursement doesn't match current end_price/)
        })
    })
})

describe("reimbursement_validator::validate_continue_collecting", () => {
    const configureContext = (props?: { reim?: ReimbursementType }) => {
        return new ScriptContextBuilder()
            .addDummyInputs(10)
            .redeemDummyTokenWithDvpPolicy()
            .addReimbursementOutput({
                id: 1,
                nDvpTokens: 0,
                reimbursement: props?.reim ?? makeCollectingReimbursement()
            })
    }

    const defaultTestArgs = {
        id: 1,
        start_price0: [100, 1] as [IntLike, IntLike]
    }

    it("reimbursement_validator::validate_continue_collecting #01 (succeeds if the reimbursement output is found and in Collecting state)", () => {
        configureContext().use((ctx) => {
            strictEqual(
                validate_continue_collecting.eval({
                    ...defaultTestArgs,
                    $scriptContext: ctx
                }),
                undefined
            )
        })
    })

    it("reimbursement_validator::validate_continue_collecting #02 (throws an error if the reimbursement output isn't found)", () => {
        configureContext().use((ctx) => {
            throws(() => {
                validate_continue_collecting.eval({
                    ...defaultTestArgs,
                    $scriptContext: ctx,
                    id: 2
                })
            }, /not found/)
        })
    })

    it("reimbursement_validator::validate_continue_collecting #03 (throws an error if the reimbursement output is found but not in Collecting state)", () => {
        configureContext({ reim: makeExtractingReimbursement() }).use((ctx) => {
            throws(() => {
                validate_continue_collecting.eval({
                    ...defaultTestArgs,
                    $scriptContext: ctx
                })
            }, /next reimbursement token must be minted to be able to change to Extracting state/)
        })
    })

    it("reimbursement_validator::validate_continue_collecting #04 (throws an error if not all the minted tokens are included in the reimbursement output)", () => {
        configureContext()
            .mint({ assets: makeDvpTokens(123) })
            .use((ctx) => {
                throws(() => {
                    validate_continue_collecting.eval({
                        ...defaultTestArgs,
                        $scriptContext: ctx
                    })
                }, /not all dvp tokens collected by reimbursement/)
            })
    })

    it("reimbursement_validator::validate_continue_collecting #05 (throws an error if not all the start price doesn't match)", () => {
        configureContext().use((ctx) => {
            throws(() => {
                validate_continue_collecting.eval({
                    ...defaultTestArgs,
                    $scriptContext: ctx,
                    start_price0: [101, 1]
                })
            }, /reimbursement start price changed/)
        })
    })
})

describe("reimbursement_validator::main", () => {
    describe("the reimbursement UTxO is destroyed and the reimbursement token is burned, 1 voucher is burned", () => {
        const reimbursement = makeExtractingReimbursement({
            nRemainingVouchers: 1,
            startPrice: [100, 1],
            endPrice: [140, 1]
        })

        const configureContext = (props?: {
            token?: Assets | null
            agent?: PubKeyHash | null
            burnVoucher?: boolean
        }) => {
            const agent = makeDummyPubKeyHash(10)
            const config = makeConfig({ agent })

            const voucherId0 = 0
            const voucherAddr0 = makeDummyAddress(false, voucherId0)
            const voucherDatum0 = makeIntData(voucherId0)
            const voucher0 = makeVoucher({
                price: [120, 1],
                address: voucherAddr0,
                datum: voucherDatum0,
                tokens: 1_000_000
            })
            const expectedReim0 = 50153

            const scb = new ScriptContextBuilder()
                .addSigner(props?.agent === null ? props?.agent : agent)
                .addConfigRef({ config })
                .addReimbursementInput({
                    reimbursement,
                    redeemer: makeIntData(0)
                })
                .mint({
                    assets:
                        props?.token === null
                            ? null
                            : (props?.token ?? makeReimbursementToken(0, -1))
                })

            if (props?.burnVoucher ?? true) {
                scb.mint({ assets: makeVoucherRefToken(voucherId0, -1) })
                    .addVoucherInput({ id: voucherId0, voucher: voucher0 })
                    .addOutput({
                        address: voucherAddr0,
                        datum: voucherDatum0,
                        value: makeValue(0, makeDvpTokens(expectedReim0))
                    })
            }

            return scb
        }

        const defaultTestArgs = {
            _: reimbursement,
            voucher_output_ptrs: [0]
        }

        it("reimbursement_validator::main #01 (succeeds if all remaining vouchers have been reimbursed and burned)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    main.eval({
                        ...defaultTestArgs,
                        $scriptContext: ctx
                    }),
                    undefined
                )
            })
        })

        it("reimbursement_validator::main #02 (throws an error if not signed by the agent)", () => {
            configureContext({ agent: null }).use((ctx) => {
                throws(() => {
                    main.eval({
                        ...defaultTestArgs,
                        $scriptContext: ctx
                    })
                }, /not signed by agent/)
            })
        })

        it("reimbursement_validator::main #03 (throws an error if the given pointer is out of range)", () => {
            configureContext({ token: null }).use((ctx) => {
                throws(() => {
                    main.eval({
                        ...defaultTestArgs,
                        voucher_output_ptrs: [1],
                        $scriptContext: ctx
                    })
                }, /index out of range/)
            })
        })

        it("reimbursement_validator::main #04 (throws an error if the reimbursement token isn't burned)", () => {
            configureContext({ token: null }).use((ctx) => {
                throws(() => {
                    main.eval({
                        ...defaultTestArgs,
                        $scriptContext: ctx
                    })
                }, /key not found/)
            })
        })

        it("reimbursement_validator::main #05 (throws an error if the reimbursement token is burned more than once)", () => {
            configureContext({ token: makeReimbursementToken(0, -3) }).use(
                (ctx) => {
                    throws(() => {
                        main.eval({
                            ...defaultTestArgs,
                            $scriptContext: ctx
                        })
                    }, /not exactly one reimbursement token burned/)
                }
            )
        })

        it("reimbursement_validator::main #06 (throws an error if the voucher isn't burned)", () => {
            configureContext({ burnVoucher: false }).use((ctx) => {
                throws(() => {
                    main.eval({
                        ...defaultTestArgs,
                        $scriptContext: ctx
                    })
                }, /not found/)
            })
        })
    })

    describe("the reimbursement UTxO is returned to the reimbursement address", () => {
        const periodId = 0
        const reimbursement0 = makeExtractingReimbursement({
            nRemainingVouchers: 2,
            startPrice: [100, 1],
            endPrice: [140, 1]
        })
        const nTokens0 = 100_000

        const configureContext = (props?: {
            burnVoucher?: boolean
            voucherPeriodId?: IntLike
            signingAgent?: PubKeyHash
            nRemainingTokens?: IntLike
            nRemainingVouchers?: IntLike
            outputPeriodId?: IntLike
            reimbursement0?: ReimbursementType
            reimbursement1?: ReimbursementType
        }) => {
            const agent = makeDummyPubKeyHash(10)
            const config = makeConfig({ agent })

            const reimbursement1 =
                props?.reimbursement1 ??
                makeExtractingReimbursement({
                    nRemainingVouchers: props?.nRemainingVouchers ?? 1,
                    startPrice: [100, 1],
                    endPrice: [140, 1]
                })

            const voucherId0 = 0
            const voucherAddr0 = makeDummyAddress(false, voucherId0)
            const voucherDatum0 = makeIntData(voucherId0)
            const voucher0 = makeVoucher({
                periodId: props?.voucherPeriodId ?? periodId,
                price: [120, 1],
                address: voucherAddr0,
                datum: voucherDatum0,
                tokens: 1_000_000
            })
            const expectedReim0 = 50153

            const nTokens1 =
                props?.nRemainingTokens ??
                nTokens0 - ((props?.burnVoucher ?? true) ? expectedReim0 : 0)

            const scb = new ScriptContextBuilder()
                .addSigner(props?.signingAgent ?? agent)
                .addConfigRef({ config })
                .addReimbursementInput({
                    id: periodId,
                    reimbursement: props?.reimbursement0 ?? reimbursement0,
                    redeemer: makeIntData(0),
                    extraTokens: makeDvpTokens(nTokens0)
                })
                .addReimbursementOutput({
                    id: props?.outputPeriodId ?? periodId,
                    reimbursement: reimbursement1,
                    extraTokens: makeDvpTokens(nTokens1)
                })

            if (props?.burnVoucher ?? true) {
                scb.mint({ assets: makeVoucherRefToken(voucherId0, -1) })
                    .addVoucherInput({ id: voucherId0, voucher: voucher0 })
                    .addOutput({
                        address: voucherAddr0,
                        datum: voucherDatum0,
                        value: makeValue(0, makeDvpTokens(expectedReim0))
                    })
            }

            return scb
        }

        const defaultTestArgs = {
            _: reimbursement0,
            voucher_output_ptrs: [1]
        }

        it("reimbursement_validator::main #07 (succeeds if the number of remaining vouchers and tokens in the reimbursement output is correct)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    }),
                    undefined
                )
            })
        })

        it("reimbursement_validator::main #08 (succeeds even if too many pointers are included)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        voucher_output_ptrs: [1, 2, 3, 4, 5]
                    }),
                    undefined
                )
            })
        })

        it("reimbursement_validator::main #09 (throws an error if not signed by the correct agent)", () => {
            configureContext({ signingAgent: makeDummyPubKeyHash(11) }).use(
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

        it("reimbursement_validator::main #10 (throws an error if less than the expected number of DVP tokens remain in the reimbursement output)", () => {
            configureContext({ nRemainingTokens: 40_000 }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })
                }, /number of success fee tokens remaining not decremented by the number of reimbursed tokens/)
            })
        })

        it("reimbursement_validator::main #11 (throws an error if more than the expected number of DVP tokens remain in the reimbursement output)", () => {
            configureContext({ nRemainingTokens: 100_000 }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })
                }, /number of success fee tokens remaining not decremented by the number of reimbursed tokens/)
            })
        })

        it("reimbursement_validator::main #12 (throws an error if the number of remaining vouchers in the reimbursement datum didn't decrement by the number of actually burned vouchers)", () => {
            configureContext({ nRemainingVouchers: 2 }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })
                }, /invalid datum change/)
            })
        })

        it("reimbursement_validator::main #13 (throws an error if the period id of the reimbursement output changes)", () => {
            configureContext({ outputPeriodId: 1 }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })
                }, /not found/)
            })
        })

        it("reimbursement_validator::main #14 (throws an error if the voucher being burned is from another period)", () => {
            configureContext({ voucherPeriodId: 123 }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })
                }, /voucher is from other period/)
            })
        })

        it("reimbursement_validator::main #15 (throws an error if the pointer points to the wrong output)", () => {
            configureContext().use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        voucher_output_ptrs: [0]
                    })
                }, /unexpected voucher return address/)
            })
        })

        it("reimbursement_validator::main #16 (throws an error if the reimbursement input isn't in Extracting state)", () => {
            const reimbursement0 = makeCollectingReimbursement()

            configureContext({ reimbursement0 }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs,
                        _: reimbursement0
                    })
                }, /next reimbursement token must be minted to be able to change to Extracting state/)
            })
        })

        it("reimbursement_validator::main #17 (throws an error if the reimbursement output isn't in Extracting state)", () => {
            configureContext({
                reimbursement1: makeCollectingReimbursement()
            }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })
                }, /invalid datum change/)
            })
        })

        it("reimbursement_validator::main #18 (throws an error if the reimbursement output end price differs)", () => {
            configureContext({
                reimbursement1: makeExtractingReimbursement({
                    nRemainingVouchers: 1,
                    startPrice: [100, 1],
                    endPrice: [141, 1]
                })
            }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })
                }, /invalid datum change/)
            })
        })

        it("reimbursement_validator::main #19 (throws an error if the reimbursement output start price differs)", () => {
            configureContext({
                reimbursement1: makeExtractingReimbursement({
                    nRemainingVouchers: 1,
                    startPrice: [101, 1],
                    endPrice: [140, 1]
                })
            }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })
                }, /invalid datum change/)
            })
        })
    })

    describe("start extracting", () => {
        const reim0 = makeCollectingReimbursement()

        const configureContext = (props?: {
            signingAgent?: PubKeyHash | null
            currentPrice?: [IntLike, IntLike]
            reim1?: ReimbursementType
            nMintedDvpTokens?: IntLike
            nInputDvpTokens?: IntLike
            nOutputDvpTokens?: IntLike
            threadOutputId?: IntLike
            nextReimOutputId?: IntLike
            nNextOutputDvpTokens?: IntLike
            nextReim?: ReimbursementType
            spendConfig?: boolean
        }) => {
            const agent = makeDummyPubKeyHash(10)
            const successFee = makeSuccessFee()
            const config = makeConfig({ successFee, agent })
            const price = makePrice({
                top: props?.currentPrice?.[0] ?? 100,
                bottom: props?.currentPrice?.[1] ?? 1
            })
            const supply = makeSupply({ nVouchers: 0 })

            const b = new ScriptContextBuilder()
                .addSigner(
                    props?.signingAgent === null
                        ? null
                        : (props?.signingAgent ?? agent)
                )
                .addReimbursementInput({
                    redeemer: makeIntData(0),
                    id: 1,
                    reimbursement: reim0,
                    nDvpTokens: props?.nInputDvpTokens ?? 0
                })
                .addReimbursementOutput({
                    id: props?.threadOutputId ?? 1,
                    reimbursement:
                        props?.reim1 ??
                        makeExtractingReimbursement({
                            startPrice: price.value,
                            endPrice: price.value
                        }),
                    nDvpTokens: props?.nOutputDvpTokens ?? 0
                })
                .addReimbursementOutput({
                    id: props?.nextReimOutputId ?? 2,
                    reimbursement:
                        props?.nextReim ??
                        makeCollectingReimbursement({
                            startPrice: price.value
                        }),
                    nDvpTokens: props?.nNextOutputDvpTokens ?? 0
                })
                .mint({ assets: makeDvpTokens(props?.nMintedDvpTokens ?? 0) })
                .mint({
                    assets: makeReimbursementToken(props?.nextReimOutputId ?? 2)
                })
                .addConfigRef({ config })
                .addPriceRef({ price })
                .observeBenchmark()
                .addSupplyInput({ supply })

            if (props?.spendConfig) {
                b.addConfigInput({ config }).addConfigOutput({ config })
            } else {
                b.addConfigRef({ config })
            }

            return b
        }

        it("reimbursement_validator::main #20 (succeeds if signed by agent and next reimbursement token is minted)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        _: reim0,
                        voucher_output_ptrs: []
                    }),
                    undefined
                )
            })
        })

        it("reimbursement_validator::main #21 (throws an error if not signed by agent)", () => {
            configureContext({ signingAgent: null }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        _: reim0,
                        voucher_output_ptrs: []
                    })
                }, /not signed by agent/)
            })
        })

        it("reimbursement_validator::main #22 (throws an error if the next reimbursement token isn't minted)", () => {
            configureContext()
                .mint({ assets: makeReimbursementToken(2, -1) })
                .use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            _: reim0,
                            voucher_output_ptrs: []
                        })
                    }, /next reimbursement token must be minted to be able to change to Extracting state/)
                })
        })
    })
})

describe("reimbursement_validator metrics", () => {
    const program = contract.reimbursement_validator.$hash.context.program

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
