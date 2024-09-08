import { describe, it } from "node:test"
import { Address, AssetClass, Assets, Value } from "@helios-lang/ledger"
import { IntData } from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"
import {
    AssetPtrType,
    MintOrderRedeemerType,
    makeAsset,
    makeAssetPtr,
    makeMintOrder
} from "./data"
import { ScriptContextBuilder } from "./tx"
import { deepEqual, strictEqual, throws } from "node:assert"
import { scripts } from "./constants"
import { makeDvpTokens, makeVoucherUserToken } from "./tokens"

const {
    "MintOrder::find_return": find_return,
    "MintOrder::diff": diff,
    "MintOrder::price_expiry": price_expiry,
    "MintOrder::returned_tokens": returned_tokens,
    "MintOrder::value": get_value,
    "MintOrder::value_lovelace": value_lovelace,
    "MintOrder::voucher_id": voucher_id
} = contract.MintOrderModule

describe("MintOrderModule::MintOrder::find_return", () => {
    const address = Address.dummy(false)
    const datum = new IntData(0)
    const mintOrder = makeMintOrder({
        address,
        datum
    })

    it("returns the corresponding output if found", () => {
        new ScriptContextBuilder()
            .addMintOrderReturn({ address, datum })
            .use((ctx) => {
                const output = find_return.eval({
                    $scriptContext: ctx,
                    self: mintOrder
                })

                strictEqual(output.address.toBech32(), address.toBech32())
                strictEqual(
                    output.datum?.data.toSchemaJson(),
                    datum.toSchemaJson()
                )
            })
    })

    it("returns the corresponding output even if another output, with a different datum, is present at the same address", () => {
        new ScriptContextBuilder()
            .addDummyOutput({ address })
            .addMintOrderReturn({ address, datum })
            .use((ctx) => {
                const output = find_return.eval({
                    $scriptContext: ctx,
                    self: mintOrder
                })

                strictEqual(output.address.toBech32(), address.toBech32())
                strictEqual(
                    output.datum?.data.toSchemaJson(),
                    datum.toSchemaJson()
                )
            })
    })

    it("throws an error if not found due to the output having a different datum", () => {
        new ScriptContextBuilder()
            .addMintOrderReturn({ address, datum: new IntData(1) })
            .use((ctx) => {
                throws(() => [
                    find_return.eval({
                        $scriptContext: ctx,
                        self: mintOrder
                    })
                ])
            })
    })

    it("throws an error if not found due to the output being at a different address", () => {
        new ScriptContextBuilder()
            .addDummyOutputs(10)
            .addMintOrderReturn({ address: Address.dummy(false, 1) })
            .use((ctx) => {
                throws(() => [
                    find_return.eval({
                        $scriptContext: ctx,
                        self: mintOrder
                    })
                ])
            })
    })
})

