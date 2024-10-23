import { deepEqual, strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { Address, Assets, Value } from "@helios-lang/ledger"
import { IntData, ListData, UplcData } from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"
import { indirectPolicyScripts, scripts } from "./constants"
import { castSupply, makeConfig, makeSupply } from "./data"
import { makeConfigToken, makeSupplyToken } from "./tokens"
import { ScriptContextBuilder, withScripts } from "./tx"

const {
    "Supply::find_input": find_input,
    "Supply::find_output": find_output,
    "Supply::find_ref": find_ref,
    "Supply::find_thread": find_thread,
    "Supply::calc_management_fee_dilution": calc_management_fee_dilution,
    "Supply::calc_success_fee_dilution_internal": calc_success_fee_dilution_internal,
    "Supply::calc_success_fee_dilution": calc_success_fee_dilution,
    "Supply::is_successful": is_successful,
    "Supply::period_end": period_end,
    "Supply::period_id": period_id,
    witnessed_by_supply
} = contract.SupplyModule

describe("Supply::find_input", () => {
    const supply = makeSupply({})

    it("ok if supply UTxO is spent", () => {
        new ScriptContextBuilder()
            .addSupplyInput({
                redeemer: [],
                supply
            })
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    deepEqual(
                        find_input.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }),
                        supply
                    )
                })
            })
    })

    it("nok if nothing is spent with policy tokens", () => {
        new ScriptContextBuilder().use((ctx) => {
            scripts.forEach((currentScript) => {
                throws(() => {
                    find_input.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    })
                })
            })
        })
    })

    it("nok if nothing is spent from supply address in all scripts except config_validator", () => {
        new ScriptContextBuilder()
            .addSupplyInput({
                supply,
                redeemer: [],
                address: Address.dummy(false)
            })
            .use((ctx) => {
                scripts
                    .filter((s) => s != "config_validator")
                    .forEach((currentScript) => {
                        throws(() => {
                            find_input.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                        })
                    })
            })
    })

    it("ok if supply token policy is spent from random address in case of config_validator", () => {
        new ScriptContextBuilder()
            .addSupplyInput({
                redeemer: [],
                supply,
                address: Address.dummy(false)
            })
            .use((ctx) => {
                deepEqual(
                    find_input.eval({
                        $currentScript: "config_validator",
                        $scriptContext: ctx
                    }),
                    supply
                )
            })
    })

    it("ok if not exactly 1 token spent (not current input though)", () => {
        new ScriptContextBuilder()
            .addSupplyThread({
                inputSupply: supply,
                outputSupply: supply,
                token: makeSupplyToken(2)
            })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    deepEqual(
                        find_input.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }),
                        supply
                    )
                })
            })
    })

    it("fails if not exactly 1 token spent in the current input (needed to get the policy)", () => {
        new ScriptContextBuilder()
            .addSupplyThread({
                redeemer: [],
                inputSupply: supply,
                outputSupply: supply,
                token: makeSupplyToken(2)
            })
            .use((ctx) => {
                indirectPolicyScripts.forEach((currentScript) => {
                    throws(() => {
                        find_input.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }),
                            supply
                    })
                })
            })
    })

    it("nok if less than 1 token spent", () => {
        new ScriptContextBuilder()
            .addSupplyThread({
                redeemer: [],
                inputSupply: supply,
                outputSupply: supply,
                token: makeSupplyToken(-1)
            })
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    throws(() => {
                        find_input.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })
                    })
                })
            })
    })

    it("nok if other policy is spent", () => {
        new ScriptContextBuilder()
            .addSupplyThread({
                redeemer: [],
                inputSupply: supply,
                outputSupply: supply,
                token: makeConfigToken()
            })
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    throws(() => {
                        find_input.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })
                    })
                })
            })
    })
})

