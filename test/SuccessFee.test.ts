import { PermissiveType } from "@helios-lang/contract-utils"
import { strictEqual } from "node:assert"
import { describe, it } from "node:test"
import context from "pbg-token-validators-test-context"

describe("apply_internal", () => {
    const apply_internal = context.SuccessFeeModule.apply_internal

    it("0 for alpha < sigma", () => {
        const res = apply_internal.eval({
            alpha: 1.5,
            sigma: 1.51,
            c: 0.3,
            next: []
        })

        strictEqual(res, 0.0)
    })

    it("simple fraction if no next steps", () => {
        const res = apply_internal.eval({
            alpha: 1.5,
            sigma: 1.2,
            c: 0.5,
            next: []
        })

        strictEqual(res, 0.15)
    })

    it("whitepaper example", () => {
        const res = apply_internal.eval({
            alpha: 1.5,
            sigma: 1.0,
            c: 0,
            next: [
                {sigma: 1.05, c: 0.3}
            ]
        })

        strictEqual(res, 0.135)
    })
})

describe("is_valid_internal", () => {
    const is_valid_internal = context.SuccessFeeModule.is_valid_internal

    it("valid for sigma 1.1 and c 0.5", () => {
        const res = is_valid_internal.eval({
            sigma: 1.1,
            c: 0.5,
            next: []
        })

        strictEqual(res, true)
    })

    it("invalid for sigma < 1", () => {
        const res = is_valid_internal.eval({
            sigma: 0.99,
            c: 0.5,
            next: []
        })

        strictEqual(res, false)
    })

    it("invalid for sigma > 10", () => {
        const res = is_valid_internal.eval({
            sigma: 10.99,
            c: 0.5,
            next: []
        })

        strictEqual(res, false)
    })

    it("invalid for c < 0", () => {
        const res = is_valid_internal.eval({
            sigma: 1.1,
            c: -0.0001,
            next: []
        })

        strictEqual(res, false)
    })

    it("invalid for c > 1", () => {
        const res = is_valid_internal.eval({
            sigma: 1.1,
            c: 1.0001,
            next: []
        })

        strictEqual(res, false)
    })

    it("valid for multiple valid steps", () => {
        const res = is_valid_internal.eval({
            sigma: 1.1,
            c: 0.05,
            next: [{
                sigma: 1.2,
                c: 0.3
            }]
        })

        strictEqual(res, true)
    })

    it("invalid for other sigma < 1", () => {
        const res = is_valid_internal.eval({
            sigma: 1.1,
            c: 0.5,
            next: [{
                sigma: 0.99,
                c: 0
            }]
        })

        strictEqual(res, false)
    })

    it("invalid for other sigma > 10", () => {
        const res = is_valid_internal.eval({
            sigma: 1.1,
            c: 0.5,
            next: [{
                sigma: 10.11,
                c: 1
            }]
        })

        strictEqual(res, false)
    })

    it("invalid for other c < 0", () => {
        const res = is_valid_internal.eval({
            sigma: 1.1,
            c: 0.5,
            next: [{
                sigma: 1.11,
                c: -0.0001
            }]
        })

        strictEqual(res, false)
    })

    it("invalid for other non-monotonic sigma", () => {
        const res = is_valid_internal.eval({
            sigma: 1.1,
            c: 0.5,
            next: [{
                sigma: 1.099,
                c: 0
            }]
        })

        strictEqual(res, false)
    })

    it("invalid for duplicate sigma", () => {
        const res = is_valid_internal.eval({
            sigma: 1.1,
            c: 0.5,
            next: [{
                sigma: 1.10,
                c: 0
            }]
        })

        strictEqual(res, false)
    })
})

const castSuccessFee = context.SuccessFeeModule.SuccessFee
type SuccessFeeType = PermissiveType<typeof castSuccessFee>

describe("SuccessFee", () => {
    const successFee: SuccessFeeType = {
        c0: 0.0,
        steps: [
            {sigma: 1.05, c: 0.3}
        ]
    }

    it("SuccessFee::MAX_SUCCESS_FEE_STEPS", () => {
        const res = context.SuccessFeeModule["SuccessFee::MAX_SUCCESS_FEE_STEPS"].eval({})

        strictEqual(res, 10n)
    })
    
    describe("SuccessFee::apply", () => {
        const apply = context.SuccessFeeModule["SuccessFee::apply"]

        it("whitepaper example", () => {
            const res = apply.eval({
                self: successFee,
                alpha: 1.5
            })
    
            strictEqual(res, 0.135)
        })
    })
    
    describe("SuccessFee::is_valid", () => {
        const is_valid = context.SuccessFeeModule["SuccessFee::is_valid"]

        it("whitepaper example", () => {
            const res = is_valid.eval({
                self: successFee
            })

            strictEqual(res, true)
        })
    })
})