describe("MintOrderModule::MintOrder::diff", () => {
    const address = Address.dummy(false)
    const datum = new IntData(0)
    const mintOrder = makeMintOrder({
        address,
        datum
    })
    const redeemer: MintOrderRedeemerType = { Fulfill: { ptrs: [] } }

    describe("the order contains only lovelace", () => {
        const inputValue = new Value(10_000_000)

        describe("for the mint_order_validator", () => {
            it("returns 0 if precisely the order value is returned", () => {
                new ScriptContextBuilder()
                    .addMintOrderInput({
                        value: new Value(10_000_000),
                        datum: mintOrder,
                        redeemer
                    })
                    .addMintOrderReturn({
                        address,
                        datum,
                        value: new Value(10_000_000)
                    })
                    .use((ctx) => {
                        const value = diff.eval({
                            $currentScript: "mint_order_validator",
                            $scriptContext: ctx,
                            self: mintOrder
                        })

                        strictEqual(value.lovelace, 0n)
                        deepEqual(value.assets.assets, [])
                    })
            })

            it("returns a negative lovelace value if more lovelace is returned", () => {
                new ScriptContextBuilder()
                    .addMintOrderInput({
                        value: inputValue,
                        datum: mintOrder,
                        redeemer
                    })
                    .addMintOrderReturn({
                        address,
                        datum,
                        value: new Value(11_000_000)
                    })
                    .use((ctx) => {
                        const value = diff.eval({
                            $currentScript: "mint_order_validator",
                            $scriptContext: ctx,
                            self: mintOrder
                        })

                        strictEqual(value.lovelace, -1_000_000n)
                        deepEqual(value.assets.assets, [])
                    })
            })

            it("returns positive lovelace if less is returned", () => {
                new ScriptContextBuilder()
                    .addMintOrderInput({
                        value: inputValue,
                        datum: mintOrder,
                        redeemer
                    })
                    .addMintOrderReturn({
                        address,
                        datum,
                        value: new Value(9_000_000)
                    })
                    .use((ctx) => {
                        const value = diff.eval({
                            $currentScript: "mint_order_validator",
                            $scriptContext: ctx,
                            self: mintOrder
                        })

                        strictEqual(value.lovelace, 1_000_000n)
                        deepEqual(value.assets.assets, [])
                    })
            })

            it("throws an error if the return UTxO doesn't have the expected datum", () => {
                new ScriptContextBuilder()
                    .addMintOrderInput({
                        value: inputValue,
                        datum: mintOrder,
                        redeemer
                    })
                    .addMintOrderReturn({
                        address,
                        datum: new IntData(1),
                        value: inputValue
                    })
                    .use((ctx) => {
                        throws(() => {
                            diff.eval({
                                $currentScript: "mint_order_validator",
                                $scriptContext: ctx,
                                self: mintOrder
                            })
                        })
                    })
            })
        })

        describe("for all other validators", () => {
            const otherScripts = scripts.filter(
                (s) => s != "mint_order_validator"
            )

            it("fails if not in mint_order_validator", () => {
                new ScriptContextBuilder()
                    .addMintOrderInput({
                        value: inputValue,
                        datum: mintOrder,
                        redeemer
                    })
                    .addMintOrderReturn({ address, datum, value: inputValue })
                    .use((ctx) => {
                        otherScripts.forEach((currentScript) => {
                            throws(() => {
                                diff.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    self: mintOrder
                                })
                            })
                        })
                    })
            })
        })
    })

    describe("the order input contains lovelace and a number of tokens of a single asset class", () => {
        const ac = AssetClass.dummy()
        const inputValue = new Value(
            10_000_000,
            Assets.fromAssetClasses([[ac, 1000]])
        )

        describe("for the mint_order_validator", () => {
            it("returns a positive assets quantity if only the order lovelace quantity is returned", () => {
                new ScriptContextBuilder()
                    .addMintOrderInput({
                        value: inputValue,
                        datum: mintOrder,
                        redeemer
                    })
                    .addMintOrderReturn({
                        address,
                        datum,
                        value: new Value(10_000_000)
                    })
                    .use((ctx) => {
                        const value = diff.eval({
                            $currentScript: "mint_order_validator",
                            $scriptContext: ctx,
                            self: mintOrder
                        })

                        strictEqual(value.assets.assets.length, 1)
                        strictEqual(
                            value.assetClasses[0].toFingerprint(),
                            ac.toFingerprint()
                        )
                        strictEqual(value.assets.getQuantity(ac), 1000n)
                    })
            })
        })

        describe("for all other validators", () => {
            const otherScripts = scripts.filter(
                (s) => s != "mint_order_validator"
            )

            it("throws an error", () => {
                new ScriptContextBuilder()
                    .addMintOrderInput({
                        value: inputValue,
                        datum: mintOrder,
                        redeemer
                    })
                    .addMintOrderReturn({
                        address,
                        datum,
                        value: new Value(10_000_000)
                    })
                    .use((ctx) => {
                        otherScripts.forEach((currentScript) => {
                            throws(() => {
                                diff.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    self: mintOrder
                                })
                            })
                        })
                    })
            })
        })
    })
})

