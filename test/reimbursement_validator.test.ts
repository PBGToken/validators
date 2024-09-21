import { describe, it } from "node:test"
import context from "pbg-token-validators-test-context"
import { ScriptContextBuilder } from "./tx"
import {
    makeConfig,
    makeReimbursement,
    makeSuccessFee,
    makeVoucher
} from "./data"
import {
    Address,
    Assets,
    PubKeyHash,
    TxOutput,
    Value
} from "@helios-lang/ledger"
import { ByteArrayData, IntData, UplcData } from "@helios-lang/uplc"
import {
    makeDvpTokens,
    makeReimbursementToken,
    makeVoucherRefToken
} from "./tokens"
import { deepEqual, throws } from "node:assert"
import { IntLike } from "@helios-lang/codec-utils"

const { validate_burned_vouchers, main } = context.reimbursement_validator

describe("reimbursement_validator::validate_burned_vouchers", () => {
    describe("three vouchers burned", () => {
        const reimbursement = makeReimbursement({
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
            thirdReturnDatum?: UplcData
            nThirdVouchersBurned?: number
        }) => {
            const voucherId0 = 0
            const voucherId1 = 1
            const voucherId2 = 2

            const voucherAddr0 = Address.dummy(false, voucherId0)
            const voucherDatum0 = new IntData(voucherId0)
            const voucher0 = makeVoucher({
                price: [120, 1],
                address: voucherAddr0,
                datum: voucherDatum0,
                tokens: 1_000_000
            })
            const expectedReim0 = 50153
            const voucherAddr1 = Address.dummy(false, voucherId1)
            const voucherDatum1 = new IntData(voucherId1)
            const voucher1 = makeVoucher({
                price: [125, 1],
                address: voucherAddr1,
                datum: voucherDatum1,
                tokens: 2_000_000
            })
            const expectedReim1 = 123946
            const voucherAddr2 = Address.dummy(false, voucherId2)
            const voucherDatum2 = new IntData(voucherId2)
            const voucher2 = makeVoucher({
                price: [115, 1],
                address: voucherAddr2,
                datum: voucherDatum2,
                tokens: 500_000
            })
            const expectedReim2 = 19028

            return new ScriptContextBuilder()
                .addReimbursementInput({
                    reimbursement,
                    redeemer: new IntData(0)
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
                    value: new Value(0, makeDvpTokens(expectedReim0))
                })
                .addOutput({
                    address: voucherAddr1,
                    datum: voucherDatum1,
                    value: new Value(0, makeDvpTokens(expectedReim1))
                })
                .addOutput({
                    address: voucherAddr2,
                    datum: props?.thirdReturnDatum ?? voucherDatum2,
                    value: new Value(0, makeDvpTokens(expectedReim2))
                })
        }

        it("returns the number of vouchers burned and the total number of token reimbursed", () => {
            configureContext().use((ctx) => {
                deepEqual(
                    validate_burned_vouchers.eval({
                        $scriptContext: ctx,
                        reim: reimbursement
                    }),
                    [3n, 50153n + 123946n + 19028n]
                )
            })
        })

        it("throws an error if one of the vouchers is burned more than once", () => {
            configureContext({ nThirdVouchersBurned: 2 }).use((ctx) => {
                throws(() => {
                    validate_burned_vouchers.eval({
                        $scriptContext: ctx,
                        reim: reimbursement
                    })
                })
            })
        })

        it("throws an error if one of the vouchers isn't actually burned", () => {
            configureContext({ thirdVoucherToken: null }).use((ctx) => {
                throws(() => {
                    validate_burned_vouchers.eval({
                        $scriptContext: ctx,
                        reim: reimbursement
                    })
                })
            })
        })

        it("throws an error if no voucher return found", () => {
            configureContext({ thirdReturnDatum: new ByteArrayData([]) }).use(
                (ctx) => {
                    throws(() => {
                        validate_burned_vouchers.eval({
                            $scriptContext: ctx,
                            reim: reimbursement
                        })
                    })
                }
            )
        })
    })
})

