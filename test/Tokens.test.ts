import { strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { makeAssets, makeDummyMintingPolicyHash } from "@helios-lang/ledger"
import contract from "pbg-token-validators-test-context"
import { directPolicyScripts, policy, scripts } from "./constants"
import { AssetClasses, makeAssetsToken, makeDvpTokens } from "./tokens"
import { ScriptContextBuilder } from "./tx"

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

describe("Tokens::direct_policy", () => {
    it("direct_policy", () => {
        strictEqual(direct_policy.eval({}).toHex(), policy.toHex())
    })
})

describe("Tokens::indirect_policy", () => {
    it("ok when policy token is spent in current input", () => {
        new ScriptContextBuilder()
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                strictEqual(
                    indirect_policy
                        .eval({
                            $scriptContext: ctx
                        })
                        .toHex(),
                    policy.toHex()
                )
            })
    })

    it("fails if no policy token is spent in current input", () => {
        new ScriptContextBuilder().addPortfolioRef().use((ctx) => {
            throws(() => {
                indirect_policy.eval({
                    $scriptContext: ctx
                })
            })
        })
    })
})

describe("Tokens::policy", () => {
    it("ok for unrelated tx in scripts that have direct access to policy", () => {
        new ScriptContextBuilder().use((ctx) => {
            directPolicyScripts.forEach((currentScript) => {
                strictEqual(
                    policy_internal
                        .eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })
                        .toHex(),
                    policy.toHex()
                )
            })
        })
    })

    it("ok when spending utxo containing a policy token", () => {
        new ScriptContextBuilder()
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    strictEqual(
                        policy_internal
                            .eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                            .toHex(),
                        policy.toHex()
                    )
                })
            })
    })
})

describe("Tokens asset classes", () => {
    it("dvp_token", () => {
        new ScriptContextBuilder()
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    strictEqual(
                        dvp_token
                            .eval({
                                $scriptContext: ctx,
                                $currentScript: currentScript
                            })
                            .toFingerprint(),
                        AssetClasses.dvpToken.toFingerprint()
                    )
                })
            })
    })

    it("metadata", () => {
        new ScriptContextBuilder()
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    strictEqual(
                        metadata
                            .eval({
                                $scriptContext: ctx,
                                $currentScript: currentScript
                            })
                            .toFingerprint(),
                        AssetClasses.metadata.toFingerprint()
                    )
                })
            })
    })

    it("config", () => {
        new ScriptContextBuilder()
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    strictEqual(
                        config
                            .eval({
                                $scriptContext: ctx,
                                $currentScript: currentScript
                            })
                            .toFingerprint(),
                        AssetClasses.config.toFingerprint()
                    )
                })
            })
    })

    it("portfolio", () => {
        new ScriptContextBuilder()
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    strictEqual(
                        portfolio
                            .eval({
                                $scriptContext: ctx,
                                $currentScript: currentScript
                            })
                            .toFingerprint(),
                        AssetClasses.portfolio.toFingerprint()
                    )
                })
            })
    })

    it("price", () => {
        new ScriptContextBuilder()
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    strictEqual(
                        price
                            .eval({
                                $scriptContext: ctx,
                                $currentScript: currentScript
                            })
                            .toFingerprint(),
                        AssetClasses.price.toFingerprint()
                    )
                })
            })
    })

    it("supply", () => {
        new ScriptContextBuilder()
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    strictEqual(
                        supply
                            .eval({
                                $scriptContext: ctx,
                                $currentScript: currentScript
                            })
                            .toFingerprint(),
                        AssetClasses.supply.toFingerprint()
                    )
                })
            })
    })

    it("assets 10", () => {
        new ScriptContextBuilder()
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    strictEqual(
                        assets
                            .eval({
                                id: 10,
                                $scriptContext: ctx,
                                $currentScript: currentScript
                            })
                            .toFingerprint(),
                        AssetClasses.assets(10).toFingerprint()
                    )
                })
            })
    })

    it("reimbursement 10", () => {
        new ScriptContextBuilder()
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    strictEqual(
                        reimbursement
                            .eval({
                                id: 10,
                                $scriptContext: ctx,
                                $currentScript: currentScript
                            })
                            .toString(),
                        AssetClasses.reimbursement(10).toString()
                    )
                })
            })
    })

    it("voucher ref 10", () => {
        new ScriptContextBuilder()
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    strictEqual(
                        voucher_ref_token
                            .eval({
                                id: 10,
                                $scriptContext: ctx,
                                $currentScript: currentScript
                            })
                            .toFingerprint(),
                        AssetClasses.voucher_ref(10).toFingerprint()
                    )
                })
            })
    })

    it("voucher nft 10", () => {
        new ScriptContextBuilder()
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    strictEqual(
                        voucher_user_nft
                            .eval({
                                id: 10,
                                $scriptContext: ctx,
                                $currentScript: currentScript
                            })
                            .toFingerprint(),
                        AssetClasses.voucher_nft(10).toFingerprint()
                    )
                })
            })
    })
})

describe("Tokens::get_minted", () => {
    it("returns empty map if nothing is minted", () => {
        new ScriptContextBuilder()
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    strictEqual(
                        get_minted.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }).size,
                        0
                    )
                })
            })
    })

    it("returns empty map if something else is minted", () => {
        new ScriptContextBuilder()
            .mint({ assets: makeAssets([[makeDummyMintingPolicyHash(1), []]]) })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    strictEqual(
                        get_minted.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }).size,
                        0
                    )
                })
            })
    })

    it("ok for some dvp_tokens minted", () => {
        new ScriptContextBuilder()
            .mint({ assets: makeDvpTokens(1_000_000) })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    strictEqual(
                        get_minted.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }).size,
                        1
                    )
                })
            })
    })
})

describe("Tokens::nothing_minted", () => {
    it("true if nothing minted", () => {
        new ScriptContextBuilder()
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    strictEqual(
                        nothing_minted.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }),
                        true
                    )
                })
            })
    })

    it("true if something else is minted", () => {
        new ScriptContextBuilder()
            .mint({ assets: makeAssets([[makeDummyMintingPolicyHash(1), []]]) })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    strictEqual(
                        nothing_minted.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }),
                        true
                    )
                })
            })
    })

    it("false if dvp tokens are minted", () => {
        new ScriptContextBuilder()
            .mint({ assets: makeDvpTokens(1_000_000) })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    strictEqual(
                        nothing_minted.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }),
                        false
                    )
                })
            })
    })
})

describe("Tokens::minted_only_dvp_tokens", () => {
    it("true of dvp tokens are minted", () => {
        new ScriptContextBuilder()
            .mint({ assets: makeDvpTokens(1_000_000) })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    strictEqual(
                        minted_only_dvp_tokens.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }),
                        true
                    )
                })
            })
    })

    it("true if nothing minted", () => {
        new ScriptContextBuilder()
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    strictEqual(
                        minted_only_dvp_tokens.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }),
                        true
                    )
                })
            })
    })

    it("false if asset token minted", () => {
        new ScriptContextBuilder()
            .mint({ assets: makeAssetsToken(10, 1) })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) =>
                scripts.forEach((currentScript) => {
                    strictEqual(
                        minted_only_dvp_tokens.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }),
                        false
                    )
                })
            )
    })

    it("false if dvp tokens and asset token minted", () => {
        new ScriptContextBuilder()
            .mint({
                assets: makeAssetsToken(10, 1).add(makeDvpTokens(1_000_000))
            })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    strictEqual(
                        minted_only_dvp_tokens.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }),
                        false
                    )
                })
            })
    })
})
