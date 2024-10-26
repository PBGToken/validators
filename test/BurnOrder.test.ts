import { deepEqual, strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { Address, AssetClass, Assets, Value } from "@helios-lang/ledger"
import { IntData, UplcData } from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"
import { scripts } from "./constants"
import {
    AssetPtrType,
    BurnOrderRedeemerType,
    makeAsset,
    makeAssetPtr,
    makeBurnOrder
} from "./data"
import { makeDvpTokens, makeVoucherPair, makeVoucherUserToken } from "./tokens"
import { ScriptContextBuilder, withScripts } from "./tx"
import { IntLike } from "@helios-lang/codec-utils"

const {
    "BurnOrder::find_return": find_return,
    "BurnOrder::diff": diff,
    "BurnOrder::value": get_value,
    "BurnOrder::value_lovelace": value_lovelace,
    "BurnOrder::price_expiry": price_expiry,
    "BurnOrder::returned_enough": returned_enough
} = contract.BurnOrderModule

describe("BurnOrderModule::BurnOrder::find_return", () => {
    const address = Address.dummy(false)
    const datum = new IntData(0)
    const burnOrder = makeBurnOrder({
        address,
        datum
    })

    const configureContext = (props?: {
        includeDummyOutputAtSameAddress?: boolean
        address?: Address
        datum?: UplcData
    }) => {
        const scb = new ScriptContextBuilder().addDummyOutputs(10)

        if (props?.includeDummyOutputAtSameAddress) {
            scb.addDummyOutput({ address: props?.address ?? address })
        }

        return scb.addBurnOrderReturn({
            address: props?.address ?? address,
            datum: props?.datum ?? datum
        })
    }

    it("returns the corresponding output if found", () => {
        configureContext().use((ctx) => {
            const output = find_return.eval({
                $scriptContext: ctx,
                self: burnOrder
            })

            strictEqual(output.address.toBech32(), address.toBech32())
            strictEqual(output.datum?.data.toSchemaJson(), datum.toSchemaJson())
        })
    })

    it("returns the corresponding output even if another output, with a different datum, is present at the same address", () => {
        configureContext({ includeDummyOutputAtSameAddress: true }).use(
            (ctx) => {
                const output = find_return.eval({
                    $scriptContext: ctx,
                    self: burnOrder
                })

                strictEqual(output.address.toBech32(), address.toBech32())
                strictEqual(
                    output.datum?.data.toSchemaJson(),
                    datum.toSchemaJson()
                )
            }
        )
    })

    it("throws an error if not found due to the output having a different datum", () => {
        configureContext({ datum: new IntData(1) }).use((ctx) => {
            throws(() => [
                find_return.eval({
                    $scriptContext: ctx,
                    self: burnOrder
                })
            ])
        })
    })

    it("throws an error if not found due to the output being at a different address", () => {
        configureContext({ address: Address.dummy(false, 1) }).use((ctx) => {
            throws(() => [
                find_return.eval({
                    $scriptContext: ctx,
                    self: burnOrder
                })
            ])
        })
    })
})

describe("BurnOrderModule::BurnOrder::diff", () => {
    const address = Address.dummy(false)
    const datum = new IntData(0)
    const burnOrder = makeBurnOrder({
        address,
        datum
    })
    const redeemer: BurnOrderRedeemerType = { Fulfill: { ptrs: [] } }

    describe("the order contains only lovelace", () => {
        const inputValue = new Value(10_000_000)

        const configureParentContext = (props?: {
            returnDatum?: UplcData
            returnLovelace?: IntLike
        }) => {
            return new ScriptContextBuilder()
                .addBurnOrderInput({
                    value: inputValue,
                    datum: burnOrder,
                    redeemer
                })
                .addBurnOrderReturn({
                    address,
                    datum: props?.returnDatum ?? datum,
                    value: new Value(props?.returnLovelace ?? 10_000_000)
                })
        }

        describe("@ burn_order_validator", () => {
            const configureContext = withScripts(configureParentContext, [
                "burn_order_validator"
            ])

            it("returns 0 if precisely the order value is returned", () => {
                configureContext().use((currentScript, ctx) => {
                    const value = diff.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        self: burnOrder
                    })

                    strictEqual(value.lovelace, 0n)
                    deepEqual(value.assets.assets, [])
                })
            })

            it("returns a negative lovelace value if more lovelace is returned", () => {
                configureContext({ returnLovelace: 11_000_000 }).use(
                    (currentScript, ctx) => {
                        const value = diff.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            self: burnOrder
                        })

                        strictEqual(value.lovelace, -1_000_000n)
                        deepEqual(value.assets.assets, [])
                    }
                )
            })

            it("returns a positive lovelace value if less lovelace is returned", () => {
                configureContext({ returnLovelace: 9_000_000 }).use(
                    (currentScript, ctx) => {
                        const value = diff.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            self: burnOrder
                        })

                        strictEqual(value.lovelace, 1_000_000n)
                        deepEqual(value.assets.assets, [])
                    }
                )
            })

            it("throws an error if the return UTxO doesn't have the expected datum", () => {
                configureContext({ returnDatum: new IntData(1) }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            diff.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                self: burnOrder
                            })
                        })
                    }
                )
            })
        })

        describe("@ all other validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts.filter((s) => s != "burn_order_validator")
            )

            it("throws an error", () => {
                configureContext().use((currentScript, ctx) => {
                    throws(() => {
                        diff.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            self: burnOrder
                        })
                    })
                })
            })
        })
    })

    describe("the order input contains lovelace and a number of tokens of a single asset class", () => {
        const assetClass = AssetClass.dummy()
        const nTokens = 1000n
        const inputValue = new Value(
            10_000_000,
            Assets.fromAssetClasses([[assetClass, nTokens]])
        )

        const configureParentContext = () => {
            return new ScriptContextBuilder()
                .addBurnOrderInput({
                    value: inputValue,
                    datum: burnOrder,
                    redeemer
                })
                .addBurnOrderReturn({
                    address,
                    datum,
                    value: new Value(10_000_000)
                })
        }

        describe("@ burn_order_validator", () => {
            const configureContext = withScripts(configureParentContext, [
                "burn_order_validator"
            ])

            it("returns a positive assets quantity if only the order lovelace quantity is returned", () => {
                configureContext().use((currentScript, ctx) => {
                    const value = diff.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        self: burnOrder
                    })

                    strictEqual(value.assets.assets.length, 1)
                    strictEqual(
                        value.assetClasses[0].toFingerprint(),
                        assetClass.toFingerprint()
                    )
                    strictEqual(value.assets.getQuantity(assetClass), nTokens)
                })
            })
        })

        describe("@ all other validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts.filter((s) => s != "burn_order_validator")
            )

            it("throws an error", () => {
                configureContext().use((currentScript, ctx) => {
                    throws(() => {
                        diff.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            self: burnOrder
                        })
                    })
                })
            })
        })
    })
})

