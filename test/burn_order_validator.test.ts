import { strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import {
    type ShelleyAddress,
    makeAddress,
    makeDummyPubKeyHash,
    makeValue,
    type PubKeyHash,
    type Value,
    makeDummyAssetClass,
    makeAssets
} from "@helios-lang/ledger"
import { makeConstrData, makeIntData } from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"
import { MAX_SCRIPT_SIZE } from "./constants"
import {
    BurnOrderRedeemerType,
    BurnOrderType,
    RatioType,
    makeAsset,
    makeAssetPtr,
    makeBurnOrder,
    makeConfig,
    makePrice,
    makeSuccessFee,
    makeSupply,
    makeVoucher
} from "./data"
import { ScriptContextBuilder } from "./tx"
import { makeDvpTokens, makeVoucherUserToken } from "./tokens"
import { IntLike } from "@helios-lang/codec-utils"

const { calc_provisional_success_fee, main } = contract.burn_order_validator

describe("burn_order_validator::calc_provisional_success_fee", () => {
    describe("config UTxO is referenced and supply UTxO is spent, no vouchers are burned", () => {
        const configureContext = () => {
            const benchmarkPrice: RatioType = [1, 1]
            const startPrice: RatioType = [100000, 1000]
            const successFee = makeSuccessFee({
                c0: 0,
                steps: [{ c: 0.3, sigma: 1.05 }]
            })
            const config = makeConfig({
                successFee
            })
            const supply = makeSupply({ startPrice })

            return new ScriptContextBuilder()
                .addConfigRef({ config })
                .addSupplyInput({ supply })
                .observeBenchmark({ redeemer: benchmarkPrice })
        }

        it("burn_order_validator::calc_provisional_success_fee #01 (whitepaper example)", () => {
            const price = makePrice({ top: 140000, bottom: 1000 })

            configureContext().use((ctx) => {
                strictEqual(
                    calc_provisional_success_fee.eval({
                        $scriptContext: ctx,
                        price,
                        diff: makeValue(0, makeDvpTokens(10_000_000)),
                        n_burn: 10_000_000
                    }),
                    750_000n
                )
            })
        })
    })

    describe("config UTxO is referenced and supply UTxO is spent, 1 voucher is burned", () => {
        const voucherId = 0

        const configureContext = () => {
            const benchmarkPrice: RatioType = [1, 1]
            const startPrice: RatioType = [100, 1]
            const successFee = makeSuccessFee({
                c0: 0,
                steps: [{ c: 0.3, sigma: 1.05 }]
            })
            const config = makeConfig({
                successFee
            })
            const supply = makeSupply({ startPrice })
            const voucherDatum = makeVoucher({
                tokens: 5_000_000,
                price: [120, 1]
            })

            return new ScriptContextBuilder()
                .addConfigRef({ config })
                .addSupplyInput({ supply })
                .observeBenchmark({ redeemer: benchmarkPrice })
                .addVoucherInput({ id: voucherId, voucher: voucherDatum })
        }

        it("burn_order_validator::calc_provisional_success_fee #02 (whitepaper example)", () => {
            const price = makePrice({ top: 140, bottom: 1 })

            configureContext().use((ctx) => {
                strictEqual(
                    calc_provisional_success_fee.eval({
                        $scriptContext: ctx,
                        price,
                        diff: makeValue(
                            0,
                            makeDvpTokens(10_000_000).add(
                                makeVoucherUserToken(voucherId)
                            )
                        ),
                        n_burn: 10_000_000
                    }),
                    525_000n
                )
            })
        })

        it("burn_order_validator::calc_provisional_success_fee #03 (return value bound by 0 only the voucher and no DVP tokens are burned)", () => {
            const price = makePrice({ top: 140, bottom: 1 })

            configureContext().use((ctx) => {
                strictEqual(
                    calc_provisional_success_fee.eval({
                        $scriptContext: ctx,
                        price,
                        diff: makeValue(0, makeVoucherUserToken(voucherId)),
                        n_burn: 0
                    }),
                    0n
                )
            })
        })
    })
})

describe("burn_order_validator::main", () => {
    describe("garbage arguments", () => {
        it("burn_order_validator::main #01 (throws an error for garbage args)", () => {
            throws(() => {
                main.evalUnsafe({
                    $scriptContext: makeConstrData(0, []),
                    order: makeIntData(0),
                    redeemer: makeIntData(0)
                })
            }, /empty list in headList/)
        })
    })

    describe("Cancel redeemer", () => {
        const redeemer: BurnOrderRedeemerType = {
            Cancel: {}
        }
        const pkh = makeDummyPubKeyHash(10)
        const returnAddress = makeAddress(false, pkh)
        const burnOrder = makeBurnOrder({
            address: returnAddress
        })

        const configureContext = (props?: {
            pkh?: PubKeyHash
            dummyInputAddr?: ShelleyAddress<any>
        }) => {
            const scb = new ScriptContextBuilder()
                .addBurnOrderInput({
                    redeemer,
                    datum: burnOrder
                })
                .addDummySigners(10)
                .addSigner(props?.pkh ?? pkh)

            if (props?.dummyInputAddr) {
                scb.addDummyInput({ address: props.dummyInputAddr })
            }

            return scb
        }

        it("burn_order_validator::main #02 (succeeds if the tx signed by the address pubkey)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        order: burnOrder,
                        redeemer
                    }),
                    undefined
                )
            })
        })

        it("burn_order_validator::main #03 (throws an error if the tx isn't signed by the address pubkey)", () => {
            configureContext({ pkh: makeDummyPubKeyHash(1) }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        order: burnOrder,
                        redeemer
                    })
                }, /cancelation not approved by owner/)
            })
        })

        it("burn_order_validator::main #04 (succeeds if the tx isn't signed by the address pubkey but an input is spent from the same address)", () => {
            configureContext({
                pkh: makeDummyPubKeyHash(1),
                dummyInputAddr: returnAddress
            }).use((ctx) => {
                strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        order: burnOrder,
                        redeemer
                    }),
                    undefined
                )
            })
        })
    })

    describe("Fulfill redeemer", () => {
        const pkh = makeDummyPubKeyHash(10)
        const returnAddress = makeAddress(false, pkh)
        const returnDatum = makeIntData(1)
        const burnOrder = makeBurnOrder({
            address: returnAddress,
            datum: returnDatum,
            lovelace: 625_000_000,
            maxPriceAge: 100
        })
        const redeemer: BurnOrderRedeemerType = {
            Fulfill: {
                ptrs: [makeAssetPtr()] // dummy AssetPtr for ADA
            }
        }
        const agent = makeDummyPubKeyHash(123)

        const configureContext = (props?: {
            agent?: PubKeyHash
            burnOrder?: BurnOrderType
            priceTimestamp?: number
            returnLovelace?: IntLike
            returnValue?: Value
            voucher?: {
                price: RatioType
                nTokens: IntLike
                id?: IntLike
            }
        }) => {
            const startPrice: RatioType = [100, 1]
            const price = makePrice({
                top: 140,
                bottom: 1,
                timestamp: props?.priceTimestamp ?? 120
            })
            const successFee = makeSuccessFee({
                c0: 0,
                steps: [{ c: 0.3, sigma: 1.05 }]
            })

            const config = makeConfig({
                agent,
                successFee,
                token: {
                    maxPriceAge: 100
                },
                burnFee: {
                    relative: 0.005,
                    minimum: 20_000
                }
            })

            const supply = makeSupply({ startPrice })
            let burnedTokens = makeDvpTokens(5_000_000)

            if (props?.voucher) {
                burnedTokens = burnedTokens.add(
                    makeVoucherUserToken(props.voucher.id ?? 0)
                )
            }

            const scb = new ScriptContextBuilder()
                .addConfigRef({ config })
                .addSupplyInput({ supply })
                .addPriceRef({ price })
                .observeBenchmark({ redeemer: [1, 1] })
                .addBurnOrderInput({
                    datum: props?.burnOrder ?? burnOrder,
                    redeemer,
                    value: makeValue(0, burnedTokens)
                })
                .addBurnOrderReturn({
                    address: returnAddress,
                    datum: returnDatum,
                    value:
                        props?.returnValue ??
                        makeValue(props?.returnLovelace ?? 644_262_500)
                })
                .addSigner(props?.agent ?? agent)
                .setTimeRange({ end: 200 })

            if (props?.voucher) {
                scb.addVoucherInput({
                    id: props.voucher.id ?? 0,
                    voucher: makeVoucher({
                        address: returnAddress,
                        datum: returnDatum,
                        tokens: props.voucher.nTokens,
                        price: props.voucher.price
                    })
                })
            }

            return scb
        }

        it("burn_order_validator::main #05 (succeeds if enough lovelace returned)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        order: burnOrder,
                        redeemer
                    }),
                    undefined
                )
            })
        })

        it("burn_order_validator::main #06 (throws an error if not signed by agent)", () => {
            configureContext({ agent: makeDummyPubKeyHash() }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        order: burnOrder,
                        redeemer
                    })
                }, /not signed by agent/)
            })
        })

        it("burn_order_validator::main #07 (throws an error if price timestamp is too old)", () => {
            configureContext({ priceTimestamp: 99 }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        order: burnOrder,
                        redeemer
                    })
                }, /price expired/)
            })
        })

        it("burn_order_validator::main #08 (throws an error if not enough lovelace returned according to contract)", () => {
            configureContext({ returnLovelace: 643_000_000 }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        order: burnOrder,
                        redeemer
                    })
                }, /not enough value returned .as required by contract/)
            })
        })

        it("burn_order_validator::main #09 (throws an error if not enough lovelace is returned according to order)", () => {
            const burnOrder = makeBurnOrder({
                address: returnAddress,
                datum: returnDatum,
                lovelace: 650_000_000,
                maxPriceAge: 100
            })

            configureContext({ burnOrder, returnLovelace: 645_000_000 }).use(
                (ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            order: burnOrder,
                            redeemer
                        })
                    }, /not enough value returned .as requested by user/)
                }
            )
        })

        it("burn_order_validator::main #10 (throws an error if the price is too old for the order)", () => {
            const burnOrder = makeBurnOrder({
                address: returnAddress,
                datum: returnDatum,
                lovelace: 645_000_000,
                maxPriceAge: 50
            })

            configureContext({ burnOrder, returnLovelace: 645_000_000 }).use(
                (ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            order: burnOrder,
                            redeemer
                        })
                    }, /price expired/)
                }
            )
        })

        it("burn_order_validator::main #11 (throws an error when attempting to return something that isn't listed in a referenced asset group)", () => {
            configureContext({
                returnValue: makeValue(
                    644_262_500,
                    makeAssets([[makeDummyAssetClass(10), 100]])
                )
            }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        order: burnOrder,
                        redeemer
                    })
                }, /empty list in tailList/)
            })
        })

        it("burn_order_validator::main #12 (throws an error if not all the requested assets are returned)", () => {
            const burnOrder = makeBurnOrder({
                address: returnAddress,
                datum: returnDatum,
                value: makeValue(
                    644_000_000,
                    makeAssets([[makeDummyAssetClass(), 10]])
                )
            })

            configureContext({ burnOrder }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        order: burnOrder,
                        redeemer
                    })
                }, /not enough value returned .as requested by user/)
            })
        })

        it("burn_order_validator::main #13 (succeeds if the burn order use the value enum variant instead of the lovelace enum variant but requests only lovelace)", () => {
            const burnOrder = makeBurnOrder({
                address: returnAddress,
                datum: returnDatum,
                value: makeValue(
                    644_000_000,
                    makeAssets([[makeDummyAssetClass(), 0]])
                )
            })

            configureContext({ burnOrder }).use((ctx) => {
                strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        order: burnOrder,
                        redeemer
                    }),
                    undefined
                )
            })
        })

        it("burn_order_validator::main #14 (throws an error if not all the requested assets are returned)", () => {
            const burnOrder = makeBurnOrder({
                address: returnAddress,
                datum: returnDatum,
                value: makeValue(
                    644_000_000,
                    makeAssets([[makeDummyAssetClass(), 10]])
                )
            })

            configureContext({ burnOrder }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        order: burnOrder,
                        redeemer
                    })
                }, /not enough value returned .as requested by user/)
            })
        })

        it("burn_order_validator::main #15 (succeeds all the requested assets are returned)", () => {
            const redeemer: BurnOrderRedeemerType = {
                Fulfill: {
                    ptrs: [
                        makeAssetPtr(),
                        makeAssetPtr({ groupIndex: 2, assetClassIndex: 0 })
                    ] // the first is the dummy AssetPtr for ADA
                }
            }

            const assetClass = makeDummyAssetClass()
            const value = makeValue(
                644_262_500,
                makeAssets([[assetClass, 10]])
            )

            const burnOrder = makeBurnOrder({
                address: returnAddress,
                datum: returnDatum,
                value
            })

            configureContext({ burnOrder, returnValue: value })
                .addAssetGroupInput({
                    assets: [
                        makeAsset({
                            assetClass,
                            price: [1, 1],
                            priceTimestamp: 200
                        })
                    ]
                })
                .use((ctx) => {
                    strictEqual(
                        main.eval({
                            $scriptContext: ctx,
                            order: burnOrder,
                            redeemer
                        }),
                        undefined
                    )
                })
        })

        it("burn_order_validator::main #16 (throws an error if an unknown asset class is returned)", () => {
            const redeemer: BurnOrderRedeemerType = {
                Fulfill: {
                    ptrs: [
                        makeAssetPtr(),
                        makeAssetPtr({ groupIndex: 2, assetClassIndex: 0 })
                    ] // the first is the dummy AssetPtr for ADA
                }
            }

            const assetClass = makeDummyAssetClass()
            const value = makeValue(
                644_262_500,
                makeAssets([[assetClass, 10]])
            )

            const burnOrder = makeBurnOrder({
                address: returnAddress,
                datum: returnDatum,
                value
            })

            configureContext({
                burnOrder,
                returnValue: value.add(
                    makeValue(
                        0,
                        makeAssets([[makeDummyAssetClass(1), 10]])
                    )
                )
            })
                .addAssetGroupInput({
                    assets: [
                        makeAsset({
                            assetClass,
                            price: [1, 1],
                            priceTimestamp: 200
                        })
                    ]
                })
                .use((ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            order: burnOrder,
                            redeemer
                        })
                    }, /empty list in tailList/)
                })
        })

        it("burn_order_validator::main #17 (succeeds if a voucher is included for the full amount at the current price and enough lovelace is returned)", () => {
            const burnOrder = makeBurnOrder({
                address: returnAddress,
                datum: returnDatum,
                value: makeValue(644_000_000)
            })

            configureContext({
                burnOrder,
                returnLovelace: 696_500_000,
                voucher: {
                    nTokens: 5_000_000,
                    price: [140, 1]
                }
            }).use((ctx) => {
                strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        order: burnOrder,
                        redeemer
                    }),
                    undefined
                )
            })
        })

        it("burn_order_validator::main #18 (throws an error if a voucher is included for the full amount at the current price but not enough lovelace is returned)", () => {
            const burnOrder = makeBurnOrder({
                address: returnAddress,
                datum: returnDatum,
                value: makeValue(644_000_000)
            })

            configureContext({
                burnOrder,
                returnLovelace: 696_499_999,
                voucher: {
                    nTokens: 5_000_000,
                    price: [140, 1]
                }
            }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        order: burnOrder,
                        redeemer
                    })
                }, /not enough value returned/)
            })
        })
    })
})

describe("burn_order_validator metrics", () => {
    const program = contract.burn_order_validator.$hash.context.program

    const n = program.toCbor().length

    it(`program doesn't exceed ${MAX_SCRIPT_SIZE} bytes (${n})`, () => {
        if (n > MAX_SCRIPT_SIZE) {
            throw new Error("program too large")
        }
    })

    const ir = program.ir

    if (ir) {
        it("ir doesn't contain trace", () => {
            strictEqual(!!/__core__trace/.exec(ir), false)
        })
    }
})
