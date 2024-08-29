import { describe, it } from "node:test";
import { DUMMY_SUPPLY, allScripts, makeSupplyValidatorSpendingContext } from "./utils";
import { strictEqual } from "node:assert";
import { Address, ValidatorHash } from "@helios-lang/ledger";
import context from "pbg-token-validators-test-context";

describe("Addresses", () => {
    it("metadata", () => {
        const res = context.Addresses.metadata.eval({})
        const expected = Address.fromHash(false, context.metadata_validator.$hash)

        strictEqual(res.toBech32(), expected.toBech32())
    })

    it("assets", () => {
        const res = context.Addresses.assets.eval({})
        const expected = Address.fromHash(false, context.assets_validator.$hash)

        strictEqual(res.toBech32(), expected.toBech32())
    })

    it("config", () => {
        const res = context.Addresses.config.eval({})
        const expected = Address.fromHash(false, context.config_validator.$hash)

        strictEqual(res.toBech32(), expected.toBech32())
    })

    it("portfolio", () => {
        const res = context.Addresses.portfolio.eval({})
        const expected = Address.fromHash(false, context.portfolio_validator.$hash)

        strictEqual(res.toBech32(), expected.toBech32())
    })

    it("price", () => {
        const res = context.Addresses.price.eval({})
        const expected = Address.fromHash(false, context.price_validator.$hash)

        strictEqual(res.toBech32(), expected.toBech32())
    })

    it("reimbursement", () => {
        const res = context.Addresses.reimbursement.eval({})
        const expected = Address.fromHash(false, context.reimbursement_validator.$hash)

        strictEqual(res.toBech32(), expected.toBech32())
    })

    it("supply", () => {
        const res = context.Addresses.supply.eval({})
        const expected = Address.fromHash(false, context.supply_validator.$hash)

        strictEqual(res.toBech32(), expected.toBech32())
    })

    const ctx = makeSupplyValidatorSpendingContext({supply: DUMMY_SUPPLY})

    allScripts.forEach(currentScript => {
        it(`vault in ${currentScript}`, () => {
            const res = context.Addresses.vault.eval({
                $currentScript: currentScript,
                $scriptContext: ctx
            })

            const expected = Address.fromHash(false, new ValidatorHash(context.fund_policy.$hash.bytes))
        
            strictEqual(res.toBech32(), expected.toBech32())
        })
    })

    it("voucher", () => {
        const res = context.Addresses.voucher.eval({})
        const expected = Address.fromHash(false, context.voucher_validator.$hash)

        strictEqual(res.toBech32(), expected.toBech32())
    })
})