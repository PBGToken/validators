import { strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import {
    makeCertifyingPurpose,
    makeDeregistrationDCert
} from "@helios-lang/ledger"
import { makeByteArrayData, makeListData } from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"
import { MAX_SCRIPT_SIZE } from "./constants"
import { RatioType } from "./data"
import { ScriptContextBuilder } from "./tx"

const { main } = contract.benchmark_delegate

describe("benchmark_delegate::main", () => {
    describe("Rewarding purpose", () => {
        const configureContext = (props?: { redeemer?: RatioType }) => {
            const ctx = new ScriptContextBuilder().observeBenchmark({
                redeemer: props?.redeemer,
                isMainPurpose: true
            })

            return ctx
        }

        it("succeeds if the denominator is equal to the numerator", () => {
            const redeemer: RatioType = [1, 1]

            configureContext({ redeemer }).use((ctx) => {
                main.eval({
                    $scriptContext: ctx,
                    benchmark_price: redeemer
                })
            })
        })

        it("throws an error if denominator is equal to 0", () => {
            const redeemer: RatioType = [0, 0]

            configureContext({ redeemer }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        benchmark_price: redeemer
                    })
                }, /bottom of price ratio must be positive/)
            })
        })

        it("throws an error if denominator is negative", () => {
            const redeemer: RatioType = [-1, -1]

            configureContext({ redeemer }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        benchmark_price: redeemer
                    })
                }, /bottom of price ratio must be positive/)
            })
        })

        it("throws an error if the denominator isn't equal to the numerator", () => {
            const redeemer: RatioType = [2, 1]

            configureContext({ redeemer }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        benchmark_price: redeemer
                    })
                }, /top not equal to bottom/)
            })
        })

        it("throws an error if the redeemer is a list with two equal byte arrays", () => {
            configureContext().use((ctx) => {
                throws(() => {
                    main.evalUnsafe({
                        $scriptContext: ctx,
                        benchmark_price: makeListData([
                            makeByteArrayData(""),
                            makeByteArrayData("")
                        ])
                    })
                }, /expected IntData/)
            })
        })
    })

    describe("Certifying purpose", () => {
        const configureContext = (props?: { redeemer?: RatioType }) => {
            const ctx = new ScriptContextBuilder().observeBenchmark({
                redeemer: props?.redeemer
            })

            ctx.purpose = makeCertifyingPurpose(
                makeDeregistrationDCert(contract.benchmark_delegate.$hash)
            )

            return ctx
        }

        it("throws an error for Deregister Certifying purpose", () => {
            configureContext().use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        benchmark_price: [1n, 1n]
                    })
                }, /can't use benchmark delegate in DCert action/)
            })
        })
    })
})

describe("benchmark_delegate metrics", () => {
    const program = contract.benchmark_delegate.$hash.context.program

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
