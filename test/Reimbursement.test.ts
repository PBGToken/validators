import { strictEqual } from "node:assert"
import { describe, it } from "node:test"
import { IntData, ListData } from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"

const { "Reimbursement::calc_alpha": calc_alpha } = contract.ReimbursementModule

describe("Reimbursement::calc_alpha", () => {
    it("correct ratio division with non-default end_price (typesafe eval)", () => {
        strictEqual(
            calc_alpha.eval({
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
            }),
            3.0
        )
    })

    it("correct ratio division with non-default end_price (evalUnsafe)", () => {
        const self = contract.ReimbursementModule.Reimbursement.toUplcData({
            n_remaining_vouchers: 0,
            start_price: [100, 1],
            end_price: [200_000_000, 1_000_000],
            success_fee: {
                c0: 0,
                steps: []
            }
        })

        const endPrice = new ListData([
            new IntData(300_000_000),
            new IntData(1_000_000)
        ])

        strictEqual(
            calc_alpha
                .evalUnsafe({
                    self: self,
                    end_price: endPrice
                })
                .toString(),
            "3000000"
        )
    })

    it("correct ratio division with default end_price (typesafe eval)", () => {
        strictEqual(
            calc_alpha.eval({
                self: {
                    n_remaining_vouchers: 0,
                    start_price: [100, 1],
                    end_price: [200_000_000, 1_000_000],
                    success_fee: {
                        c0: 0,
                        steps: []
                    }
                }
            }),
            2.0
        )
    })

    it("correct ratio division with default end_price (evalUnsafe)", () => {
        const self = contract.ReimbursementModule.Reimbursement.toUplcData({
            n_remaining_vouchers: 0,
            start_price: [100, 1],
            end_price: [200_000_000, 1_000_000],
            success_fee: {
                c0: 0,
                steps: []
            }
        })

        strictEqual(
            calc_alpha
                .evalUnsafe({
                    self
                })
                .toString(),
            "2000000"
        )
    })
})