describe("reimbursement_validator::main", () => {
    describe("the reimbursement UTxO is destroyed and the reimbursement token is burned, 1 voucher is burned", () => {
        const reimbursement = makeReimbursement({
            nRemainingVouchers: 1,
            startPrice: [100, 1],
            endPrice: [140, 1]
        })

        const configureContext = (props?: {
            token?: Assets | null
            burnVoucher?: boolean
        }) => {
            const agent = PubKeyHash.dummy(10)
            const config = makeConfig({ agent })

            const voucherId0 = 0
            const voucherAddr0 = Address.dummy(false, voucherId0)
            const voucherDatum0 = new IntData(voucherId0)
            const voucher0 = makeVoucher({
                price: [120, 1],
                address: voucherAddr0,
                datum: voucherDatum0,
                tokens: 1_000_000
            })
            const expectedReim0 = 50153

            const scb = new ScriptContextBuilder()
                .addSigner(agent)
                .addConfigRef({ config })
                .addReimbursementInput({
                    reimbursement,
                    redeemer: new IntData(0)
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
                        value: new Value(0, makeDvpTokens(expectedReim0))
                    })
            }

            return scb
        }

        it("succeeds if all remaining vouchers have been reimbursed and burned", () => {
            configureContext().use((ctx) => {
                main.eval({
                    $scriptContext: ctx,
                    $datum: reimbursement,
                    _: new IntData(0)
                })
            })
        })

        it("throws an error if the reimbursement token isn't burned", () => {
            configureContext({ token: null }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        $datum: reimbursement,
                        _: new IntData(0)
                    })
                })
            })
        })

        it("throws an error if the reimbursement token is burned more than once", () => {
            configureContext({ token: makeReimbursementToken(0, -3) }).use(
                (ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: reimbursement,
                            _: new IntData(0)
                        })
                    })
                }
            )
        })

        it("throws an error if the voucher isn't burned", () => {
            configureContext({ burnVoucher: false }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        $datum: reimbursement,
                        _: new IntData(0)
                    })
                })
            })
        })
    })

    describe("the reimbursement UTxO is returned to the reimbursement address", () => {
        const periodId = 0
        const reimbursement0 = makeReimbursement({
            nRemainingVouchers: 2,
            startPrice: [100, 1],
            endPrice: [140, 1]
        })
        const nTokens0 = 100_000

        const configureContext = (props?: {
            burnVoucher?: boolean
            signingAgent?: PubKeyHash
            nRemainingTokens?: IntLike
            nRemainingVouchers?: IntLike
            outputPeriodId?: IntLike
        }) => {
            const agent = PubKeyHash.dummy(10)
            const config = makeConfig({ agent })

            const reimbursement1 = makeReimbursement({
                nRemainingVouchers: props?.nRemainingVouchers ?? 1,
                startPrice: [100, 1],
                endPrice: [140, 1]
            })

            const voucherId0 = 0
            const voucherAddr0 = Address.dummy(false, voucherId0)
            const voucherDatum0 = new IntData(voucherId0)
            const voucher0 = makeVoucher({
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
                    reimbursement: reimbursement0,
                    redeemer: new IntData(0),
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
                        value: new Value(0, makeDvpTokens(expectedReim0))
                    })
            }

            return scb
        }

        it("succeeds if the number of remaining vouchers and tokens in the reimbursement output is correct", () => {
            configureContext().use((ctx) => {
                main.eval({
                    $scriptContext: ctx,
                    $datum: reimbursement0,
                    _: new IntData(0)
                })
            })
        })

        it("throws an error if not signed by the correct agent", () => {
            configureContext({ signingAgent: PubKeyHash.dummy(11) }).use(
                (ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: reimbursement0,
                            _: new IntData(0)
                        })
                    })
                }
            )
        })

        it("throws an error if less than the expected number of DVP tokens remain in the reimbursement output", () => {
            configureContext({ nRemainingTokens: 40_000 }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        $datum: reimbursement0,
                        _: new IntData(0)
                    })
                })
            })
        })

        it("throws an error if more than the expected number of DVP tokens remain in the reimbursement output", () => {
            configureContext({ nRemainingTokens: 100_000 }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        $datum: reimbursement0,
                        _: new IntData(0)
                    })
                })
            })
        })

        it("throws an error if the number of remaining vouchers in the reimbursement datum didn't decrement by the number of actually burned vouchers", () => {
            configureContext({ nRemainingVouchers: 2 }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        $datum: reimbursement0,
                        _: new IntData(0)
                    })
                })
            })
        })

        it("throws an error if the period id of the reimbursement output changes", () => {
            configureContext({ outputPeriodId: 1 }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        $datum: reimbursement0,
                        _: new IntData(0)
                    })
                })
            })
        })
    })
})