describe("BurnOrderModule::BurnOrder::value", () => {
    const address = Address.dummy(false)
    const datum = new IntData(0)
    const burnOrder = makeBurnOrder({
        address,
        datum
    })
    const redeemer: BurnOrderRedeemerType = { Fulfill: { ptrs: [] } }

    describe("the order input contains only lovelace", () => {
        const lovelace = 2_000_000n
        const inputValue = new Value(lovelace)

        const configureParentContext = () => {
            return new ScriptContextBuilder()
                .addBurnOrderInput({
                    value: inputValue,
                    datum: burnOrder,
                    redeemer
                })
                .addBurnOrderReturn({
                    address,
                    datum,
                    value: new Value(0)
                })
        }

        describe("@ burn_order_validator", () => {
            const configureContext = withScripts(configureParentContext, [
                "burn_order_validator"
            ])

            it("BurnOrderModule::BurnOrder::value #01 (returns the negative input lovelace if zero is returned)", () => {
                configureContext().use((currentScript, ctx) => {
                    const value = get_value.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        self: burnOrder
                    })

                    strictEqual(value.lovelace, -lovelace)
                    deepEqual(value.assets.assets, [])
                })
            })
        })
    })

    describe("the order input contains lovelace and some DVP tokens", () => {
        const lovelace = 2_000_000n
        const inputValue = new Value(lovelace, makeDvpTokens(1000))

        const configureParentContext = () => {
            return new ScriptContextBuilder()
                .addBurnOrderInput({
                    value: inputValue,
                    datum: burnOrder,
                    redeemer
                })
                .addBurnOrderReturn({
                    address,
                    datum,
                    value: new Value(0)
                })
        }

        describe("@ burn_order_validator", () => {
            const configureContext = withScripts(configureParentContext, [
                "burn_order_validator"
            ])

            it("BurnOrderModule::BurnOrder::value #02 (returns the negative input lovelace (i.e. without the DVP tokens))", () => {
                configureContext().use((currentScript, ctx) => {
                    const value = get_value.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        self: burnOrder
                    })

                    strictEqual(value.lovelace, -lovelace)
                    deepEqual(value.assets.assets, [])
                })
            })
        })
    })

    describe("the order input contains lovelace, some DVP tokens and two voucher pairs", () => {
        const lovelace = 2_000_000n
        const inputValue = new Value(
            lovelace,
            makeDvpTokens(1000).add(makeVoucherPair(1).add(makeVoucherPair(2)))
        )

        const configureParentContext = () => {
            return new ScriptContextBuilder()
                .addBurnOrderInput({
                    value: inputValue,
                    datum: burnOrder,
                    redeemer
                })
                .addBurnOrderReturn({
                    address,
                    datum,
                    value: new Value(0)
                })
        }

        describe("@ burn_order_validator", () => {
            const configureContext = withScripts(configureParentContext, [
                "burn_order_validator"
            ])

            it("BurnOrderModule::BurnOrder::value #03 (returns the negative input lovelace (i.e. without the DVP tokens and vouchers))", () => {
                configureContext().use((currentScript, ctx) => {
                    const value = get_value.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        self: burnOrder
                    })

                    strictEqual(value.lovelace, -lovelace)
                    deepEqual(value.assets.assets, [])
                })
            })
        })
    })

    describe("the order input contains lovelace and some DVP tokens and the output contains a voucher pair", () => {
        const lovelace = 2_000_000n
        const inputValue = new Value(lovelace, makeDvpTokens(1000))

        const configureParentContext = () => {
            return new ScriptContextBuilder()
                .addBurnOrderInput({
                    value: inputValue,
                    datum: burnOrder,
                    redeemer
                })
                .addBurnOrderReturn({
                    address,
                    datum,
                    value: new Value(0, makeVoucherPair(2))
                })
        }

        describe("@ burn_order_validator", () => {
            const configureContext = withScripts(configureParentContext, [
                "burn_order_validator"
            ])

            it("BurnOrderModule::BurnOrder::value #04 (throws an error because nothing from the policy can be returned)", () => {
                configureContext().use((currentScript, ctx) => {
                    throws(() => {
                        get_value.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            self: burnOrder
                        })
                    }, /can't return new dvp policy related tokens/)
                })
            })
        })
    })
})

