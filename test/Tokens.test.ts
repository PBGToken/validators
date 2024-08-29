import { strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import context from "pbg-token-validators-test-context"
import { allScripts, DUMMY_CONFIG, DUMMY_SUPPLY, makeSupplyValidatorSpendingContext, policy } from "./utils"
import { AssetClass, Assets, MintingPolicyHash } from "@helios-lang/ledger"
import { encodeUtf8, hexToBytes } from "@helios-lang/codec-utils"

const scriptContext = makeSupplyValidatorSpendingContext({supply: DUMMY_SUPPLY, config: DUMMY_CONFIG})

describe("Tokens policy", () => {
    it("direct_policy", () => {
        const res = context.Tokens.direct_policy.eval({})

        strictEqual(res.toHex(), policy.toHex())
    })

    it("indirect_policy", () => {
        const res = context.Tokens.indirect_policy.eval({
            $scriptContext: scriptContext
        })

        strictEqual(res.toHex(), policy.toHex())
    })

    allScripts.forEach(currentScript => {
        it(`policy in ${currentScript}`, () => {
            const res = context.Tokens.policy.eval({
                $currentScript: currentScript,
                $scriptContext: scriptContext
            })

            strictEqual(res.toHex(), policy.toHex())
        })
    })
})

allScripts.forEach(currentScript => {
    describe(`Tokens asset classes in ${currentScript}`, () => {
        it("dvp_token", () => {
            const res = context.Tokens.dvp_token.eval({
                $scriptContext: scriptContext,
                $currentScript: currentScript
            })

            const expected = new AssetClass(policy, hexToBytes("0014df10"))
            strictEqual(res.toFingerprint(), expected.toFingerprint())
        })
    
        it("metadata", () => {
            const res = context.Tokens.metadata.eval({
                $scriptContext: scriptContext,
                $currentScript: currentScript
            })

            const expected = new AssetClass(policy, hexToBytes("000643b0"))
            strictEqual(res.toFingerprint(), expected.toFingerprint())
        })

        it("config", () => {
            const res = context.Tokens.config.eval({
                $scriptContext: scriptContext,
                $currentScript: currentScript
            })

            const expected = new AssetClass(policy, encodeUtf8("config"))
            strictEqual(res.toFingerprint(), expected.toFingerprint())
        })

        it("portfolio", () => {
            const res = context.Tokens.portfolio.eval({
                $scriptContext: scriptContext,
                $currentScript: currentScript
            })

            const expected = new AssetClass(policy, encodeUtf8("portfolio"))
            strictEqual(res.toFingerprint(), expected.toFingerprint())
        })

        it("price", () => {
            const res = context.Tokens.price.eval({
                $scriptContext: scriptContext,
                $currentScript: currentScript
            })

            const expected = new AssetClass(policy, encodeUtf8("price"))
            strictEqual(res.toFingerprint(), expected.toFingerprint())
        })

    
        it("supply", () => {
            const res = context.Tokens.supply.eval({
                $scriptContext: scriptContext,
                $currentScript: currentScript
            })

            const expected = new AssetClass(policy, encodeUtf8("supply"))
            strictEqual(res.toFingerprint(), expected.toFingerprint())
        })

        it("assets 10", () => {
            const res = context.Tokens.assets.eval({
                id: 10,
                $scriptContext: scriptContext,
                $currentScript: currentScript
            })

            const expected = new AssetClass(policy, encodeUtf8("assets 10"))
            strictEqual(res.toFingerprint(), expected.toFingerprint())
        })

        it("reimbursement 10", () => {
            const res = context.Tokens.reimbursement.eval({
                id: 10,
                $scriptContext: scriptContext,
                $currentScript: currentScript
            })

            const expected = new AssetClass(policy, encodeUtf8("reimbursement 10"))
            strictEqual(res.toString(), expected.toString())
        })

        it("voucher ref 10", () => {
            const res = context.Tokens.voucher_ref_token.eval({
                id: 10,
                $scriptContext: scriptContext,
                $currentScript: currentScript
            })

            const expected = new AssetClass(policy, hexToBytes("000643b0").concat(encodeUtf8("voucher 10")))
            strictEqual(res.toFingerprint(), expected.toFingerprint())
        })

        it("voucher nft 10", () => {
            const res = context.Tokens.voucher_user_nft.eval({
                id: 10,
                $scriptContext: scriptContext,
                $currentScript: currentScript
            })

            const expected = new AssetClass(policy, hexToBytes("000de140").concat(encodeUtf8("voucher 10")))
            strictEqual(res.toFingerprint(), expected.toFingerprint())
        })
    })
})

const ctxWithWrongMinted = makeSupplyValidatorSpendingContext({
    supply: DUMMY_SUPPLY,
    config: DUMMY_CONFIG,
    minted: new Assets([[new MintingPolicyHash([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27]), []]])
})

const ctxWithDvpTokensMinted = makeSupplyValidatorSpendingContext({
    supply: DUMMY_SUPPLY,
    config: DUMMY_CONFIG,
   minted: new Assets([[policy, [[hexToBytes("0014df10"), 1_000_000]]]])
})

const ctxWithAssetTokenMinted = makeSupplyValidatorSpendingContext({
    supply: DUMMY_SUPPLY,
    config: DUMMY_CONFIG,
    minted: new Assets([[policy, [[encodeUtf8("assets 10"), 1]]]])
})

const ctxWithAssetTokenAndDvpTokensMinted = makeSupplyValidatorSpendingContext({
    supply: DUMMY_SUPPLY,
    config: DUMMY_CONFIG,
    minted: new Assets([[policy, [[encodeUtf8("assets 10"), 1], [hexToBytes("0014df10"), 1_000_000]]]])
})

allScripts.forEach(currentScript => {
    describe(`Tokens::get_minted in ${currentScript}`, () => {
        it("returns empty map if nothing is minted", () => {
            const res = context.Tokens.get_minted.eval({
                $currentScript: currentScript,
                $scriptContext: scriptContext
            })
            
            strictEqual(res.size, 0)
        })

        it("returns empty map if something else is minted", () => {
            const res = context.Tokens.get_minted.eval({
                $currentScript: currentScript,
                $scriptContext: ctxWithWrongMinted
            })
            
            strictEqual(res.size, 0)
        })

        it("ok for some dvp_tokens minted", () => {
            const res = context.Tokens.get_minted.eval({
                $currentScript: currentScript,
                $scriptContext: ctxWithDvpTokensMinted
            })

            strictEqual(res.size, 1)
        })
    })

    describe(`Tokens::nothing_minted in ${currentScript}`, () => {
        it("true if nothing minted", () => {
            const res = context.Tokens.nothing_minted.eval({
                $currentScript: currentScript,
                $scriptContext: scriptContext
            })

            strictEqual(res, true)
        })

        it("true if something else is minted", () => {
            const res = context.Tokens.nothing_minted.eval({
                $currentScript: currentScript,
                $scriptContext: ctxWithWrongMinted
            })

            strictEqual(res, true)
        })

        it("false if dvp tokens are minted", () => {
            const res = context.Tokens.nothing_minted.eval({
                $currentScript: currentScript,
                $scriptContext: ctxWithDvpTokensMinted
            })

            strictEqual(res, false)
        })
    })

    describe(`Tokens::minted_only_dvp_tokens in ${currentScript}`, () => {
        it("true of dvp tokens are minted", () => {
            const res = context.Tokens.minted_only_dvp_tokens.eval({
                $currentScript: currentScript,
                $scriptContext: ctxWithDvpTokensMinted
            })

            strictEqual(res, true)
        })

        it("true if nothing minted", () => {
            const res = context.Tokens.minted_only_dvp_tokens.eval({
                $currentScript: currentScript,
                $scriptContext: scriptContext
            })

            strictEqual(res, true)
        })

        it("false if asset token minted", () => {
            const res = context.Tokens.minted_only_dvp_tokens.eval({
                $currentScript: currentScript,
                $scriptContext: ctxWithAssetTokenMinted
            })

            strictEqual(res, false)
        })

        it("false if dvp tokens and asset token minted", () => {
            const res = context.Tokens.minted_only_dvp_tokens.eval({
                $currentScript: currentScript,
                $scriptContext: ctxWithAssetTokenAndDvpTokensMinted
            })

            strictEqual(res, false)
        })
    })
})