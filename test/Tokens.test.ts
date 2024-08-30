import { strictEqual } from "node:assert"
import { describe, it } from "node:test"
import { Assets, MintingPolicyHash } from "@helios-lang/ledger"
import contract from "pbg-token-validators-test-context"
import { policy, scripts } from "./constants"
import { spendSupply } from "./tx"
import { AssetClasses, makeAssetsToken, makeDvpTokens } from "./tokens"
import { makeConfig, makeSupply } from "./data"
const {
    assets,
    config,
    direct_policy,
    dvp_token,
    get_minted,
    indirect_policy,
    metadata,
    minted_only_dvp_tokens,
    nothing_minted,
    policy: policy_internal,
    portfolio,
    price,
    reimbursement,
    supply,
    voucher_ref_token,
    voucher_user_nft
} = contract.Tokens

const scriptContext = spendSupply({
    supply: makeSupply({}),
    config: makeConfig({})
})

describe("Tokens policy", () => {
    it("direct_policy", () => {
        strictEqual(direct_policy.eval({}).toHex(), policy.toHex())
    })

    it("indirect_policy", () => {
        strictEqual(
            indirect_policy
                .eval({
                    $scriptContext: scriptContext
                })
                .toHex(),
            policy.toHex()
        )
    })

    scripts.forEach((currentScript) => {
        it(`policy in ${currentScript}`, () => {
            strictEqual(
                policy_internal
                    .eval({
                        $currentScript: currentScript,
                        $scriptContext: scriptContext
                    })
                    .toHex(),
                policy.toHex()
            )
        })
    })
})

describe("Tokens asset classes", () => {
    it("dvp_token", () => {
        scripts.forEach((currentScript) => {
            strictEqual(
                dvp_token
                    .eval({
                        $scriptContext: scriptContext,
                        $currentScript: currentScript
                    })
                    .toFingerprint(),
                AssetClasses.dvpToken.toFingerprint()
            )
        })
    })

    it("metadata", () => {
        scripts.forEach((currentScript) => {
            strictEqual(
                metadata
                    .eval({
                        $scriptContext: scriptContext,
                        $currentScript: currentScript
                    })
                    .toFingerprint(),
                AssetClasses.metadata.toFingerprint()
            )
        })
    })

    it("config", () => {
        scripts.forEach((currentScript) => {
            strictEqual(
                config
                    .eval({
                        $scriptContext: scriptContext,
                        $currentScript: currentScript
                    })
                    .toFingerprint(),
                AssetClasses.config.toFingerprint()
            )
        })
    })

    it("portfolio", () => {
        scripts.forEach((currentScript) => {
            strictEqual(
                portfolio
                    .eval({
                        $scriptContext: scriptContext,
                        $currentScript: currentScript
                    })
                    .toFingerprint(),
                AssetClasses.portfolio.toFingerprint()
            )
        })
    })

    it("price", () => {
        scripts.forEach((currentScript) => {
            strictEqual(
                price
                    .eval({
                        $scriptContext: scriptContext,
                        $currentScript: currentScript
                    })
                    .toFingerprint(),
                AssetClasses.price.toFingerprint()
            )
        })
    })

    it("supply", () => {
        scripts.forEach((currentScript) => {
            strictEqual(
                supply
                    .eval({
                        $scriptContext: scriptContext,
                        $currentScript: currentScript
                    })
                    .toFingerprint(),
                AssetClasses.supply.toFingerprint()
            )
        })
    })

    it("assets 10", () => {
        scripts.forEach((currentScript) => {
            strictEqual(
                assets
                    .eval({
                        id: 10,
                        $scriptContext: scriptContext,
                        $currentScript: currentScript
                    })
                    .toFingerprint(),
                AssetClasses.assets(10).toFingerprint()
            )
        })
    })

    it("reimbursement 10", () => {
        scripts.forEach((currentScript) => {
            strictEqual(
                reimbursement
                    .eval({
                        id: 10,
                        $scriptContext: scriptContext,
                        $currentScript: currentScript
                    })
                    .toString(),
                AssetClasses.reimbursement(10).toString()
            )
        })
    })

    it("voucher ref 10", () => {
        scripts.forEach((currentScript) => {
            strictEqual(
                voucher_ref_token
                    .eval({
                        id: 10,
                        $scriptContext: scriptContext,
                        $currentScript: currentScript
                    })
                    .toFingerprint(),
                AssetClasses.voucher_ref(10).toFingerprint()
            )
        })
    })

    it("voucher nft 10", () => {
        scripts.forEach((currentScript) => {
            strictEqual(
                voucher_user_nft
                    .eval({
                        id: 10,
                        $scriptContext: scriptContext,
                        $currentScript: currentScript
                    })
                    .toFingerprint(),
                AssetClasses.voucher_nft(10).toFingerprint()
            )
        })
    })
})

