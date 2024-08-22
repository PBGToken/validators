import { strictEqual } from "node:assert";
import { describe, it } from "node:test";
import context from "pbg-token-validators-test-context";

describe("MintFeeConfig.apply()", () => {
    it("charges minimum if small amount of tokens are minted", () => {
        const fee = context.ConfigModule["MintFeeConfig::apply"].eval({
            self: {
                relative: 0.005,
                minimum: 20_000
            },
            n: 2_000_000
        })

        strictEqual(fee, 20_000n)
    })
})