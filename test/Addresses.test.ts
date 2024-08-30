import { strictEqual } from "node:assert"
import { describe, it } from "node:test"
import contract from "pbg-token-validators-test-context"
import { Addresses, scripts } from "./constants"
import { spendSupply } from "./tx"
import { makeSupply } from "./data"
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
            metadata.eval({}).toBech32(),
            Addresses.metadataValidator.toBech32()
        )
    })

    it("assets", () => {
        strictEqual(
            assets.eval({}).toBech32(),
            Addresses.assetsValidator.toBech32()
        )
    })

    it("config", () => {
        strictEqual(
            config.eval({}).toBech32(),
            Addresses.configValidator.toBech32()
        )
    })

    it("portfolio", () => {
        strictEqual(
            portfolio.eval({}).toBech32(),
            Addresses.portfolioValidator.toBech32()
        )
    })

    it("price", () => {
        strictEqual(
            price.eval({}).toBech32(),
            Addresses.priceValidator.toBech32()
        )
    })

    it("reimbursement", () => {
        strictEqual(
            reimbursement.eval({}).toBech32(),
            Addresses.reimbursementValidator.toBech32()
        )
    })

    it("supply", () => {
        strictEqual(
            supply.eval({}).toBech32(),
            Addresses.supplyValidator.toBech32()
        )
    })

    const ctx = spendSupply({ supply: makeSupply({}) })

    it("vault", () => {
        scripts.forEach((currentScript) => {
            strictEqual(
                vault
                    .eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    })
                    .toBech32(),
                Addresses.vault.toBech32()
            )
        })
    })

    it("voucher", () => {
        strictEqual(
            voucher.eval({}).toBech32(),
            Addresses.voucherValidator.toBech32()
        )
    })
})
