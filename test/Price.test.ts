import { deepEqual, strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { Address } from "@helios-lang/ledger"
import { IntData } from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"
import { scripts as allScripts } from "./constants"
import { castRatio, makeConfig, makePrice } from "./data"
import { makeConfigToken } from "./tokens"
import { ScriptContextBuilder } from "./tx"

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

    describe("for the price_validator", () => {
        it("returns the price data if the price UTxO is the current input", () => {
            new ScriptContextBuilder()
                .addPriceInput({
                    redeemer: new IntData(0),
                    price
                })
                .use((ctx) => {
                    deepEqual(
                        find.eval({
                            $currentScript: "price_validator",
                            $scriptContext: ctx
                        }),
                        price
                    )
                })
        })

        it("throws an error if the price UTxO isn't the current input", () => {
            new ScriptContextBuilder()
                .addPriceInput({
                    price
                })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    throws(() => {
                        find.eval({
                            $currentScript: "price_validator",
                            $scriptContext: ctx
                        })
                    })
                })
        })

        it("throws an error if the price UTxO is referenced", () => {
            new ScriptContextBuilder()
                .addPriceRef({
                    price
                })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    throws(() => {
                        find.eval({
                            $currentScript: "price_validator",
                            $scriptContext: ctx
                        })
                    })
                })
        })
    })

    describe("for the other validators", () => {
        const otherScripts = allScripts.filter((s) => s != "price_validator")

        it("returns the price data if the price UTxO is referenced", () => {
            new ScriptContextBuilder()
                .addPriceRef({
                    price
                })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    otherScripts.forEach((currentScript) => {
                        deepEqual(
                            find.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            }),
                            price
                        )
                    })
                })
        })

        it("throws an error if the price UTxO is spent", () => {
            const price = makePrice()

            new ScriptContextBuilder()
                .addPriceInput({
                    redeemer: new IntData(0),
                    price
                })
                .use((ctx) => {
                    otherScripts.forEach((currentScript) => {
                        throws(() => {
                            find.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                        })
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
                    otherScripts.forEach((currentScript) => {
                        throws(() => {
                            find.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                        })
                    })
                })
        })

        it("throws an error if the referenced price UTxO isn't at the price_validator address", () => {
            new ScriptContextBuilder()
                .addPriceRef({
                    price,
                    address: Address.dummy(false)
                })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    otherScripts.forEach((currentScript) => {
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

    describe("for all validators", () => {
        it("returns the price data if the price UTxO is sent to the price_validator address with the price token", () => {
            new ScriptContextBuilder()
                .addPriceOutput({
                    price
                })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    allScripts.forEach((currentScript) => {
                        deepEqual(
                            find_output.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            }),
                            price
                        )
                    })
                })
        })

        it("throws an error if the price UTxO output doesn't contain the price token", () => {
            new ScriptContextBuilder()
                .addPriceOutput({
                    price,
                    token: makeConfigToken()
                })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    allScripts.forEach((currentScript) => {
                        throws(() => {
                            find_output.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                        })
                    })
                })
        })

        it("throws an error if the price UTxO output isn't sent to the price_validator address", () => {
            const price = makePrice()

            new ScriptContextBuilder()
                .addPriceOutput({
                    price,
                    address: Address.dummy(false)
                })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    allScripts.forEach((currentScript) => {
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