describe("Supply::find_output", () => {
    const supply = makeSupply({})

    const configureParentContext = (props?: {
        inputToken?: Assets
        outputAddress?: Address
        outputDatum?: UplcData
        outputToken?: Assets
    }) => {
        return new ScriptContextBuilder().addSupplyThread({
            redeemer: [],
            inputSupply: supply,
            inputToken: props?.inputToken,
            outputSupply: props?.outputDatum ?? supply,
            outputAddress: props?.outputAddress,
            outputToken: props?.outputToken
        })
    }

    describe("@ all validators", () => {
        const configureContext = withScripts(configureParentContext, scripts)

        it("returns the supply data if the supply token is returned the supply_validator address with the supply token", () => {
            configureContext().use((currentScript, ctx) => {
                deepEqual(
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    }),
                    supply
                )
            })
        })

        it("throws an error if the supply token isn't returned to the supply_validator address", () => {
            configureContext({ outputAddress: Address.dummy(false) }).use(
                (currentScript, ctx) => {
                    throws(() => {
                        find_output.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })
                    })
                }
            )
        })

        it("throws an error if not exactly 1 token returned", () => {
            configureContext({
                inputToken: makeSupplyToken(1),
                outputToken: makeSupplyToken(2)
            }).use((currentScript, ctx) => {
                throws(() => {
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    })
                })
            })
        })

        it("throws an error if the wrong token is returned", () => {
            configureContext({
                inputToken: makeSupplyToken(1),
                outputToken: makeConfigToken()
            }).use((currentScript, ctx) => {
                throws(() => {
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    })
                })
            })
        })

        it("throws an error if the first field in the listData isn't iData", () => {
            const datum = ListData.expect(castSupply.toUplcData(supply))
            datum.items[0] = new ListData([])

            configureContext({
                outputDatum: datum
            }).use((currentScript, ctx) => {
                throws(() => {
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    })
                })
            })
        })

        it("throws an error if the start_price denominator in the SuccessFeeState data is zero", () => {
            const datum = ListData.expect(castSupply.toUplcData(supply))
            ListData.expect(ListData.expect(datum.items[6]).items[3]).items[1] =
                new IntData(0)

            configureContext({
                outputDatum: datum
            }).use((currentScript, ctx) => {
                throws(() => {
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    })
                })
            })
        })

        it("throws an error if the SuccessFeeState listData contains an extra field", () => {
            const datum = ListData.expect(castSupply.toUplcData(supply))
            ListData.expect(ListData.expect(datum.items[6])).items.push(
                new IntData(0)
            )

            configureContext({
                outputDatum: datum
            }).use((currentScript, ctx) => {
                throws(() => {
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    })
                })
            })
        })
    })
})

describe("Supply::find_ref", () => {
    const supply = makeSupply({})

    it("fails if not referenced", () => {
        new ScriptContextBuilder()
            .addSupplyThread({
                redeemer: [],
                inputSupply: supply,
                outputSupply: supply
            })
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    throws(() => {
                        find_ref.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })
                    })
                })
            })
    })

    it("fails if referenced but current input doesn't spend a utxo with policy token", () => {
        new ScriptContextBuilder()
            .addSupplyRef({
                supply
            })
            .use((ctx) => {
                indirectPolicyScripts.forEach((currentScript) => {
                    throws(() => {
                        find_ref.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })
                    })
                })
            })
    })

    it("ok if referenced", () => {
        new ScriptContextBuilder()
            .addSupplyRef({
                supply
            })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    deepEqual(
                        find_ref.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }),
                        supply
                    )
                })
            })
    })

    it("ok if referenced but at wrong address (address doesn't matter)", () => {
        new ScriptContextBuilder()
            .addSupplyRef({
                supply,
                address: Address.dummy(false)
            })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    deepEqual(
                        find_ref.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }),
                        supply
                    )
                })
            })
    })

    it("fails if referenced but less than 1 token", () => {
        new ScriptContextBuilder()
            .addSupplyRef({
                supply,
                token: makeSupplyToken(0)
            })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    throws(() => {
                        find_ref.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })
                    })
                })
            })
    })
})

describe("Supply::find_thread", () => {
    const supply = makeSupply({})

    it("returns same supply twice", () => {
        new ScriptContextBuilder()
            .addSupplyThread({
                redeemer: [],
                supply
            })
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    deepEqual(
                        find_thread.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }),
                        [supply, supply]
                    )
                })
            })
    })

    it("fails if more than 1 token", () => {
        new ScriptContextBuilder()
            .addSupplyThread({
                redeemer: [],
                supply,
                token: makeSupplyToken(2)
            })
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    throws(() => {
                        find_thread.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })
                    })
                })
            })
    })
})

