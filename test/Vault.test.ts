import { deepEqual, strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { AssetClass, Assets, Value } from "@helios-lang/ledger"
import { IntData } from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"
import {
    directPolicyScripts,
    indirectPolicyScripts,
    scripts
} from "./constants"
import { makeAsset } from "./data"
import { ScriptContextBuilder } from "./tx"

const { diff, diff_lovelace, nothing_spent, VAULT_DATUM } = contract.Vault

describe("Vault::VAULT_DATUM", () => {
    it("is empty bytearray", () => {
        deepEqual(VAULT_DATUM.eval({}), [])
    })
})

describe("Vault::nothing_spent", () => {
    it("false if vault asset is spent", () => {
        new ScriptContextBuilder()
            .takeFromVault({ value: new Value(2_000_000n) })
            .use((ctx) => {
                directPolicyScripts.forEach((currentScript) => {
                    strictEqual(
                        nothing_spent.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }),
                        false
                    )
                })
            })

        new ScriptContextBuilder()
            .takeFromVault({ value: new Value(2_000_000n) })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                indirectPolicyScripts.forEach((currentScript) => {
                    strictEqual(
                        nothing_spent.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }),
                        false
                    )
                })
            })
    })

    it("false if asset group is spent", () => {
        const assets = [makeAsset()]

        new ScriptContextBuilder()
            .addAssetGroupThread({
                id: 0,
                inputAssets: assets,
                outputAssets: assets,
                redeemer: {
                    Count: { supply_ptr: 0 }
                }
            })
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    strictEqual(
                        nothing_spent.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }),
                        false
                    )
                })
            })
    })

    it("true if nothing from vault is spent", () => {
        new ScriptContextBuilder()
            .addPriceThread({ redeemer: new IntData(0) })
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    strictEqual(
                        nothing_spent.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }),
                        true
                    )
                })
            })
    })
})

describe("Vault::diff", () => {
    it("fails if current input doesn't contain a policy token", () => {
        new ScriptContextBuilder()
            .takeFromVault({ value: new Value(2_000_000) })
            .sendToVault({ value: new Value(2_000_000) })
            .use((ctx) => {
                indirectPolicyScripts.forEach((currentScript) => {
                    throws(() => {
                        diff.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })
                    })
                })
            })
    })

    it("is 0 if no real change", () => {
        new ScriptContextBuilder()
            .takeFromVault({ value: new Value(2_000_000) })
            .sendToVault({ value: new Value(2_000_000) })
            .use((ctx) => {
                directPolicyScripts.forEach((currentScript) => {
                    const v = diff.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    })

                    strictEqual(v.isEqual(new Value(0)), true)
                })
            })

        new ScriptContextBuilder()
            .takeFromVault({ value: new Value(2_000_000) })
            .sendToVault({ value: new Value(2_000_000) })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                indirectPolicyScripts.forEach((currentScript) => {
                    const v = diff.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    })

                    strictEqual(v.isEqual(new Value(0)), true)
                })
            })
    })

    it("can sum over multiple inputs and outputs", () => {
        new ScriptContextBuilder()
            .takeFromVault({ value: new Value(1_000_000) })
            .takeFromVault({ value: new Value(2_000_000) })
            .takeFromVault({ value: new Value(10_000_000) })
            .sendToVault({ value: new Value(15_000_000) })
            .sendToVault({ value: new Value(2_000_000) })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    const v = diff.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    })

                    strictEqual(v.isEqual(new Value(4_000_000)), true)
                })
            })
    })

    it("fails for outputs sent back to vault with wrong datum", () => {
        new ScriptContextBuilder()
            .takeFromVault({ value: new Value(2_000_000) })
            .sendToVault({ datum: new IntData(0), value: new Value(2_000_000) })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    throws(() => {
                        diff.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })
                    })
                })
            })
    })

    it("is negative if assets are taken out (i.e. value into transaction)", () => {
        const ac = AssetClass.dummy()

        new ScriptContextBuilder()
            .takeFromVault({
                value: new Value(0, Assets.fromAssetClasses([[ac, 1_000_000n]]))
            })
            .sendToVault({ value: new Value(0) })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    const v = diff.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    })

                    strictEqual(v.assets.getQuantity(ac), -1_000_000n)
                })
            })
    })
})

describe("Vault::diff_lovelace", () => {
    it("fails if config token isn't referenced or spent", () => {
        new ScriptContextBuilder()
            .takeFromVault({ value: new Value(1_000_000) })
            .sendToVault({ value: new Value(10_000_000) })
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    throws(() => {
                        diff_lovelace.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ptrs: [
                                // dummy AssetPtr is still needed for lovelace
                                {
                                    group_index: 0,
                                    asset_class_index: 0
                                }
                            ]
                        })
                    })
                })
            })
    })

    it("fails if time-range not set", () => {
        new ScriptContextBuilder()
            .takeFromVault({ value: new Value(1_000_000) })
            .sendToVault({ value: new Value(10_000_000) })
            .addConfigRef()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    throws(() => {
                        diff_lovelace.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ptrs: [
                                // dummy AssetPtr[] entry is still needed
                                {
                                    group_index: 0,
                                    asset_class_index: 0
                                }
                            ]
                        })
                    })
                })
            })
    })

    it("correctly sums pure lovelace without asset counters (in scripts that have direct access to policy without dummy redeemer)", () => {
        new ScriptContextBuilder()
            .takeFromVault({ value: new Value(1_000_000) })
            .sendToVault({ value: new Value(10_000_000) })
            .addConfigRef()
            .setTimeRange({ end: 0 })
            .use((ctx) => {
                directPolicyScripts.forEach((currentScript) => {
                    strictEqual(
                        diff_lovelace.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ptrs: [
                                // dummy AssetPtr[] entry is still needed
                                {
                                    group_index: 0,
                                    asset_class_index: 0
                                }
                            ]
                        }),
                        9_000_000n
                    )
                })
            })
    })

    it("correctly sums pure lovelace without asset counters (in scripts that don't have direct access to policy, so with dummy redeemer)", () => {
        new ScriptContextBuilder()
            .takeFromVault({ value: new Value(1_000_000) })
            .sendToVault({ value: new Value(10_000_000) })
            .addConfigRef()
            .redeemDummyTokenWithDvpPolicy()
            .setTimeRange({ end: 0 })
            .use((ctx) => {
                indirectPolicyScripts.forEach((currentScript) => {
                    if (currentScript == "config_validator") {
                        // fails because config must be spent
                        throws(() => {
                            diff_lovelace.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                ptrs: [
                                    // dummy AssetPtr[] entry is still needed
                                    {
                                        group_index: 0,
                                        asset_class_index: 0
                                    }
                                ]
                            })
                        })
                    } else {
                        strictEqual(
                            diff_lovelace.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                ptrs: [
                                    // dummy AssetPtr[] entry is still needed
                                    {
                                        group_index: 0,
                                        asset_class_index: 0
                                    }
                                ]
                            }),
                            9_000_000n
                        )
                    }
                })
            })
    })

    it("fails for scripts that don't have direct access to policy if current input doesn't contain a policy token", () => {
        new ScriptContextBuilder()
            .takeFromVault({ value: new Value(1_000_000) })
            .sendToVault({ value: new Value(10_000_000) })
            .addConfigRef()
            .use((ctx) => {
                indirectPolicyScripts.forEach((currentScript) => {
                    throws(() => {
                        diff_lovelace.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ptrs: [
                                // dummy AssetPtr is still needed for lovelace
                                {
                                    group_index: 0,
                                    asset_class_index: 0
                                }
                            ]
                        })
                    })
                })
            })
    })
})