describe("BurnOrderModule::BurnOrder::value_lovelace", () => {
    const address = Address.dummy(false)
    const datum = new IntData(0)
    const maxPriceAge = 100
    const burnOrder = makeBurnOrder({
        address,
        datum,
        maxPriceAge
    })

    describe("the order input contains only lovelace", () => {
        const inputValue = new Value(10_000_000)

        const configureContext = (props: {
            ptrs: AssetPtrType[]
            returnValue?: Value
        }) => {
            return new ScriptContextBuilder()
                .addBurnOrderInput({
                    value: inputValue,
                    datum: burnOrder,
                    redeemer: { Fulfill: { ptrs: props.ptrs } }
                })
                .addBurnOrderReturn({
                    address,
                    datum,
                    value: props?.returnValue ?? inputValue
                })
                .setTimeRange({ end: 200 })
        }

        it("returns zero if the order is redeemed with an empty asset pointers list and if precisely the order input value is returned", () => {
            const ptrs: AssetPtrType[] = []

            configureContext({ ptrs }).use((ctx) => {
                strictEqual(
                    value_lovelace.eval({
                        $currentScript: "burn_order_validator",
                        $scriptContext: ctx,
                        self: burnOrder,
                        ptrs
                    }),
                    0n
                )
            })
        })

        it("returns a positive lovelace value if the order is redeemed with a single dummy asset pointer and only (more) lovelace is returned", () => {
            const ptrs: AssetPtrType[] = [
                makeAssetPtr({ groupIndex: 100, assetClassIndex: 100 })
            ]

            configureContext({ ptrs, returnValue: new Value(12_000_000) }).use(
                (ctx) => {
                    strictEqual(
                        value_lovelace.eval({
                            $currentScript: "burn_order_validator",
                            $scriptContext: ctx,
                            self: burnOrder,
                            ptrs
                        }),
                        2_000_000n
                    )
                }
            )
        })

        it("throws an error if more lovelace is returned but no asset pointers are specified", () => {
            const ptrs: AssetPtrType[] = []

            configureContext({ ptrs, returnValue: new Value(12_000_000) }).use(
                (ctx) => {
                    throws(() => {
                        value_lovelace.eval({
                            $currentScript: "burn_order_validator",
                            $scriptContext: ctx,
                            self: burnOrder,
                            ptrs
                        })
                    })
                }
            )
        })
    })

    describe("the order input contains lovelace and some DVP tokens", () => {
        const inputValue = new Value(10_000_000, makeDvpTokens(100))

        it("returns the correct lovelace sum if some lovelace and two additional asset class tokens are returned", () => {
            const ac0 = AssetClass.dummy(0)
            const ac1 = AssetClass.dummy(1)
            const returnValue = new Value(
                2_000_000,
                Assets.fromAssetClasses([
                    [ac0, 10],
                    [ac1, 100]
                ])
            )

            // the correct order of these AssetPtrs was determined by trial-and-error
            const ptrs: AssetPtrType[] = [
                // dummy asset ptr for lovelace
                makeAssetPtr({ groupIndex: 100, assetClassIndex: 100 }),
                makeAssetPtr({ groupIndex: 1, assetClassIndex: 0 }),
                makeAssetPtr({ groupIndex: 1, assetClassIndex: 1 })
            ]

            new ScriptContextBuilder()
                .addBurnOrderInput({
                    value: inputValue,
                    datum: burnOrder,
                    redeemer: { Fulfill: { ptrs } }
                })
                .addBurnOrderReturn({
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
                            $currentScript: "burn_order_validator",
                            $scriptContext: ctx,
                            self: burnOrder,
                            ptrs
                        }),
                        9_000_000n
                    )
                })
        })
    })
})