describe("Supply::calc_management_fee_dilution", () => {
    it("whitepaper example", () => {
        const relFee = 0.0001
        const nTokens = 1_000_000_000

        const supply = makeSupply({ nTokens })

        new ScriptContextBuilder()
            .addSupplyThread({
                redeemer: [],
                supply,
                token: makeSupplyToken(1)
            })
            .addConfigRef({
                config: makeConfig({ relManagementFee: relFee })
            })
            .use((ctx) => {
                strictEqual(
                    calc_management_fee_dilution.eval({
                        $currentScript: "supply_validator",
                        $scriptContext: ctx,
                        self: supply
                    }),
                    100010n
                )
            })
    })

    it("0 if there are no tokens", () => {
        const supply = makeSupply({ nTokens: 0n })

        new ScriptContextBuilder()
            .addSupplyThread({
                redeemer: [],
                supply,
                token: makeSupplyToken(1)
            })
            .addConfigRef({
                config: makeConfig({ relManagementFee: 0.0001 })
            })
            .use((ctx) => {
                strictEqual(
                    calc_management_fee_dilution.eval({
                        $currentScript: "supply_validator",
                        $scriptContext: ctx,
                        self: supply
                    }),
                    0n
                )
            })
    })

    it("0 if the fee is 0", () => {
        const supply = makeSupply({ nTokens: 1_000_000_000n })

        new ScriptContextBuilder()
            .addSupplyThread({
                redeemer: [],
                supply,
                token: makeSupplyToken(1)
            })
            .addConfigRef({
                config: makeConfig({ relManagementFee: 0.0 })
            })
            .use((ctx) => {
                strictEqual(
                    calc_management_fee_dilution.eval({
                        $currentScript: "supply_validator",
                        $scriptContext: ctx,
                        self: supply
                    }),
                    0n
                )
            })
    })
})


describe("Supply::calc_success_fee_dilution_internal", () => {
    it("Supply::calc_success_fee_dilution_internal #01 (whitepaper example)", () => {
        const config = makeConfig({
            successFee: {
                c0: 0,
                steps: [{ sigma: 1.05, c: 0.3 }]
            }
        })

        const supply = makeSupply({
            startPrice: [100, 1]
        })

        // in the whitepaper example this number is 98.901099, which is the correcly rounded number
        // but the on-chain math rounds down
        strictEqual(
            calc_success_fee_dilution_internal.eval({
                self: supply,
                end_price: [150, 1],
                success_fee: config.fees.success_fee
            }),
            98_901_098n
        )
    })

    it("Supply::calc_success_fee_dilution_internal #02 (0 fee gives 0 dilution)", () => {
        const config = makeConfig({
            successFee: {
                c0: 0,
                steps: []
            }
        })

        const supply = makeSupply({
            startPrice: [100, 1]
        })

        strictEqual(
            calc_success_fee_dilution_internal.eval({
                self: supply,
                end_price: [150, 1],
                success_fee: config.fees.success_fee
            }),
            0n
        )
    })

    it("Supply::calc_success_fee_dilution_internal #03 (0 success gives 0 dilution)", () => {
        const config = makeConfig({
            successFee: {
                c0: 0,
                steps: [{ sigma: 1.05, c: 0.3 }]
            }
        })

        const supply = makeSupply({
            startPrice: [100, 1]
        })

        strictEqual(
            calc_success_fee_dilution_internal.eval({
                self: supply,
                end_price: [90, 1],
                success_fee: config.fees.success_fee
            }),
            0n
        )
    })
})

