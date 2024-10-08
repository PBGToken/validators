import { deepEqual, strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { Address, Assets } from "@helios-lang/ledger"
import { ByteArrayData, IntData, ListData, UplcData } from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"
import { scripts as allScripts } from "./constants"
import { castPrice, makeConfig, makePrice } from "./data"
import { makeConfigToken } from "./tokens"
import { ScriptContextBuilder, withScripts } from "./tx"

const {
    "Price::find": find,
    "Price::find_input": find_input,
    "Price::find_output": find_output,
    "Price::find_ref": find_ref,
    "Price::find_thread": find_thread,
    "Price::is_not_expired": is_not_expired,
    "Price::relative_to_benchmark": relative_to_benchmark
} = contract.PriceModule

describe("PriceModule::Price::find", () => {
    const price = makePrice()

    const configureParentContext = (props?: {
        address?: Address
        redeemer?: UplcData
        refer?: boolean
        token?: Assets
    }) => {
        const scb = new ScriptContextBuilder()

        if (props?.refer) {
            scb.addPriceRef({
                address: props?.address,
                price,
                token: props?.token
            })
        } else {
            scb.addPriceInput({
                address: props?.address,
                redeemer: props?.redeemer,
                price,
                token: props?.token
            })
        }

        if (!props?.redeemer) {
            scb.redeemDummyTokenWithDvpPolicy()
        }

        return scb
    }

    describe("@ price_validator", () => {
        const configureContext = withScripts(configureParentContext, [
            "price_validator"
        ])

        it("returns the price data if the price UTxO is the current input", () => {
            configureContext({ redeemer: new IntData(0) }).use(
                (currentScript, ctx) => {
                    deepEqual(
                        find.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }),
                        price
                    )
                }
            )
        })

        it("throws an error if the price UTxO isn't the current input", () => {
            configureContext().use((currentScript, ctx) => {
                throws(() => {
                    find.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    })
                })
            })
        })

        it("throws an error if the price UTxO is referenced", () => {
            configureContext({ refer: true }).use((currentScript, ctx) => {
                throws(() => {
                    find.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    })
                })
            })
        })
    })

    describe("@ other validators", () => {
        const otherScripts = allScripts.filter((s) => s != "price_validator")
        const configureContext = withScripts(
            configureParentContext,
            otherScripts
        )

        it("returns the price data if the price UTxO is referenced", () => {
            configureContext({ refer: true }).use((currentScript, ctx) => {
                deepEqual(
                    find.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    }),
                    price
                )
            })
        })

        it("throws an error if the price UTxO is spent", () => {
            configureContext({ redeemer: new IntData(0) }).use(
                (currentScript, ctx) => {
                    throws(() => {
                        find.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })
                    })
                }
            )
        })

        it("throws an error if the referenced price UTxO doesn't contain the price token", () => {
            configureContext({ refer: true, token: makeConfigToken() }).use(
                (currentScript, ctx) => {
                    throws(() => {
                        find.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })
                    })
                }
            )
        })

        it("throws an error if the referenced price UTxO isn't at the price_validator address", () => {
            configureContext({
                address: Address.dummy(false),
                refer: true
            }).use((currentScript, ctx) => {
                throws(() => {
                    find.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    })
                })
            })
        })
    })
})

