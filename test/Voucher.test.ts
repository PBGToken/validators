import { deepEqual, strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { Address, TxOutput, TxOutputDatum, Value } from "@helios-lang/ledger"
import { IntData } from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"
import { scripts } from "./constants"
import { makePrice, makeVoucher } from "./data"
import { ScriptContextBuilder } from "./tx"
import {
    makeConfigToken,
    makeDvpTokens,
    makeVoucherPair,
    makeVoucherRefToken,
    makeVoucherUserToken
} from "./tokens"


const {
    "Voucher::get_current": get_current,
    "Voucher::find_input": find_input,
    "Voucher::find_output": find_output,
    "Voucher::find_return": find_return,
    validate_minted_vouchers,
    validate_burned_vouchers
} = contract.VoucherModule

describe("Voucher::get_current", () => {
    const voucher = makeVoucher()

    it("ok if current input is a voucher", () => {
        new ScriptContextBuilder()
            .addVoucherInput({ id: 123, redeemer: new IntData(0) })
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    deepEqual(
                        get_current.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }),
                        [123n, voucher]
                    )
                })
            })
    })

    it("fails if current input doesn't contain a voucher token", () => {
        new ScriptContextBuilder()
            .addVoucherInput({
                token: makeConfigToken(),
                redeemer: new IntData(0)
            })
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    throws(() => {
                        get_current.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })
                    })
                })
            })
    })
})

describe("Voucher::find_input", () => {
    const voucher = makeVoucher()

    it("ok for correctly spent voucher UTxO", () => {
        new ScriptContextBuilder()
            .addVoucherInput({ id: 123, voucher })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    deepEqual(
                        find_input.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            id: 123
                        }),
                        voucher
                    )
                })
            })
    })

    it("fails if id not found", () => {
        new ScriptContextBuilder()
            .addVoucherInput({ id: 123, voucher })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    throws(() => {
                        find_input.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            id: 124
                        })
                    })
                })
            })
    })

    it("fails if voucher UTxO is at wrong address", () => {
        new ScriptContextBuilder()
            .addVoucherInput({
                id: 123,
                voucher,
                address: Address.dummy(false)
            })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    throws(() => {
                        find_input.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            id: 123
                        })
                    })
                })
            })
    })
})

describe("Voucher::find_output", () => {
    const voucher = makeVoucher()

    it("ok for correctly spent voucher UTxO", () => {
        new ScriptContextBuilder()
            .addVoucherOutput({ id: 123, voucher })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    deepEqual(
                        find_output.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            id: 123
                        }),
                        voucher
                    )
                })
            })
    })

    it("fails if id not found", () => {
        new ScriptContextBuilder()
            .addVoucherOutput({ id: 123, voucher })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    throws(() => {
                        find_output.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            id: 124
                        })
                    })
                })
            })
    })

    it("fails if voucher UTxO is at wrong address", () => {
        new ScriptContextBuilder()
            .addVoucherOutput({
                id: 123,
                voucher,
                address: Address.dummy(false)
            })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    throws(() => {
                        find_output.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            id: 123
                        })
                    })
                })
            })
    })
})

describe("Voucher::find_return", () => {
    const address = Address.dummy(false, 5)
    const datum = new IntData(0)
    const voucher = makeVoucher({
        address,
        datum
    })

    it("is able to find matching return output", () => {
        new ScriptContextBuilder()
            .addDummyOutputs(10)
            .addOutput(
                new TxOutput(
                    address,
                    new Value(2_345_678),
                    TxOutputDatum.Inline(datum)
                )
            )
            .use((ctx) => {
                const actual = find_return.eval({
                    self: voucher,
                    $scriptContext: ctx
                })

                strictEqual(actual.value.lovelace, 2_345_678n)
            })
    })

    it("fails if no datum", () => {
        new ScriptContextBuilder()
            .addDummyOutputs(10)
            .addOutput(new TxOutput(address, new Value(2_345_678)))
            .use((ctx) => {
                throws(() => {
                    find_return.eval({
                        self: voucher,
                        $scriptContext: ctx
                    })
                })
            })
    })

    it("fails if at wrong address", () => {
        new ScriptContextBuilder()
            .addDummyOutputs(10)
            .addOutput(
                new TxOutput(Address.dummy(false, 6), new Value(2_345_678))
            )
            .use((ctx) => {
                throws(() => {
                    find_return.eval({
                        self: voucher,
                        $scriptContext: ctx
                    })
                })
            })
    })
})

