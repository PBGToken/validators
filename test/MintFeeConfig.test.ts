import { strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { IntData, ListData } from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"

describe("MintFeeConfig.apply()", () => {
    it("charges minimum if small amount of tokens are minted", () => {
        const fn = contract.ConfigModule["MintFeeConfig::apply"]
        const fee = fn.eval({
            self: {
                relative: 0.005,
                minimum: 20_000
            },
            n: 2_000_000
        })

        throws(() => {
            fn.evalUnsafe({
                self: new ListData([]),
                n: new IntData(0n)
            })
        })

        strictEqual(fee, 20_000n)
    })
})
