import { describe, it } from "node:test"
import contract from "pbg-token-validators-test-context"
import { ScriptContextBuilder } from "./tx"
import { RatioType } from "./data"
import { throws } from "node:assert"
import { ByteArrayData, ListData } from "@helios-lang/uplc"

const { main } = contract.benchmark_delegate

describe("benchmark_delegate::main", () => {
    const configureContext = (props?: { redeemer?: RatioType }) => {
        return new ScriptContextBuilder().observeBenchmark({
            redeemer: props?.redeemer
        })
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
            })
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
            })
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
            })
        })
    })

    it("throws an error if the redeemer is a list with two equal byte arrays", () => {
        configureContext().use((ctx) => {
            throws(() => {
                main.evalUnsafe({
                    $scriptContext: ctx,
                    benchmark_price: new ListData([
                        new ByteArrayData(""),
                        new ByteArrayData("")
                    ])
                })
            })
        })
    })
})
