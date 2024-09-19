import { describe, it } from "node:test";
import contract from "pbg-token-validators-test-context";
import { MintOrderRedeemerType, MintOrderType, RatioType, makeAsset, makeAssetPtr, makeConfig, makeMintOrder, makePrice, makeSupply, makeVoucher } from "./data";
import { Address, PubKeyHash, Value } from "@helios-lang/ledger";
import { ScriptContextBuilder } from "./tx";
import { throws } from "node:assert";
import { IntData, ListData, UplcData } from "@helios-lang/uplc";
import { IntLike } from "@helios-lang/codec-utils";
import { makeDvpTokens, makeVoucherUserToken } from "./tokens";

const { main } = contract.mint_order_validator

describe("mint_order_validator::main", () => {
    describe("Cancel redeemer", () => {
        const redeemer: MintOrderRedeemerType = {
            Cancel: {}
        }

        const pkh = PubKeyHash.dummy(10)
        const returnAddress = Address.fromHash(false, pkh)
        const mintOrder = makeMintOrder({
            address: returnAddress
        })

        const configureContext = (props?: {
            pkh?: PubKeyHash,
            dummyInputAddr?: Address
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

        it("succeeds if the tx signed by the address pubkey", () => {
            configureContext().use((ctx) => {
                main.eval({
                    $scriptContext: ctx,
                    order: mintOrder,
                    redeemer
                })
            })
        })

        it("throws an error if the tx isn't signed by the address pubkey", () => {
            configureContext({ pkh: PubKeyHash.dummy(1) }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        order: mintOrder,
                        redeemer
                    })
                })
            })
        })

        it("succeeds if the tx isn't signed by the address pubkey but an input is spent from the same address", () => {
            configureContext({
                pkh: PubKeyHash.dummy(1),
                dummyInputAddr: returnAddress
            }).use((ctx) => {
                main.eval({
                    $scriptContext: ctx,
                    order: mintOrder,
                    redeemer
                })
            })
        })
    })

    describe("Fullfill redeemer with pure lovelace diff", () => {
        const pkh = PubKeyHash.dummy(10)
        const returnAddress = Address.fromHash(false, pkh)
        const returnDatum = new IntData(1)
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
        const agent = PubKeyHash.dummy(123)

        const configureContext = (props?: {
            agent?: PubKeyHash
            mintOrder?: MintOrderType
            priceTimestamp?: number
            inputLovelace?: IntLike
            returnTokens?: IntLike
            returnUserVoucher?: boolean
            startPrice?: RatioType
            returnRefVoucher?: {
                returnAddress?: Address
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
            const priceIncreased = Number(price.value[0])/Number(price.value[1]) > Number(startPrice[0])/Number(startPrice[1])

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
            const supply = makeSupply({startPrice, successFee: {periodId}})

            const nTokensReturned = props?.returnTokens ?? 1408571
            let returnedTokens = makeDvpTokens(nTokensReturned)

            if (priceIncreased && props?.returnUserVoucher !== false) {
                returnedTokens = returnedTokens.add(
                    makeVoucherUserToken(props?.returnRefVoucher?.id ?? 0)
                )
            }

            const scb = new ScriptContextBuilder()
                .addConfigRef({config})
                .addSupplyInput({supply})
                .addPriceRef({price})
                .observeBenchmark({redeemer: [1, 1]})
                .addAssetGroupInput()
                .addMintOrderInput({
                    datum: props?.mintOrder ?? mintOrder,
                    redeemer,
                    value: new Value(props?.inputLovelace ?? 200_000_000)
                })
                .addMintOrderReturn({
                    address: returnAddress,
                    datum: returnDatum,
                    value: new Value(0, returnedTokens)
                })
                .addSigner(props?.agent ?? agent)
                .setTimeRange({end: 200})

            if (priceIncreased && props?.returnRefVoucher !== null) {
                scb.addVoucherOutput({
                    id: props?.returnRefVoucher?.id ?? 0,
                    voucher: makeVoucher({
                        address: props?.returnRefVoucher?.returnAddress ?? returnAddress,
                        datum: props?.returnRefVoucher?.returnDatum ?? returnDatum,
                        tokens: props?.returnRefVoucher?.nTokens ?? nTokensReturned,
                        price: props?.returnRefVoucher?.price ?? price.value,
                        periodId: props?.returnRefVoucher?.periodId ?? periodId
                    })
                })
            }

            return scb
        }

        it("succeeds if enough tokens are returned", () => {
            configureContext()
                .use(ctx => {
                    main.eval({$scriptContext: ctx, order: mintOrder, redeemer})
                })
        })

        it("throws an error if not signed by agent", () => {
            configureContext({agent: PubKeyHash.dummy()}).use(ctx => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        order: mintOrder,
                        redeemer
                    })
                })
            })
        })

        it("throws an error if the price timestamp is too old", () => {
            configureContext({priceTimestamp: 99}).use(ctx => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        order: mintOrder,
                        redeemer
                    })
                })
            })
        })

        it("throws an error if not enough tokens are returned according to the contract", () => {
            configureContext({returnTokens: 1_408_570})
                .use(ctx => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            order: mintOrder,
                            redeemer
                        })
                    })
                })
        })

        it("throws an error if not enough tokens are returned according to the order", () => {
            configureContext({returnTokens: 1_399_999})
                .use(ctx => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            order: mintOrder,
                            redeemer
                        })
                    })
                })
        })

        it("throws an error if there has been some success since the start of the year but no voucher is returned", () => {
            configureContext({returnUserVoucher: false})
                .use(ctx => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            order: mintOrder,
                            redeemer
                        })
                    })
                })
        })

        it("throws an error if only a user voucher is returned in the case there has been some success since the start of the year", () => {
            configureContext({returnRefVoucher: null})
                .use(ctx => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            order: mintOrder,
                            redeemer
                        })
                    })
                })
        })

        it("throws an error if the ref voucher return address is wrong", () => {
            configureContext({returnRefVoucher: {returnAddress: Address.dummy(false)}})
                .use(ctx => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            order: mintOrder,
                            redeemer
                        })
                    })
                })
        })

        it("throws an error if the ref voucher return datum is wrong", () => {
            configureContext({returnRefVoucher: {returnDatum: new ListData([])}})
                .use(ctx => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            order: mintOrder,
                            redeemer
                        })
                    })
                })
        })

        it("throws an error if the ref voucher token count is too low", () => {
            configureContext({returnRefVoucher: {nTokens: 1_400_000}})
                .use(ctx => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            order: mintOrder,
                            redeemer
                        })
                    })
                })
        })

        it("throws an error if the ref voucher period id is wrong", () => {
            configureContext({returnRefVoucher: {periodId: 1}})
                .use(ctx => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            order: mintOrder,
                            redeemer
                        })
                    })
                })
        })

        it("throws an error if the ref voucher price is too low", () => {
            configureContext({returnRefVoucher: {price: [139, 1]}})
            .use(ctx => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        order: mintOrder,
                        redeemer
                    })
                })
            })
        })

        it("succeeds if no vouchers are returned but there was also no success", () => {
            configureContext({returnRefVoucher: null, returnUserVoucher: false, startPrice: [140, 1]})
                .use(ctx => {
                    main.eval({
                        $scriptContext: ctx,
                        order: mintOrder,
                        redeemer
                    })
                })
        })
    })

    
})