describe("MintOrderModule::MintOrder::price_expiry", () => {
    const mintOrder = makeMintOrder({
        maxPriceAge: 100
    })

    it("returns tx.time_range.end - order.max_price_age", () => {
        new ScriptContextBuilder().setTimeRange({ end: 200 }).use((ctx) => {
            strictEqual(
                price_expiry.eval({
                    $scriptContext: ctx,
                    self: mintOrder
                }),
                100
            )
        })
    })

    it("throws an error if tx.time_range.end is not set", () => {
        new ScriptContextBuilder().use((ctx) => {
            throws(() => {
                price_expiry.eval({
                    $scriptContext: ctx,
                    self: mintOrder
                })
            })
        })
    })
})

describe("MintOrderModule::MintOrder::returned_tokens", () => {
    const address = Address.dummy(false)
    const datum = new IntData(0)
    const mintOrder = makeMintOrder({
        address,
        datum
    })
    const redeemer: MintOrderRedeemerType = { Fulfill: { ptrs: [] } }

    describe("the order input contains lovelace and some tokens of a single asset class", () => {
        const inputValue = new Value(
            10_000_000,
            Assets.fromAssetClasses([[AssetClass.dummy(), 10000]])
        )

        it("returns the number of DVP tokens contained in the return value", () => {
            const nDvpTokens = 1000n
            const returnValue = new Value(2_000_000, makeDvpTokens(nDvpTokens))

            new ScriptContextBuilder()
                .addMintOrderInput({
                    value: inputValue,
                    datum: mintOrder,
                    redeemer
                })
                .addMintOrderReturn({
                    address,
                    datum,
                    value: returnValue
                })
                .use((ctx) => {
                    strictEqual(
                        returned_tokens.eval({
                            $currentScript: "mint_order_validator",
                            $scriptContext: ctx,
                            self: mintOrder
                        }),
                        nDvpTokens
                    )
                })
        })

        it("throws an error if no DVP tokens are returned", () => {
            const returnValue = new Value(2_000_000, makeDvpTokens(0))

            new ScriptContextBuilder()
                .addMintOrderInput({
                    value: inputValue,
                    datum: mintOrder,
                    redeemer
                })
                .addMintOrderReturn({
                    address,
                    datum,
                    value: returnValue
                })
                .use((ctx) => {
                    throws(() => {
                        returned_tokens.eval({
                            $currentScript: "mint_order_validator",
                            $scriptContext: ctx,
                            self: mintOrder
                        })
                    })
                })
        })
    })
})

describe("MintOrderModule::MintOrder::value", () => {
    const address = Address.dummy(false)
    const datum = new IntData(0)
    const mintOrder = makeMintOrder({
        address,
        datum
    })
    const redeemer: MintOrderRedeemerType = { Fulfill: { ptrs: [] } }

    describe("the order input contains only lovelace", () => {
        const lovelace = 2_000_000n
        const inputValue = new Value(2_000_000n)

        it("returns the positive input lovelace value if zero is returned", () => {
            const returnedValue = new Value(0)

            new ScriptContextBuilder()
                .addMintOrderInput({
                    value: inputValue,
                    datum: mintOrder,
                    redeemer
                })
                .addMintOrderReturn({
                    address,
                    datum,
                    value: returnedValue
                })
                .use((ctx) => {
                    const value = get_value.eval({
                        $scriptContext: ctx,
                        $currentScript: "mint_order_validator",
                        self: mintOrder
                    })

                    strictEqual(value.lovelace, lovelace)
                    deepEqual(value.assets.assets, [])
                })
        })

        it("returns only the positive input lovelace if zero lovelace and some DVP tokens are returned (the DVP tokens are ignored)", () => {
            const returnedValue = new Value(0, makeDvpTokens(1000))

            new ScriptContextBuilder()
                .addMintOrderInput({
                    value: inputValue,
                    datum: mintOrder,
                    redeemer: { Fulfill: { ptrs: [] } }
                })
                .addMintOrderReturn({
                    address,
                    datum,
                    value: returnedValue
                })
                .use((ctx) => {
                    const value = get_value.eval({
                        $scriptContext: ctx,
                        $currentScript: "mint_order_validator",
                        self: mintOrder
                    })

                    strictEqual(value.lovelace, 2_000_000n)
                    deepEqual(value.assets.assets, [])
                })
        })
    })
})

