import { strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { type IntLike } from "@helios-lang/codec-utils"
import { type ShelleyAddress, makeAddress, makeDummyAddress, makeDummyPubKeyHash, makeValue, type PubKeyHash } from "@helios-lang/ledger"
import { makeIntData, makeListData, type UplcData } from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"
import { MAX_SCRIPT_SIZE } from "./constants"
import {
    MintOrderRedeemerType,
    MintOrderType,
    RatioType,
    makeAssetPtr,
    makeConfig,
    makeMintOrder,
    makePrice,
    makeSupply,
    makeVoucher
} from "./data"
import { makeDvpTokens, makeVoucherUserToken } from "./tokens"
import { ScriptContextBuilder } from "./tx"

const { main } = contract.mint_order_validator

describe("mint_order_validator::main", () => {
    describe("Cancel redeemer", () => {
        const redeemer: MintOrderRedeemerType = {
            Cancel: {}
        }

        const pkh = makeDummyPubKeyHash(10)
        const returnAddress = makeAddress(false, pkh)
        const mintOrder = makeMintOrder({
            address: returnAddress
        })

        const configureContext = (props?: {
            pkh?: PubKeyHash
            dummyInputAddr?: ShelleyAddress<any>
        }) => {
            const scb = new ScriptContextBuilder()
                .addMintOrderInput({
                    redeemer,
                    datum: mintOrder
                })
                .addDummySigners(10)
                .addSigner(props?.pkh ?? pkh)

            if (props?.dummyInputAddr) {
                scb.addDummyInput({ address: props.dummyInputAddr })
            }

            return scb
        }

        it("mint_order_validator::main #01 (succeeds if the tx signed by the address pubkey)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        order: mintOrder,
                        redeemer
                    }),
                    undefined
                )
            })
        })

        it("mint_order_validator::main #02 (throws an error if the tx isn't signed by the address pubkey)", () => {
            configureContext({ pkh: makeDummyPubKeyHash(1) }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        order: mintOrder,
                        redeemer
                    })
                }, /not approved by owner/)
            })
        })

        it("mint_order_validator::main #03 (succeeds if the tx isn't signed by the address pubkey but an input is spent from the same address)", () => {
            configureContext({
                pkh: makeDummyPubKeyHash(1),
                dummyInputAddr: returnAddress
            }).use((ctx) => {
                strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        order: mintOrder,
                        redeemer
                    }),
                    undefined
                )
            })
        })
    })

    describe("Fullfill redeemer with pure lovelace diff", () => {
        const pkh = makeDummyPubKeyHash(10)
        const returnAddress = makeAddress(false, pkh)
        const returnDatum = makeIntData(1)
        const mintOrder = makeMintOrder({
            address: returnAddress,
            datum: returnDatum,
            minTokens: 1_400_000,
            maxPriceAge: 100
        })
        const redeemer: MintOrderRedeemerType = {
            Fulfill: {
                ptrs: [makeAssetPtr()] // dummy AssetPtr for ADA
            }
        }
        const agent = makeDummyPubKeyHash(123)

        const configureContext = (props?: {
            agent?: PubKeyHash
            mintOrder?: MintOrderType
            priceTimestamp?: number
            inputLovelace?: IntLike
            returnTokens?: IntLike
            returnUserVoucher?: boolean
            startPrice?: RatioType
            returnRefVoucher?: {
                returnAddress?: ShelleyAddress
                returnDatum?: UplcData
                price?: RatioType
                nTokens?: IntLike
                id?: IntLike
                periodId?: IntLike
            } | null
        }) => {
            const startPrice: RatioType = props?.startPrice ?? [100, 1]
            const price = makePrice({
                top: 140,
                bottom: 1,
                timestamp: props?.priceTimestamp ?? 120
            })
            const priceIncreased =
                Number(price.value[0]) / Number(price.value[1]) >
                Number(startPrice[0]) / Number(startPrice[1])

            const config = makeConfig({
                agent,
                token: {
                    maxPriceAge: 100
                },
                mintFee: {
                    relative: 0.005,
                    minimum: 20_000
                }
            })

            const periodId = 0
            const supply = makeSupply({ startPrice, successFee: { periodId } })

            const nTokensReturned = props?.returnTokens ?? 1408571
            let returnedTokens = makeDvpTokens(nTokensReturned)

            if (priceIncreased && props?.returnUserVoucher !== false) {
                returnedTokens = returnedTokens.add(
                    makeVoucherUserToken(props?.returnRefVoucher?.id ?? 0)
                )
            }

            const scb = new ScriptContextBuilder()
                .addConfigRef({ config })
                .addSupplyInput({ supply })
                .addPriceRef({ price })
                .observeBenchmark({ redeemer: [1, 1] })
                .addAssetGroupInput()
                .addMintOrderInput({
                    datum: props?.mintOrder ?? mintOrder,
                    redeemer,
                    value: makeValue(props?.inputLovelace ?? 200_000_000)
                })
                .addMintOrderReturn({
                    address: returnAddress,
                    datum: returnDatum,
                    value: makeValue(0, returnedTokens)
                })
                .addSigner(props?.agent ?? agent)
                .setTimeRange({ end: 200 })

            if (priceIncreased && props?.returnRefVoucher !== null) {
                scb.addVoucherOutput({
                    id: props?.returnRefVoucher?.id ?? 0,
                    voucher: makeVoucher({
                        address:
                            props?.returnRefVoucher?.returnAddress ??
                            returnAddress,
                        datum:
                            props?.returnRefVoucher?.returnDatum ?? returnDatum,
                        tokens:
                            props?.returnRefVoucher?.nTokens ?? nTokensReturned,
                        price: props?.returnRefVoucher?.price ?? price.value,
                        periodId: props?.returnRefVoucher?.periodId ?? periodId
                    })
                })
            }

            return scb
        }

        it("mint_order_validator::main #04 (succeeds if enough tokens are returned)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    main.eval({
                        $scriptContext: ctx,
                        order: mintOrder,
                        redeemer
                    }),
                    undefined
                )
            })
        })

        it("mint_order_validator::main #05 (throws an error if not signed by agent)", () => {
            configureContext({ agent: makeDummyPubKeyHash()}).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        order: mintOrder,
                        redeemer
                    })
                }, /not signed by agent/)
            })
        })

        it("mint_order_validator::main #06 (throws an error if the price timestamp is too old)", () => {
            configureContext({ priceTimestamp: 99 }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        order: mintOrder,
                        redeemer
                    })
                }, /token price too old/)
            })
        })

        it("mint_order_validator::main #07 (throws an error if not enough tokens are returned according to the contract)", () => {
            configureContext({ returnTokens: 1_408_570 }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        order: mintOrder,
                        redeemer
                    })
                }, /not enough tokens returned wrt. contract price/)
            })
        })

        it("mint_order_validator::main #08 (throws an error if not enough tokens are returned according to the order)", () => {
            configureContext({ returnTokens: 1_399_999 }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        order: mintOrder,
                        redeemer
                    })
                }, /not enough tokens returned wrt\. order/)
            })
        })

        it("mint_order_validator::main #09 (throws an error if there has been some success since the start of the year but no voucher is returned)", () => {
            configureContext({ returnUserVoucher: false }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        order: mintOrder,
                        redeemer
                    })
                }, /not found/)
            })
        })

        it("mint_order_validator::main #10 (throws an error if only a user voucher is returned in the case there has been some success since the start of the year)", () => {
            configureContext({ returnRefVoucher: null }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        order: mintOrder,
                        redeemer
                    })
                }, /not found/)
            })
        })

        it("mint_order_validator::main #11 (throws an error if the ref voucher return address is wrong)", () => {
            configureContext({
                returnRefVoucher: { returnAddress: makeDummyAddress(false) }
            }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        order: mintOrder,
                        redeemer
                    })
                }, /wrong voucher return address/)
            })
        })

        it("mint_order_validator::main #12 (throws an error if the ref voucher return datum is wrong)", () => {
            configureContext({
                returnRefVoucher: { returnDatum: makeListData([]) }
            }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        order: mintOrder,
                        redeemer
                    })
                }, /wrong voucher datum/)
            })
        })

        it("mint_order_validator::main #13 (throws an error if the ref voucher token count is too low)", () => {
            configureContext({ returnRefVoucher: { nTokens: 1_400_000 } }).use(
                (ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            order: mintOrder,
                            redeemer
                        })
                    }, /unexpected number of tokens in voucher/)
                }
            )
        })

        it("mint_order_validator::main #14 (throws an error if the ref voucher token count is too high)", () => {
            configureContext({ returnRefVoucher: { nTokens: 2_400_000 } }).use(
                (ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            order: mintOrder,
                            redeemer
                        })
                    }, /unexpected number of tokens in voucher/)
                }
            )
        })

        it("mint_order_validator::main #15 (succeeds if no vouchers are returned but there was also no success)", () => {
            configureContext({
                returnRefVoucher: null,
                returnUserVoucher: false,
                startPrice: [140, 1]
            }).use((ctx) => {
                main.eval({
                    $scriptContext: ctx,
                    order: mintOrder,
                    redeemer
                })
            })
        })
    })
})

describe("mint_order_validator metrics", () => {
    const program = contract.mint_order_validator.$hash.context.program

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
