import { strictEqual } from "node:assert"
import { describe, it } from "node:test"
import { IntData, ListData } from "@helios-lang/uplc"
import context from "pbg-token-validators-test-context"

const calc_alpha = context.ReimbursementModule["Reimbursement::calc_alpha"]

describe("Reimbursement::calc_alpha", () => {
    it("correct ratio division with non-default end_price (typesafe eval)", () => {
        const alpha = calc_alpha.eval({
            self: {
                n_remaining_vouchers: 0,
                start_price: [100, 1],
                end_price: [200_000_000, 1_000_000],
                success_fee: {
                    c0: 0,
                    steps: []
                }
            },
            end_price: [300_000_000n, 1_000_000n]
        })

        strictEqual(alpha, 3.0)
    })

    it("correct ratio division with non-default end_price (evalUnsafe)", () => {
        const self = context.ReimbursementModule.Reimbursement.toUplcData({
            n_remaining_vouchers: 0,
            start_price: [100, 1],
            end_price: [200_000_000, 1_000_000],
            success_fee: {
                c0: 0,
                steps: []
            }
        })

        const endPrice = new ListData([new IntData(300_000_000), new IntData(1_000_000)])

        const alpha = calc_alpha.evalUnsafe({
            self: self,
            end_price: endPrice
        })

        strictEqual(alpha.toString(), "3000000")
    })

    it("correct ratio division with default end_price (typesafe eval)", () => {
        const alpha = calc_alpha.eval({
            self: {
                n_remaining_vouchers: 0,
                start_price: [100, 1],
                end_price: [200_000_000, 1_000_000],
                success_fee: {
                    c0: 0,
                    steps: []
                }
            }
        })

        strictEqual(alpha, 2.0)
    })

    it("correct ratio division with default end_price (evalUnsafe)", () => {
        const self = context.ReimbursementModule.Reimbursement.toUplcData({
            n_remaining_vouchers: 0,
            start_price: [100, 1],
            end_price: [200_000_000, 1_000_000],
            success_fee: {
                c0: 0,
                steps: []
            }
        })

        const alpha = calc_alpha.evalUnsafe({
            self: self
        })

        strictEqual(alpha.toString(), "2000000")
    })
})