describe("PriceModule::Price::find_input", () => {
    const price = makePrice()

    describe("for the price_validator", () => {
        it("returns the price data if the price UTxO is the current input", () => {
            new ScriptContextBuilder()
                .addPriceInput({
                    redeemer: new IntData(0),
                    price
                })
                .use((ctx) => {
                    deepEqual(
                        find_input.eval({
                            $currentScript: "price_validator",
                            $scriptContext: ctx
                        }),
                        price
                    )
                })
        })
    })

    describe("for all validators except the price_validator", () => {
        const otherScripts = allScripts.filter((s) => s != "price_validator")

        it("returns the price data if the spent price UTxO isn't the current input", () => {
            new ScriptContextBuilder()
                .addPriceInput({
                    price
                })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    otherScripts.forEach((currentScript) => {
                        deepEqual(
                            find_input.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            }),
                            price
                        )
                    })
                })
        })

        it("throws an error if the spent price UTxO doesn't contain the price token", () => {
            new ScriptContextBuilder()
                .addPriceInput({
                    price,
                    token: makeConfigToken()
                })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    otherScripts.forEach((currentScript) => {
                        throws(() => {
                            find_input.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                        })
                    })
                })
        })

        it("throws an error if the spent price UTxO isn't at the price_validator address", () => {
            new ScriptContextBuilder()
                .addPriceInput({
                    price,
                    address: Address.dummy(false)
                })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    otherScripts.forEach((currentScript) => {
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

    describe("for all validators", () => {
        it("throws an error if the price UTxO is referenced", () => {
            new ScriptContextBuilder()
                .addPriceRef({
                    price
                })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    allScripts.forEach((currentScript) => {
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
})

describe("PriceModule::Price::find_output", () => {
    const price = makePrice()

    const configureParentContext = (props?: {
        address?: Address
        datum?: UplcData
        token?: Assets
    }) => {
        return new ScriptContextBuilder()
            .addPriceOutput({
                address: props?.address,
                datum: props?.datum,
                price,
                token: props?.token
            })
            .redeemDummyTokenWithDvpPolicy()
    }

    describe("@ all validators", () => {
        const configureContext = withScripts(configureParentContext, allScripts)

        it("returns the price data if the price UTxO is sent to the price_validator address with the price token", () => {
            configureContext().use((currentScript, ctx) => {
                deepEqual(
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    }),
                    price
                )
            })
        })

        it("throws an error if the price UTxO output doesn't contain the price token", () => {
            configureContext({ token: makeConfigToken() }).use(
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

        it("throws an error if the price UTxO output isn't sent to the price_validator address", () => {
            configureContext({ address: Address.dummy(false) }).use(
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

        it("throws an error if the value denominator is zero", () => {
            const datum = ListData.expect(castPrice.toUplcData(price))
            ListData.expect(datum.items[0]).items[1] = new IntData(0)

            configureContext({ datum }).use((currentScript, ctx) => {
                throws(() => {
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    })
                })
            })
        })

        it("throws an error if the value denominator is negative", () => {
            const datum = ListData.expect(castPrice.toUplcData(price))
            ListData.expect(datum.items[0]).items[1] = new IntData(-1)

            configureContext({ datum }).use((currentScript, ctx) => {
                throws(() => {
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    })
                })
            })
        })

        it("throws an error if the datum listData contains an additional field", () => {
            const datum = ListData.expect(castPrice.toUplcData(price))
            datum.items.push(new IntData(0))

            configureContext({ datum }).use((currentScript, ctx) => {
                throws(() => {
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    })
                })
            })
        })

        it("throws an error the datum listData time field isn't iData", () => {
            const datum = ListData.expect(castPrice.toUplcData(price))
            datum.items[1] = new ByteArrayData([])

            configureContext({ datum }).use((currentScript, ctx) => {
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

describe("PriceModule::Price::find_ref", () => {
    const price = makePrice()

    describe("for all validators", () => {
        it("returns the price data if the price UTxO is referenced", () => {
            new ScriptContextBuilder()
                .addPriceRef({
                    price
                })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    allScripts.forEach((currentScript) => {
                        deepEqual(
                            find_ref.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            }),
                            price
                        )
                    })
                })
        })

        it("throws an error if the referenced price UTxO doesn't contain the price token", () => {
            new ScriptContextBuilder()
                .addPriceRef({
                    price,
                    token: makeConfigToken()
                })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    allScripts.forEach((currentScript) => {
                        throws(() => {
                            find_ref.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                        })
                    })
                })
        })

        it("throws an error if referenced price UTxO isn't at the price_validator address", () => {
            new ScriptContextBuilder()
                .addPriceRef({
                    price,
                    address: Address.dummy(false)
                })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    allScripts.forEach((currentScript) => {
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
})

describe("PriceModule::Price::find_thread", () => {
    const price = makePrice()

    describe("for all validators", () => {
        it("returns the price data twice if the price UTxO remains unchanged when spent and returned", () => {
            new ScriptContextBuilder()
                .addPriceThread({
                    price,
                    redeemer: new IntData(0)
                })
                .use((ctx) => {
                    allScripts.forEach((currentScript) => {
                        deepEqual(
                            find_thread.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            }),
                            [price, price]
                        )
                    })
                })
        })
    })
})

describe("PriceModule::Price::is_not_expired", () => {
    const config = makeConfig({
        token: {
            maxPriceAge: 100
        }
    })

    describe("for all validators except the burn_order_validator, the mint_order_validator and the config_validator", () => {
        // config_validator requires the config to be spent, mint_- and burn_order_validator require config to be referenced
        const scripts = allScripts.filter(
            (s) =>
                ![
                    "burn_order_validator",
                    "config_validator",
                    "mint_order_validator"
                ].includes(s)
        )

        it("return true if the price timestamp is recent", () => {
            const price = makePrice({
                timestamp: 120
            })

            new ScriptContextBuilder()
                .addConfigRef({ config })
                .redeemDummyTokenWithDvpPolicy()
                .setTimeRange({ end: 200 })
                .use((ctx) => {
                    scripts.forEach((currentScript) => {
                        strictEqual(
                            is_not_expired.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                self: price
                            }),
                            true
                        )
                    })
                })
        })

        it("returns false if the price timestamp is too old", () => {
            const price = makePrice({
                timestamp: 99
            })

            new ScriptContextBuilder()
                .addConfigRef({ config })
                .redeemDummyTokenWithDvpPolicy()
                .setTimeRange({ end: 200 })
                .use((ctx) => {
                    scripts.forEach((currentScript) => {
                        strictEqual(
                            is_not_expired.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                self: price
                            }),
                            false
                        )
                    })
                })
        })

        it("returns true if the price timestamp is equal to the explicitly specified expiry time", () => {
            const price = makePrice({
                timestamp: 100
            })

            new ScriptContextBuilder()
                .redeemDummyTokenWithDvpPolicy() // still need to redeem something with a valid token because policy is evaluated globally
                .use((ctx) => {
                    scripts.forEach((currentScript) => {
                        strictEqual(
                            is_not_expired.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                self: price,
                                expiry: 100
                            }),
                            true
                        )
                    })
                })
        })
    })
})

describe("PriceModule::Price::relative_to_benchmark", () => {
    const benchmark = contract.benchmark_delegate.$hash
    const config = makeConfig({ benchmark })
    const price = makePrice({ top: 100, bottom: 1 })

    describe("for all validators except the burn_order_validator, the mint_order_validator and the config_validator", () => {
        const scripts = allScripts.filter(
            (s) =>
                ![
                    "burn_order_validator",
                    "config_validator",
                    "mint_order_validator"
                ].includes(s)
        )

        it("returns the input value if the benchmark is ADA itself (i.e. 1/1)", () => {
            new ScriptContextBuilder()
                .addConfigRef({
                    config
                })
                .observeBenchmark({ hash: benchmark, redeemer: [1, 1] })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    scripts.forEach((currentScript) => {
                        deepEqual(
                            relative_to_benchmark.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                self: price
                            }),
                            [100n, 1n]
                        )
                    })
                })
        })

        it("return the scaled input value if the benchmark price if not unit (i.e. the benchmark isn't ADA)", () => {
            new ScriptContextBuilder()
                .addConfigRef({
                    config
                })
                .observeBenchmark({ hash: benchmark, redeemer: [2, 1] })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    scripts.forEach((currentScript) => {
                        deepEqual(
                            relative_to_benchmark.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                self: price
                            }),
                            [200n, 1n]
                        )
                    })
                })
        })
    })
})
