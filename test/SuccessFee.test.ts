import { strictEqual } from "node:assert"
import { describe, it } from "node:test"
import contract from "pbg-token-validators-test-context"
import { makeSuccessFee } from "./data"

const {
    apply_internal,
    is_valid_internal,
    "SuccessFee::MAX_SUCCESS_FEE_STEPS": MAX_SUCCESS_FEE_STEPS,
    "SuccessFee::apply": apply,
    "SuccessFee::is_valid": is_valid
} = contract.SuccessFeeModule

describe("SuccessFeeModule::apply_internal", () => {
    it("0 for alpha < sigma", () => {
        strictEqual(
            apply_internal.eval({
                alpha: 1.5,
                sigma: 1.51,
                c: 0.3,
                next: []
            }),
            0.0
        )
    })

    it("simple fraction if no next steps", () => {
        strictEqual(
            apply_internal.eval({
                alpha: 1.5,
                sigma: 1.2,
                c: 0.5,
                next: []
            }),
            0.15
        )
    })

    it("whitepaper example", () => {
        strictEqual(
            apply_internal.eval({
                alpha: 1.5,
                sigma: 1.0,
                c: 0,
                next: [{ sigma: 1.05, c: 0.3 }]
            }),
            0.135
        )
    })
})

describe("SuccessFeeModule::is_valid_internal", () => {
    it("valid for sigma 1.1 and c 0.5", () => {
        strictEqual(
            is_valid_internal.eval({
                sigma: 1.1,
                c: 0.5,
                next: []
            }),
            true
        )
    })

    it("invalid for sigma < 1", () => {
        strictEqual(
            is_valid_internal.eval({
                sigma: 0.99,
                c: 0.5,
                next: []
            }),
            false
        )
    })

    it("invalid for sigma > 10", () => {
        strictEqual(
            is_valid_internal.eval({
                sigma: 10.99,
                c: 0.5,
                next: []
            }),
            false
        )
    })

    it("invalid for c < 0", () => {
        strictEqual(
            is_valid_internal.eval({
                sigma: 1.1,
                c: -0.0001,
                next: []
            }),
            false
        )
    })

    it("invalid for c > 1", () => {
        strictEqual(
            is_valid_internal.eval({
                sigma: 1.1,
                c: 1.0001,
                next: []
            }),
            false
        )
    })

    it("valid for multiple valid steps", () => {
        strictEqual(
            is_valid_internal.eval({
                sigma: 1.1,
                c: 0.05,
                next: [
                    {
                        sigma: 1.2,
                        c: 0.3
                    }
                ]
            }),
            true
        )
    })

    it("invalid for other sigma < 1", () => {
        strictEqual(
            is_valid_internal.eval({
                sigma: 1.1,
                c: 0.5,
                next: [
                    {
                        sigma: 0.99,
                        c: 0
                    }
                ]
            }),
            false
        )
    })

    it("invalid for other sigma > 10", () => {
        strictEqual(
            is_valid_internal.eval({
                sigma: 1.1,
                c: 0.5,
                next: [
                    {
                        sigma: 10.11,
                        c: 1
                    }
                ]
            }),
            false
        )
    })

    it("invalid for other c < 0", () => {
        strictEqual(
            is_valid_internal.eval({
                sigma: 1.1,
                c: 0.5,
                next: [
                    {
                        sigma: 1.11,
                        c: -0.0001
                    }
                ]
            }),
            false
        )
    })

    it("invalid for other non-monotonic sigma", () => {
        strictEqual(
            is_valid_internal.eval({
                sigma: 1.1,
                c: 0.5,
                next: [
                    {
                        sigma: 1.099,
                        c: 0
                    }
                ]
            }),
            false
        )
    })

    it("invalid for duplicate sigma", () => {
        strictEqual(
            is_valid_internal.eval({
                sigma: 1.1,
                c: 0.5,
                next: [
                    {
                        sigma: 1.1,
                        c: 0
                    }
                ]
            }),
            false
        )
    })
})

describe("SuccessFeeModule::SuccessFee::MAX_SUCCESS_FEE_STEPS", () => {
    it("equal to 10", () => {
        strictEqual(MAX_SUCCESS_FEE_STEPS.eval({}), 10n)
    })
})

describe("SuccessFeeModule::SuccessFee::apply", () => {
    const self = makeSuccessFee()

    it("matches whitepaper calculation example", () => {
        strictEqual(
            apply.eval({
                self,
                alpha: 1.5
            }),
            0.135
        )
    })
})

describe("SuccessFeeModule::SuccessFee::is_valid", () => {
    const self = makeSuccessFee()

    it("returns true for coefficients used in whitepaper calculation example", () => {
        strictEqual(
            is_valid.eval({
                self
            }),
            true
        )
    })
})