describe("MintOrderModule::MintOrder::value_lovelace", () => {
    const address = Address.dummy(false)
    const datum = new IntData(0)
    const maxPriceAge = 100
    const mintOrder = makeMintOrder({
        address,
        datum,
        maxPriceAge
    })

    describe("the order input contains only lovelace", () => {
        const inputValue = new Value(10_000_000)

        it("returns zero if the order is redeemed with an empty asset pointers list and if precisely the order input value is returned", () => {
            new ScriptContextBuilder()
                .addMintOrderInput({
                    value: inputValue,
                    datum: mintOrder,
                    redeemer: { Fulfill: { ptrs: [] } }
                })
                .addMintOrderReturn({
                    address,
                    datum,
                    value: inputValue
                })
                .setTimeRange({ end: 200 })
                .use((ctx) => {
                    strictEqual(
                        value_lovelace.eval({
                            $currentScript: "mint_order_validator",
                            $scriptContext: ctx,
                            self: mintOrder,
                            ptrs: []
                        }),
                        0n
                    )
                })
        })

        it("returns a positive lovelace value if the order is redeemed with a single dummy asset pointer and only (less) lovelace is returned", () => {
            const ptrs: AssetPtrType[] = [
                makeAssetPtr({ groupIndex: 100, assetClassIndex: 100 })
            ]

            new ScriptContextBuilder()
                .addMintOrderInput({
                    value: inputValue,
                    datum: mintOrder,
                    redeemer: { Fulfill: { ptrs } }
                })
                .addMintOrderReturn({
                    address,
                    datum,
                    value: new Value(8_000_000)
                })
                .setTimeRange({ end: 200 })
                .use((ctx) => {
                    strictEqual(
                        value_lovelace.eval({
                            $currentScript: "mint_order_validator",
                            $scriptContext: ctx,
                            self: mintOrder,
                            ptrs
                        }),
                        2_000_000n
                    )
                })
        })

        it("throws an error if more lovelace is returned but no asset pointers are specified", () => {
            const returnValue = new Value(12_000_000)

            const ptrs: AssetPtrType[] = []

            new ScriptContextBuilder()
                .addMintOrderInput({
                    value: inputValue,
                    datum: mintOrder,
                    redeemer: { Fulfill: { ptrs } }
                })
                .addMintOrderReturn({
                    address,
                    datum,
                    value: returnValue
                })
                .setTimeRange({ end: 200 })
                .use((ctx) => {
                    throws(() => {
                        value_lovelace.eval({
                            $currentScript: "mint_order_validator",
                            $scriptContext: ctx,
                            self: mintOrder,
                            ptrs
                        })
                    })
                })
        })
    })

    describe("the order input contains lovelace and two other asset class tokens", () => {
        const ac0 = AssetClass.dummy(0)
        const ac1 = AssetClass.dummy(1)
        const inputValue = new Value(
            2_000_000,
            Assets.fromAssetClasses([
                [ac0, 10],
                [ac1, 100]
            ])
        )

        it("returns the correct lovelace sum if some lovelace and DVP tokens are returned", () => {
            const returnValue = new Value(10_000_000, makeDvpTokens(100))

            // the correct order of these AssetPtrs was determined by trial-and-error
            const ptrs: AssetPtrType[] = [
                // dummy asset ptr for lovelace
                makeAssetPtr({ groupIndex: 100, assetClassIndex: 100 }),
                makeAssetPtr({ groupIndex: 1, assetClassIndex: 0 }),
                makeAssetPtr({ groupIndex: 1, assetClassIndex: 1 })
            ]

            new ScriptContextBuilder()
                .addMintOrderInput({
                    value: inputValue,
                    datum: mintOrder,
                    redeemer: { Fulfill: { ptrs } }
                })
                .addMintOrderReturn({
                    address,
                    datum,
                    value: returnValue
                })
                .setTimeRange({ end: 200 })
                .addAssetGroupInput({
                    assets: [
                        makeAsset({
                            assetClass: ac0,
                            price: [200_000, 1],
                            priceTimestamp: 100
                        }),
                        makeAsset({
                            assetClass: ac1,
                            price: [300_000, 2],
                            priceTimestamp: 120
                        })
                    ],
                    id: 0
                })
                .use((ctx) => {
                    strictEqual(
                        value_lovelace.eval({
                            $currentScript: "mint_order_validator",
                            $scriptContext: ctx,
                            self: mintOrder,
                            ptrs
                        }),
                        9_000_000n
                    )
                })
        })
    })
})