describe("Supply::calc_success_fee_dilution", () => {
    it("Supply::calc_success_fee_dilution #01 (whitepaper example)", () => {
        const config = makeConfig({
            successFee: {
                c0: 0,
                steps: [{ sigma: 1.05, c: 0.3 }]
            }
        })

        const supply = makeSupply({
            startPrice: [100, 1]
        })

        new ScriptContextBuilder()
            .addSupplyThread({
                redeemer: [],
                supply,
                token: makeSupplyToken(1)
            })
            .addConfigRef({
                config: config
            })
            .use((ctx) => {
                // in the whitepaper example this number is 98.901099, which is the correcly rounded number
                // but the on-chain math rounds down
                strictEqual(
                    calc_success_fee_dilution.eval({
                        $currentScript: "supply_validator",
                        $scriptContext: ctx,
                        self: supply,
                        end_price: [150, 1]
                    }),
                    98_901_098n
                )
            })
    })

    it("Supply::calc_success_fee_dilution #02 (0 fee gives 0 dilution)", () => {
        const config = makeConfig({
            successFee: {
                c0: 0,
                steps: []
            }
        })

        const supply = makeSupply({
            startPrice: [100, 1]
        })

        new ScriptContextBuilder()
            .addSupplyThread({
                redeemer: [],
                supply,
                token: makeSupplyToken(1)
            })
            .addConfigRef({
                config: config
            })
            .use((ctx) => {
                strictEqual(
                    calc_success_fee_dilution.eval({
                        $currentScript: "supply_validator",
                        $scriptContext: ctx,
                        self: supply,
                        end_price: [150, 1]
                    }),
                    0n
                )
            })
    })

    it("Supply::calc_success_fee_dilution #03 (0 success gives 0 dilution)", () => {
        const config = makeConfig({
            successFee: {
                c0: 0,
                steps: [{ sigma: 1.05, c: 0.3 }]
            }
        })

        const supply = makeSupply({
            startPrice: [100, 1]
        })

        new ScriptContextBuilder()
            .addSupplyThread({
                redeemer: [],
                supply,
                token: makeSupplyToken(1)
            })
            .addConfigRef({
                config: config
            })
            .use((ctx) => {
                strictEqual(
                    calc_success_fee_dilution.eval({
                        $currentScript: "supply_validator",
                        $scriptContext: ctx,
                        self: supply,
                        end_price: [90, 1]
                    }),
                    0n
                )
            })
    })
})

describe("Supply::is_successful", () => {
    const self = makeSupply({
        startPrice: [100, 1]
    })

    it("false for equal end price", () => {
        strictEqual(
            is_successful.eval({
                self,
                price_relative_to_benchmark: [100, 1]
            }),
            false
        )
    })

    it("false for smaller end price", () => {
        strictEqual(
            is_successful.eval({
                self,
                price_relative_to_benchmark: [99_999_999, 1000000]
            }),
            false
        )
    })

    it("true for larger end price", () => {
        strictEqual(
            is_successful.eval({
                self: self,
                price_relative_to_benchmark: [100_000_001, 1000000]
            }),
            true
        )
    })
})

describe("Supply::period_end", () => {
    const self = makeSupply({
        successFee: {
            start_time: 0,
            period: 1000
        }
    })

    strictEqual(
        period_end.eval({
            self
        }),
        1000
    )
})

describe("Supply::period_id", () => {
    const self = makeSupply({
        successFee: {
            periodId: 10
        }
    })

    strictEqual(
        period_id.eval({
            self
        }),
        10n
    )
})

describe("witnessed_by_supply", () => {
    it("true when spending supply utxo", () => {
        new ScriptContextBuilder()
            .addSupplyThread({ redeemer: [] })
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    strictEqual(
                        witnessed_by_supply.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }),
                        true
                    )
                })
            })
    })

    it(`false when not spending supply utxo (and current input contains a policy token)`, () => {
        new ScriptContextBuilder()
            .takeFromVault({
                redeemer: new IntData(0),
                value: new Value(2_000_000n)
            })
            .sendToVault({ value: new Value(2_000_000n) })
            .redeemDummyTokenWithDvpPolicy()
            .use((ctx) => {
                scripts.forEach((currentScript) => {
                    strictEqual(
                        witnessed_by_supply.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }),
                        false
                    )
                })
            })
    })

    it("fails when not spending supply utxo and current input doesn't contain a policy token (for scripts with no direct access to policy)", () => {
        new ScriptContextBuilder()
            .takeFromVault({
                redeemer: new IntData(0),
                value: new Value(2_000_000n)
            })
            .sendToVault({ value: new Value(2_000_000n) })
            .use((ctx) => {
                indirectPolicyScripts.forEach((currentScript) => {
                    throws(() => {
                        witnessed_by_supply.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })
                    })
                })
            })
    })
})