const ctxWithWrongMinted = spendSupply({
    supply: makeSupply({}),
    config: makeConfig({}),
    minted: new Assets([
        [
            new MintingPolicyHash([
                0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
                18, 19, 20, 21, 22, 23, 24, 25, 26, 27
            ]),
            []
        ]
    ])
})

const ctxWithDvpTokensMinted = spendSupply({
    supply: makeSupply({}),
    config: makeConfig({}),
    minted: makeDvpTokens(1_000_000)
})

const ctxWithAssetTokenMinted = spendSupply({
    supply: makeSupply({}),
    config: makeConfig({}),
    minted: makeAssetsToken(10, 1)
})

const ctxWithAssetTokenAndDvpTokensMinted = spendSupply({
    supply: makeSupply({}),
    config: makeConfig({}),
    minted: makeAssetsToken(10, 1).add(makeDvpTokens(1_000_000))
})

describe("Tokens::get_minted", () => {
    it("returns empty map if nothing is minted", () => {
        scripts.forEach((currentScript) => {
            strictEqual(
                get_minted.eval({
                    $currentScript: currentScript,
                    $scriptContext: scriptContext
                }).size,
                0
            )
        })
    })

    it("returns empty map if something else is minted", () => {
        scripts.forEach((currentScript) => {
            strictEqual(
                get_minted.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctxWithWrongMinted
                }).size,
                0
            )
        })
    })

    it("ok for some dvp_tokens minted", () => {
        scripts.forEach((currentScript) => {
            strictEqual(
                get_minted.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctxWithDvpTokensMinted
                }).size,
                1
            )
        })
    })
})

describe("Tokens::nothing_minted", () => {
    it("true if nothing minted", () => {
        scripts.forEach((currentScript) => {
            strictEqual(
                nothing_minted.eval({
                    $currentScript: currentScript,
                    $scriptContext: scriptContext
                }),
                true
            )
        })
    })

    it("true if something else is minted", () => {
        scripts.forEach((currentScript) => {
            strictEqual(
                nothing_minted.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctxWithWrongMinted
                }),
                true
            )
        })
    })

    it("false if dvp tokens are minted", () => {
        scripts.forEach((currentScript) => {
            strictEqual(
                nothing_minted.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctxWithDvpTokensMinted
                }),
                false
            )
        })
    })
})

describe("Tokens::minted_only_dvp_tokens", () => {
    it("true of dvp tokens are minted", () => {
        scripts.forEach((currentScript) => {
            strictEqual(
                minted_only_dvp_tokens.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctxWithDvpTokensMinted
                }),
                true
            )
        })
    })

    it("true if nothing minted", () => {
        scripts.forEach((currentScript) => {
            strictEqual(
                minted_only_dvp_tokens.eval({
                    $currentScript: currentScript,
                    $scriptContext: scriptContext
                }),
                true
            )
        })
    })

    it("false if asset token minted", () => {
        scripts.forEach((currentScript) => {
            strictEqual(
                minted_only_dvp_tokens.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctxWithAssetTokenMinted
                }),
                false
            )
        })
    })

    it("false if dvp tokens and asset token minted", () => {
        scripts.forEach((currentScript) => {
            strictEqual(
                minted_only_dvp_tokens.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctxWithAssetTokenAndDvpTokensMinted
                }),
                false
            )
        })
    })
})