describe("BurnOrderModule::BurnOrder::price_expiry", () => {
    const burnOrder = makeBurnOrder({
        maxPriceAge: 100
    })

    it("returns tx.time_range.end - order.max_price_age", () => {
        new ScriptContextBuilder().setTimeRange({ end: 200 }).use((ctx) => {
            strictEqual(
                price_expiry.eval({
                    $scriptContext: ctx,
                    self: burnOrder
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
                    self: burnOrder
                })
            })
        })
    })
})

describe("BurnOrderModule::BurnOrder::returned_enough", () => {
    const address = Address.dummy(false)
    const datum = new IntData(0)
    const maxPriceAge = 100

    describe("the order datum request pure lovelace and the order input contains a smaller amount of lovelace and some DVP tokens", () => {
        const burnOrder = makeBurnOrder({
            address,
            datum,
            lovelace: 10_000_000,
            maxPriceAge
        })
        const inputValue = new Value(2_000_000, makeDvpTokens(10))
        const ptrs: AssetPtrType[] = [
            // dummy ptr for lovelace
            makeAssetPtr({ groupIndex: 100, assetClassIndex: 100 })
        ]
        const redeemer: BurnOrderRedeemerType = { Fulfill: { ptrs: ptrs } }

        const configureContext = (props?: { returnLovelace?: IntLike }) => {
            return new ScriptContextBuilder()
                .addBurnOrderInput({
                    value: inputValue,
                    datum: burnOrder,
                    redeemer
                })
                .addBurnOrderReturn({
                    address,
                    datum,
                    value: new Value(props?.returnLovelace ?? 12_000_000)
                })
                .setTimeRange({ end: 200 })
        }

        it("returns true if enough lovelace is returned", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    returned_enough.eval({
                        $currentScript: "burn_order_validator",
                        $scriptContext: ctx,
                        self: burnOrder,
                        ptrs
                    }),
                    true
                )
            })
        })

        it("returns false if not enough lovelace returned", () => {
            configureContext({ returnLovelace: 11_999_999 }).use((ctx) => {
                strictEqual(
                    returned_enough.eval({
                        $currentScript: "burn_order_validator",
                        $scriptContext: ctx,
                        self: burnOrder,
                        ptrs
                    }),
                    false
                )
            })
        })
    })

    describe("the order datum requests some tokens from a single asset class and the order input contains some lovelace and DVP tokens", () => {
        const ac = AssetClass.dummy()
        const requestedAssets = Assets.fromAssetClasses([[ac, 10]])
        const burnOrder = makeBurnOrder({
            address,
            datum,
            value: new Value(0, requestedAssets),
            maxPriceAge
        })
        const inputValue = new Value(2_000_000, makeDvpTokens(10))

        // no asset pointers are required when the order request a precise return value, as the value doesn't need to be reduced
        const ptrs: AssetPtrType[] = []
        const redeemer: BurnOrderRedeemerType = { Fulfill: { ptrs } }

        const configureContext = (props?: {
            returnLovelace?: IntLike
            returnValue?: Value
        }) => {
            return new ScriptContextBuilder()
                .addBurnOrderInput({
                    value: inputValue,
                    datum: burnOrder,
                    redeemer
                })
                .addBurnOrderReturn({
                    address,
                    datum,
                    value:
                        props?.returnValue ??
                        new Value(
                            props?.returnLovelace ?? 2_000_000,
                            requestedAssets
                        )
                })
                .setTimeRange({ end: 200 })
        }

        it("returns true if enough asset class tokens and precisely the input lovelace is returned", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    returned_enough.eval({
                        $currentScript: "burn_order_validator",
                        $scriptContext: ctx,
                        self: burnOrder,
                        ptrs
                    }),
                    true
                )
            })
        })

        it("returns false if not all the input lovelace is returned", () => {
            configureContext({ returnLovelace: 1_999_999 }).use((ctx) => {
                strictEqual(
                    returned_enough.eval({
                        $currentScript: "burn_order_validator",
                        $scriptContext: ctx,
                        self: burnOrder,
                        ptrs
                    }),
                    false
                )
            })
        })

        it("returns false if not enough asset class tokens are returned", () => {
            configureContext({
                returnValue: new Value(
                    2_000_000,
                    Assets.fromAssetClasses([[ac, 9]])
                )
            }).use((ctx) => {
                strictEqual(
                    returned_enough.eval({
                        $currentScript: "burn_order_validator",
                        $scriptContext: ctx,
                        self: burnOrder,
                        ptrs
                    }),
                    false
                )
            })
        })
    })
})