describe("validate_minted_vouchers", () => {
    const priceRatio = { top: 200, bottom: 1 }
    const currentPrice = makePrice(priceRatio)
    const periodId = 0
    const lastVoucherId = -1

    it("ok for a single voucher minted", () => {
        const voucherId = 0
        const voucher = makeVoucher({
            price: priceRatio,
            periodId,
            tokens: 1000
        })

        new ScriptContextBuilder()
            .mint({
                assets: makeVoucherPair(voucherId).add(makeDvpTokens(1000))
            })
            .addVoucherOutput({ id: voucherId, voucher })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    deepEqual(
                        validate_minted_vouchers.eval({
                            $scriptContext: ctx,
                            $currentScript: currentScript,
                            price: currentPrice.value,
                            period_id: periodId,
                            last_voucher_id: lastVoucherId
                        }),
                        [1, 0]
                    )
                })
            })
    })

    it("ok for 3 vouchers minted", () => {
        const voucherId0 = 0
        const voucher0 = makeVoucher({
            price: priceRatio,
            periodId,
            tokens: 300
        })

        const voucherId1 = 1
        const voucher1 = makeVoucher({
            price: priceRatio,
            periodId,
            tokens: 300
        })

        const voucherId2 = 2
        const voucher2 = makeVoucher({
            price: priceRatio,
            periodId,
            tokens: 400
        })

        new ScriptContextBuilder()
            .mint({
                assets: makeVoucherPair(voucherId0)
                    .add(makeVoucherPair(voucherId1))
                    .add(makeVoucherPair(voucherId2))
                    .add(makeDvpTokens(1000))
            })
            .addVoucherOutput({ id: voucherId0, voucher: voucher0 })
            .addVoucherOutput({ id: voucherId1, voucher: voucher1 })
            .addVoucherOutput({ id: voucherId2, voucher: voucher2 })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    deepEqual(
                        validate_minted_vouchers.eval({
                            $scriptContext: ctx,
                            $currentScript: currentScript,
                            price: currentPrice.value,
                            period_id: periodId,
                            last_voucher_id: lastVoucherId
                        }),
                        [3, 2]
                    )
                })
            })
    })

    it("fails if one of the minted voucher has quantity not equaly to 1", () => {
        const voucherId0 = 0
        const voucher0 = makeVoucher({
            price: priceRatio,
            periodId,
            tokens: 300
        })

        const voucherId1 = 1
        const voucher1 = makeVoucher({
            price: priceRatio,
            periodId,
            tokens: 300
        })

        const voucherId2 = 2
        const voucher2 = makeVoucher({
            price: priceRatio,
            periodId,
            tokens: 400
        })

        new ScriptContextBuilder()
            .mint({
                assets: makeVoucherPair(voucherId0)
                    .add(makeVoucherPair(voucherId1))
                    .add(makeVoucherPair(voucherId2, 2))
                    .add(makeDvpTokens(1000))
            })
            .addVoucherOutput({ id: voucherId0, voucher: voucher0 })
            .addVoucherOutput({ id: voucherId1, voucher: voucher1 })
            .addVoucherOutput({ id: voucherId2, voucher: voucher2 })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    throws(() => {
                        validate_minted_vouchers.eval({
                            $scriptContext: ctx,
                            $currentScript: currentScript,
                            price: currentPrice.value,
                            period_id: periodId,
                            last_voucher_id: lastVoucherId
                        })
                    })
                })
            })
    })

    it("fails if corresponding user token not minted", () => {
        const voucherId = 0
        const voucher = makeVoucher({
            price: priceRatio,
            periodId,
            tokens: 1000
        })

        new ScriptContextBuilder()
            .mint({
                assets: makeVoucherRefToken(voucherId).add(makeDvpTokens(1000))
            })
            .addVoucherOutput({ id: voucherId, voucher })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    throws(() => {
                        validate_minted_vouchers.eval({
                            $scriptContext: ctx,
                            $currentScript: currentScript,
                            price: currentPrice.value,
                            period_id: periodId,
                            last_voucher_id: lastVoucherId
                        })
                    })
                })
            })
    })

    it("fails if corresponding user token minted more than once", () => {
        const voucherId = 0
        const voucher = makeVoucher({
            price: priceRatio,
            periodId,
            tokens: 1000
        })

        new ScriptContextBuilder()
            .mint({
                assets: makeVoucherRefToken(voucherId)
                    .add(makeVoucherUserToken(voucherId, 2))
                    .add(makeDvpTokens(1000))
            })
            .addVoucherOutput({ id: voucherId, voucher })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    throws(() => {
                        validate_minted_vouchers.eval({
                            $scriptContext: ctx,
                            $currentScript: currentScript,
                            price: currentPrice.value,
                            period_id: periodId,
                            last_voucher_id: lastVoucherId
                        })
                    })
                })
            })
    })

    it("fails if the number of tokens in the voucher datum is <= 0", () => {
        const voucherId = 0
        const voucher = makeVoucher({
            price: priceRatio,
            periodId,
            tokens: 0
        })

        new ScriptContextBuilder()
            .mint({
                assets: makeVoucherRefToken(voucherId)
                    .add(makeVoucherUserToken(voucherId))
                    .add(makeDvpTokens(1000))
            })
            .addVoucherOutput({ id: voucherId, voucher })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    throws(() => {
                        validate_minted_vouchers.eval({
                            $scriptContext: ctx,
                            $currentScript: currentScript,
                            price: currentPrice.value,
                            period_id: periodId,
                            last_voucher_id: lastVoucherId
                        })
                    })
                })
            })
    })

    it("fails if output isn't sent to voucher_validator address", () => {
        const voucherId = 0
        const voucher = makeVoucher({
            price: priceRatio,
            periodId,
            tokens: 1000
        })

        new ScriptContextBuilder()
            .mint({
                assets: makeVoucherRefToken(voucherId)
                    .add(makeVoucherUserToken(voucherId))
                    .add(makeDvpTokens(1000))
            })
            .addVoucherOutput({
                address: Address.dummy(false),
                id: voucherId,
                voucher
            })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    throws(() => {
                        validate_minted_vouchers.eval({
                            $scriptContext: ctx,
                            $currentScript: currentScript,
                            price: currentPrice.value,
                            period_id: periodId,
                            last_voucher_id: lastVoucherId
                        })
                    })
                })
            })
    })

    it("fails if voucher ref token isn't minted", () => {
        const voucherId = 0
        const voucher = makeVoucher({
            price: priceRatio,
            periodId,
            tokens: 1000
        })

        new ScriptContextBuilder()
            .mint({
                assets: makeVoucherUserToken(voucherId).add(makeDvpTokens(1000))
            })
            .addVoucherOutput({ id: voucherId, voucher })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    throws(() => {
                        validate_minted_vouchers.eval({
                            $scriptContext: ctx,
                            $currentScript: currentScript,
                            price: currentPrice.value,
                            period_id: periodId,
                            last_voucher_id: lastVoucherId
                        })
                    })
                })
            })
    })

    it("fails if voucher ref token is minted more than once", () => {
        const voucherId = 0
        const voucher = makeVoucher({
            price: priceRatio,
            periodId,
            tokens: 1000
        })

        new ScriptContextBuilder()
            .mint({
                assets: makeVoucherUserToken(voucherId)
                    .add(makeVoucherRefToken(voucherId, 2))
                    .add(makeDvpTokens(1000))
            })
            .addVoucherOutput({ id: voucherId, voucher })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    throws(() => {
                        validate_minted_vouchers.eval({
                            $scriptContext: ctx,
                            $currentScript: currentScript,
                            price: currentPrice.value,
                            period_id: periodId,
                            last_voucher_id: lastVoucherId
                        })
                    })
                })
            })
    })

    it("fails new ids aren't consecutive", () => {
        const voucherId0 = 0
        const voucher0 = makeVoucher({
            price: priceRatio,
            periodId,
            tokens: 300
        })

        const voucherId1 = 1
        const voucher1 = makeVoucher({
            price: priceRatio,
            periodId,
            tokens: 300
        })

        const voucherId2 = 3
        const voucher2 = makeVoucher({
            price: priceRatio,
            periodId,
            tokens: 400
        })

        new ScriptContextBuilder()
            .mint({
                assets: makeVoucherPair(voucherId0)
                    .add(makeVoucherPair(voucherId1))
                    .add(makeVoucherPair(voucherId2))
                    .add(makeDvpTokens(1000))
            })
            .addVoucherOutput({ id: voucherId0, voucher: voucher0 })
            .addVoucherOutput({ id: voucherId1, voucher: voucher1 })
            .addVoucherOutput({ id: voucherId2, voucher: voucher2 })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    throws(() => {
                        validate_minted_vouchers.eval({
                            $scriptContext: ctx,
                            $currentScript: currentScript,
                            price: currentPrice.value,
                            period_id: periodId,
                            last_voucher_id: lastVoucherId
                        })
                    })
                })
            })
    })
})