describe("MintOrderModule::MintOrder::voucher_id", () => {
    const address = Address.dummy(false)
    const datum = new IntData(0)
    const mintOrder = makeMintOrder({
        address,
        datum
    })
    const redeemer: MintOrderRedeemerType = { Fulfill: { ptrs: [] } }

    describe("the order input contains lovelace and includes a voucher user nft", () => {
        const voucherId = 0n
        const token = makeVoucherUserToken(0)
        const inputValue = new Value(10_000_000, token)

        describe("for the mint_order_validator", () => {
            it("returns the voucher id of the voucher included in the order input if the returned value doesn't contain the voucher", () => {
                const returnValue = new Value(12_000_000)

                new ScriptContextBuilder()
                    .addMintOrderInput({
                        value: inputValue,
                        datum: mintOrder,
                        redeemer
                    })
                    .addMintOrderReturn({
                        address,
                        datum,
                        value: returnValue
                    })
                    .use((ctx) => {
                        strictEqual(
                            voucher_id.eval({
                                $currentScript: "mint_order_validator",
                                $scriptContext: ctx,
                                self: mintOrder
                            }),
                            voucherId
                        )
                    })
            })

            it("throws an error if the voucher is returned", () => {
                const returnValue = new Value(12_000_000, token)

                new ScriptContextBuilder()
                    .addMintOrderInput({
                        value: inputValue,
                        datum: mintOrder,
                        redeemer
                    })
                    .addMintOrderReturn({
                        address,
                        datum,
                        value: returnValue
                    })
                    .use((ctx) => {
                        throws(() => {
                            voucher_id.eval({
                                $currentScript: "mint_order_validator",
                                $scriptContext: ctx,
                                self: mintOrder
                            })
                        })
                    })
            })
        })

        describe("for the other validators", () => {
            const otherScripts = scripts.filter(
                (s) => s != "mint_order_validator"
            )

            it("throws an error", () => {
                const returnValue = new Value(12_000_000)

                new ScriptContextBuilder()
                    .addMintOrderInput({
                        value: inputValue,
                        datum: mintOrder,
                        redeemer
                    })
                    .addMintOrderReturn({
                        address,
                        datum,
                        value: returnValue
                    })
                    .use((ctx) => {
                        otherScripts.forEach((currentScript) => {
                            throws(() => {
                                voucher_id.eval({
                                    $currentScript: currentScript,
                                    $scriptContext: ctx,
                                    self: mintOrder
                                })
                            })
                        })
                    })
            })
        })
    })
})
