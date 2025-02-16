import { strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import contract from "pbg-token-validators-test-context"
import {
    Addresses,
    directPolicyScripts,
    indirectPolicyScripts
} from "./constants"
import { ScriptContextBuilder } from "./tx"

const {
    assets,
    config,
    metadata,
    portfolio,
    price,
    reimbursement,
    supply,
    vault,
    voucher
} = contract.Addresses

describe("Addresses", () => {
    it("metadata", () => {
        strictEqual(
            metadata.eval({}).toString(),
            Addresses.metadataValidator.toBech32()
        )
    })

    it("assets", () => {
        strictEqual(
            assets.eval({}).toString(),
            Addresses.assetsValidator.toBech32()
        )
    })

    it("config", () => {
        strictEqual(
            config.eval({}).toString(),
            Addresses.configValidator.toBech32()
        )
    })

    it("portfolio", () => {
        strictEqual(
            portfolio.eval({}).toString(),
            Addresses.portfolioValidator.toBech32()
        )
    })

    it("price", () => {
        strictEqual(
            price.eval({}).toString(),
            Addresses.priceValidator.toBech32()
        )
    })

    it("reimbursement", () => {
        strictEqual(
            reimbursement.eval({}).toString(),
            Addresses.reimbursementValidator.toBech32()
        )
    })

    it("supply", () => {
        strictEqual(
            supply.eval({}).toString(),
            Addresses.supplyValidator.toBech32()
        )
    })

    it("voucher", () => {
        strictEqual(
            voucher.eval({}).toString(),
            Addresses.voucherValidator.toBech32()
        )
    })
})

describe("Addresses::vault", () => {
    describe("@ validators that have direct access to policy", () => {
        it("matches the expected off-chain value", () => {
            new ScriptContextBuilder().use((ctx) => {
                directPolicyScripts.forEach((currentScript) => {
                    strictEqual(
                        vault
                            .eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                            .toString(),
                        Addresses.vault.toBech32()
                    )
                })
            })
        })
    })

    describe("@ validators that don't have direct access to policy", () => {
        it("matches the expected off-chain value if a UTxO is spent which contains a single token of the associated minting policy", () => {
            new ScriptContextBuilder()
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    indirectPolicyScripts.forEach((currentScript) => {
                        strictEqual(
                            vault
                                .eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx
                                })
                                .toString(),
                            Addresses.vault.toBech32()
                        )
                    })
                })
        })

        it("throws an error if no UTxO is spent containing a single token of the associated minting policy", () => {
            new ScriptContextBuilder().use((ctx) => {
                indirectPolicyScripts.forEach((currentScript) => {
                    throws(() => {
                        vault.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })
                    }, /doesn't contain a singleton asset class/)
                })
            })
        })
    })
})