describe("validate_burned_vouchers", () => {
    const periodId = 0

    it("ok for single voucher burned", () => {
        const voucherId = 0
        const voucher = makeVoucher({
            periodId
        })

        new ScriptContextBuilder()
            .mint({
                assets: makeVoucherPair(voucherId, -1).add(makeDvpTokens(-1000))
            })
            .addVoucherInput({ id: voucherId, voucher })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    strictEqual(
                        validate_burned_vouchers.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            period_id: periodId
                        }),
                        1n
                    )
                })
            })
    })

    it("ok for 3 voucher burned", () => {
        const voucherId0 = 0
        const voucherId1 = 1
        const voucherId2 = 2
        const voucher = makeVoucher({
            periodId
        })

        new ScriptContextBuilder()
            .mint({
                assets: makeVoucherPair(voucherId0, -1)
                    .add(makeVoucherPair(voucherId1, -1))
                    .add(makeVoucherPair(voucherId2, -1))
                    .add(makeDvpTokens(-1000))
            })
            .addVoucherInput({ id: voucherId0, voucher })
            .addVoucherInput({ id: voucherId1, voucher })
            .addVoucherInput({ id: voucherId2, voucher })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    strictEqual(
                        validate_burned_vouchers.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            period_id: periodId
                        }),
                        3n
                    )
                })
            })
    })

    it("fails if not exactly -1 minted", () => {
        const voucherId = 0
        const voucher = makeVoucher({
            periodId
        })

        new ScriptContextBuilder()
            .mint({ assets: makeVoucherPair(voucherId, -2) })
            .addVoucherInput({ id: voucherId, voucher })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    throws(() => {
                        validate_burned_vouchers.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            period_id: periodId
                        })
                    })
                })
            })
    })

    it("fails if period_id of 1 of 3 vouchers is wrong", () => {
        const voucherId0 = 0
        const voucherId1 = 1
        const voucherId2 = 2
        const voucher = makeVoucher({
            periodId
        })
        const voucherWrong = makeVoucher({
            periodId: periodId + 1
        })

        new ScriptContextBuilder()
            .mint({
                assets: makeVoucherPair(voucherId0, -1)
                    .add(makeVoucherPair(voucherId1, -1))
                    .add(makeVoucherPair(voucherId2, -1))
                    .add(makeDvpTokens(-1000))
            })
            .addVoucherInput({ id: voucherId0, voucher })
            .addVoucherInput({ id: voucherId1, voucher })
            .addVoucherInput({ id: voucherId2, voucher: voucherWrong })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    throws(() => {
                        validate_burned_vouchers.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            period_id: periodId
                        })
                    })
                })
            })
    })

    it("fails if not exactly -1 ref token minted", () => {
        const voucherId = 0
        const voucher = makeVoucher({
            periodId
        })

        new ScriptContextBuilder()
            .mint({
                assets: makeDvpTokens(-1000)
                    .add(makeVoucherUserToken(voucherId, -1))
                    .add(makeVoucherRefToken(voucherId, -2))
            })
            .addVoucherInput({ id: voucherId, voucher })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    throws(() => {
                        validate_burned_vouchers.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            period_id: periodId
                        })
                    })
                })
            })
    })

    it("fails if ref token not minted", () => {
        const voucherId = 0
        const voucher = makeVoucher({
            periodId
        })

        new ScriptContextBuilder()
            .mint({
                assets: makeDvpTokens(-1000).add(
                    makeVoucherUserToken(voucherId, -1)
                )
            })
            .addVoucherInput({ id: voucherId, voucher })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    throws(() => {
                        validate_burned_vouchers.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            period_id: periodId
                        })
                    })
                })
            })
    })

    it("fails if not exactly -1 user token minted", () => {
        const voucherId = 0
        const voucher = makeVoucher({
            periodId
        })

        new ScriptContextBuilder()
            .mint({
                assets: makeDvpTokens(-1000)
                    .add(makeVoucherRefToken(voucherId, -1))
                    .add(makeVoucherUserToken(voucherId, -2))
            })
            .addVoucherInput({ id: voucherId, voucher })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    throws(() => {
                        validate_burned_vouchers.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            period_id: periodId
                        })
                    })
                })
            })
    })

    it("fails if user token not minted", () => {
        const voucherId = 0
        const voucher = makeVoucher({
            periodId
        })

        new ScriptContextBuilder()
            .mint({
                assets: makeDvpTokens(-1000).add(
                    makeVoucherRefToken(voucherId, -1)
                )
            })
            .addVoucherInput({ id: voucherId, voucher })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    throws(() => {
                        validate_burned_vouchers.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            period_id: periodId
                        })
                    })
                })
            })
    })
})
