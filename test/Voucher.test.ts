import { deepEqual, strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import {
    type ShelleyAddress,
    makeDummyAddress,
    Assets,
    makeTxOutput,
    makeValue,
    makeInlineTxOutputDatum
} from "@helios-lang/ledger"
import {
    expectMapData,
    makeByteArrayData,
    makeConstrData,
    makeIntData,
    makeMapData,
    UplcData
} from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"
import { scripts } from "./constants"
import {
    RatioType,
    castVoucher,
    makePrice,
    makeSuccessFee,
    makeVoucher
} from "./data"
import { ScriptContextBuilder, withScripts } from "./tx"
import {
    makeConfigToken,
    makeDvpTokens,
    makeVoucherPair,
    makeVoucherRefToken,
    makeVoucherUserToken
} from "./tokens"
import { IntLike, encodeUtf8 } from "@helios-lang/codec-utils"

const {
    get_current_voucher,
    find_input_voucher,
    find_output_voucher,
    "Voucher::find_return": find_return,
    "Voucher::calc_provisional_success_fee_delta":
        calc_provisional_success_fee_delta,
    validate_minted_vouchers,
    validate_burned_vouchers
} = contract.VoucherModule

describe("VoucherModule::get_current_voucher", () => {
    const voucher = makeVoucher()
    const voucherId = 123n

    const configureContext = (props?: { token?: Assets }) => {
        return new ScriptContextBuilder().addVoucherInput({
            id: voucherId,
            redeemer: makeIntData(0),
            token: props?.token
        })
    }
    const configureParentContext = configureContext

    describe("@ all validators", () => {
        const configureContext = withScripts(configureParentContext, scripts)

        it("VoucherModule::get_current_voucher #01 (returns the voucher id and voucher data if the current input is a voucher UTxO)", () => {
            configureContext().use((currentScript, ctx) => {
                const [actualVoucherId, actualVoucher] =
                    get_current_voucher.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    })

                strictEqual(actualVoucherId, voucherId)
                strictEqual(
                    actualVoucher.return_address.toString(),
                    voucher.return_address.toString()
                )
                strictEqual(
                    actualVoucher.return_datum.toSchemaJson(),
                    voucher.return_datum.toSchemaJson()
                )
                strictEqual(actualVoucher.tokens, voucher.tokens)
                deepEqual(actualVoucher.price, voucher.price)
                strictEqual(actualVoucher.period_id, voucher.period_id)
                strictEqual(actualVoucher.name, voucher.name)
                strictEqual(actualVoucher.description, voucher.description)
                strictEqual(actualVoucher.image, voucher.image)
                strictEqual(actualVoucher.url, voucher.url)
            })
        })

        it("VoucherModule::get_current_voucher #02 (throws an error if the current input doesn't contain a voucher token)", () => {
            configureContext({ token: makeConfigToken() }).use(
                (currentScript, ctx) => {
                    throws(() => {
                        get_current_voucher.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })
                    }, /empty list in headList/)
                }
            )
        })
    })
})

describe("VoucherModule::find_input_voucher", () => {
    const voucher = makeVoucher()
    const voucherId = 123n

    const configureParentContext = (props?: { address?: ShelleyAddress }) => {
        return new ScriptContextBuilder()
            .addVoucherInput({
                id: voucherId,
                voucher,
                address: props?.address
            })
            .redeemDummyTokenWithDvpPolicy()
    }

    describe("@ all validators", () => {
        const configureContext = withScripts(configureParentContext, scripts)

        it("VoucherModule::find_input_voucher #01 (returns the voucher data if the voucher UTxO with the given id is spent)", () => {
            configureContext().use((currentScript, ctx) => {
                deepEqual(
                    find_input_voucher.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        id: voucherId
                    }),
                    voucher
                )
            })
        })

        it("VoucherModule::find_input_voucher #02 (throws an error if no voucher input is found with the given id)", () => {
            configureContext().use((currentScript, ctx) => {
                throws(() => {
                    find_input_voucher.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        id: 124
                    })
                }, /not found/)
            })
        })

        it("VoucherModule::find_input_voucher #03 (throws an error if the voucher UTxO with the given id isn't at the voucher_validator address)", () => {
            configureContext({ address: makeDummyAddress(false) }).use(
                (currentScript, ctx) => {
                    throws(() => {
                        find_input_voucher.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            id: voucherId
                        })
                    }, /not found/)
                }
            )
        })
    })
})

describe("VoucherModule::find_output_voucher", () => {
    const voucher = makeVoucher()
    const voucherId = 123n
    const configureParentContext = (props?: {
        address?: ShelleyAddress
        datum?: UplcData
    }) => {
        return new ScriptContextBuilder()
            .addVoucherOutput({
                id: voucherId,
                voucher,
                address: props?.address,
                datum: props?.datum
            })
            .redeemDummyTokenWithDvpPolicy()
    }

    describe("@ all validators", () => {
        const configureContext = withScripts(configureParentContext, scripts)

        it("VoucherModule::find_output_voucher #01 (returns the voucher data if a voucher output is found with the given id)", () => {
            configureContext().use((currentScript, ctx) => {
                deepEqual(
                    find_output_voucher.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        id: voucherId
                    }),
                    voucher
                )
            })
        })

        it("VoucherModule::find_output_voucher #02 (throws an error if no voucher output is found with the given id)", () => {
            configureContext().use((currentScript, ctx) => {
                throws(() => {
                    find_output_voucher.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        id: 124
                    })
                }, /not found/)
            })
        })

        it("VoucherModule::find_output_voucher #03 (throws an error if the voucher output with the given id isn't at the voucher_validator address)", () => {
            configureContext({ address: makeDummyAddress(false) }).use(
                (currentScript, ctx) => {
                    throws(() => {
                        find_output_voucher.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            id: voucherId
                        })
                    }, /not found/)
                }
            )
        })

        it("VoucherModule::find_output_voucher #04 (throws an error if the return_address data isn't Address)", () => {
            const datum = expectMapData(castVoucher.toUplcData(voucher))
            datum.items[0][1] = makeIntData(0)
            const wrapped = makeConstrData(0, [
                datum,
                makeIntData(1),
                makeConstrData(0, [])
            ])

            configureContext({ datum: wrapped }).use((currentScript, ctx) => {
                throws(() => {
                    find_output_voucher.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        id: voucherId
                    })
                }, /invalid data structure/)
            })
        })

        it('VoucherModule::find_output_voucher #05 (throws an error if the return_address key isn\'t "owner")', () => {
            const datum = expectMapData(castVoucher.toUplcData(voucher))
            datum.items[0][0] = makeByteArrayData(encodeUtf8("@owner"))
            const wrapped = makeConstrData(0, [
                datum,
                makeIntData(1),
                makeConstrData(0, [])
            ])

            configureContext({ datum: wrapped }).use((currentScript, ctx) => {
                throws(() => {
                    find_output_voucher.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        id: voucherId
                    })
                }, /invalid data structure/)
            })
        })

        // TODO: make Cast.fromUplcData less strict, so that additional fields are ignored
        //it("VoucherModule::find_output_voucher #06 (succeeds and returns the voucher data if an additional field is included)", () => {
        //    const datum = ConstrData.expect(castVoucher.toUplcData(voucher))
        //    const cip68Fields = MapData.expect(datum.fields[0])
        //    cip68Fields.items.push([
        //        makeByteArrayData(encodeUtf8("@owner")),
        //        makeIntData(0)
        //    ])
        //
        //    configureContext({datum})
        //        .use((currentScript, ctx) => {
        //            deepEqual(
        //                find_output.eval({
        //                    $currentScript: currentScript,
        //                    $scriptContext: ctx,
        //                    id: voucherId
        //                })
        //            , voucher)
        //        })
        //})
    })
})

describe("VoucherModule::Voucher::find_return", () => {
    const address = makeDummyAddress(false, 5)
    const datum = makeIntData(0)
    const returnLovelace = 2_345_678n
    const returnValue = makeValue(returnLovelace)
    const voucher = makeVoucher({
        address,
        datum
    })

    const configureContext = (props?: {
        address?: ShelleyAddress
        datum?: null | UplcData
    }) => {
        return new ScriptContextBuilder()
            .addDummyOutputs(10)
            .addOutput(
                makeTxOutput(
                    props?.address ?? address,
                    returnValue,
                    props?.datum === null
                        ? undefined
                        : makeInlineTxOutputDatum(props?.datum ?? datum)
                )
            )
    }

    const defaultTestArgs = {
        self: voucher,
        ptr: 10
    }
    it("VoucherModule::Voucher::find_return #01 (returns the output at the given index, matching the address and datum)", () => {
        configureContext().use((ctx) => {
            const actual = find_return.eval({
                ...defaultTestArgs,
                $scriptContext: ctx
            })

            strictEqual(actual.value.lovelace, returnLovelace)
        })
    })

    it("VoucherModule::Voucher::find_return #02 (throws an error if the voucher return output doesn't have a datum)", () => {
        configureContext({ datum: null }).use((ctx) => {
            throws(() => {
                find_return.eval({
                    ...defaultTestArgs,
                    $scriptContext: ctx
                })
            }, /not an inline datum/)
        })
    })

    it("VoucherModule::Voucher::find_return #03 (throws an error if the voucher return output has the wrong datum)", () => {
        configureContext({ datum: makeIntData(1) }).use((ctx) => {
            throws(() => {
                find_return.eval({
                    ...defaultTestArgs,
                    $scriptContext: ctx
                })
            }, /unexpected voucher return datum/)
        })
    })

    it("VoucherModule::Voucher::find_return #04 (throws an error if the voucher return output isn't at the requested address)", () => {
        configureContext({ address: makeDummyAddress(false, 6) }).use((ctx) => {
            throws(() => {
                find_return.eval({
                    ...defaultTestArgs,
                    $scriptContext: ctx
                })
            }, /unexpected voucher return address/)
        })
    })

    it("VoucherModule::Voucher::find_return #05 (throws an error if the output at the given index isn't a voucher)", () => {
        configureContext().use((ctx) => {
            throws(() => {
                find_return.eval({
                    ...defaultTestArgs,
                    ptr: 9,
                    $scriptContext: ctx
                })
            }, /unexpected voucher return address/)
        })
    })
})

describe("VoucherModule::Voucher::calc_provisional_success_fee_delta", () => {
    it("whitepaper example", () => {
        const self = makeVoucher({
            tokens: 5_000_000n,
            price: [120, 1]
        })

        const successFee = makeSuccessFee()

        strictEqual(
            calc_provisional_success_fee_delta.eval({
                self,
                benchmark_price: [140, 1],
                success_fee: successFee
            }),
            BigInt(Math.floor((5_000_000 * 0.035) / 1.166666))
        )
    })
})

describe("VoucherModule::validate_minted_vouchers", () => {
    const priceRatio: RatioType = [200, 1]
    const currentPrice = makePrice({ ratio: priceRatio })
    const periodId = 0
    const lastVoucherId = -1

    describe("one voucher minted", () => {
        const voucherId = 0
        const configureParentContext = (props?: {
            address?: ShelleyAddress
            minted?: Assets
            datumTokens?: IntLike
        }) => {
            return new ScriptContextBuilder()
                .mint({
                    assets: (props?.minted ?? makeVoucherPair(voucherId)).add(
                        makeDvpTokens(1000)
                    )
                })
                .addVoucherOutput({
                    address: props?.address,
                    id: voucherId,
                    voucher: makeVoucher({
                        price: priceRatio,
                        periodId,
                        tokens: props?.datumTokens ?? 1000
                    })
                })
                .redeemDummyTokenWithDvpPolicy()
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            const defaultTestArgs = {
                price: currentPrice.value,
                period_id: periodId,
                last_voucher_id: lastVoucherId,
                is_successful: true
            }

            it("VoucherModule::validate_minted_vouchers #01 (returns the fact that one voucher is minted and that its id is 0)", () => {
                configureContext().use((currentScript, ctx) => {
                    deepEqual(
                        validate_minted_vouchers.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        }),
                        [1n, 1000n, 0n]
                    )
                })
            })

            it("VoucherModule::validate_minted_vouchers #02 (returns the fact that the number of tokens in the voucher is equal to the expected amount)", () => {
                configureContext({ datumTokens: 500n }).use(
                    (currentScript, ctx) => {
                        deepEqual(
                            validate_minted_vouchers.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                ...defaultTestArgs
                            }),
                            [1n, 500n, 0n]
                        )
                    }
                )
            })

            it("VoucherModule::validate_minted_vouchers #03 (throws an error if the corresponding voucher user token isn't minted)", () => {
                configureContext({
                    minted: makeVoucherRefToken(voucherId)
                }).use((currentScript, ctx) => {
                    throws(() => {
                        validate_minted_vouchers.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        })
                    })
                })
            })

            it("VoucherModule::validate_minted_vouchers #04 (throws an error if the corresponding voucher user token is minted more than once)", () => {
                configureContext({
                    minted: makeVoucherRefToken(voucherId).add(
                        makeVoucherUserToken(voucherId, 2)
                    )
                }).use((currentScript, ctx) => {
                    throws(() => {
                        validate_minted_vouchers.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        })
                    })
                })
            })

            it("VoucherModule::validate_minted_vouchers #05 (throws an error if the number of tokens in the voucher datum is <= 0)", () => {
                configureContext({ datumTokens: 0 }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            validate_minted_vouchers.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                ...defaultTestArgs
                            })
                        })
                    }
                )
            })

            it("VoucherModule::validate_minted_vouchers #06 (throws an error if the voucher output isn't sent to the voucher_validator address)", () => {
                configureContext({ address: makeDummyAddress(false) }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            validate_minted_vouchers.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                ...defaultTestArgs
                            })
                        })
                    }
                )
            })

            it("VoucherModule::validate_minted_vouchers #07 (throws an error if the voucher ref token isn't minted)", () => {
                configureContext({
                    minted: makeVoucherUserToken(voucherId)
                }).use((currentScript, ctx) => {
                    throws(() => {
                        validate_minted_vouchers.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        })
                    })
                })
            })

            it("VoucherModule::validate_minted_vouchers #08 (throws an error if the voucher ref token is minted more than once)", () => {
                configureContext({
                    minted: makeVoucherUserToken(voucherId).add(
                        makeVoucherRefToken(voucherId, 2)
                    )
                }).use((currentScript, ctx) => {
                    throws(() => {
                        validate_minted_vouchers.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        })
                    })
                })
            })

            it("VoucherModule::validate_minted_vouchers #09 (throws an error if there was and no vouchers were minted but some vouchers were returned (not possible on-chain))", () => {
                configureContext({
                    minted: makeDvpTokens(0)
                }).use((currentScript, ctx) => {
                    throws(() => {
                        validate_minted_vouchers.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ...defaultTestArgs,
                            is_successful: true
                        })
                    })
                })
            })

            it("VoucherModule::validate_minted_vouchers #10 (returns the fact that no vouchers were minted if there is success but no vouchers were minted nor returned to the voucher address)", () => {
                configureContext({
                    minted: makeDvpTokens(0),
                    address: makeDummyAddress(false)
                }).use((currentScript, ctx) => {
                    deepEqual(
                        validate_minted_vouchers.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ...defaultTestArgs,
                            is_successful: true
                        }),
                        [0n, 0n, lastVoucherId]
                    )
                })
            })

            it("VoucherModule::validate_minted_vouchers #11 (returns the fact that no vouchers were minted if there was no success and no vouchers were actually minted)", () => {
                configureContext({
                    minted: makeDvpTokens(0)
                }).use((currentScript, ctx) => {
                    deepEqual(
                        validate_minted_vouchers.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            ...defaultTestArgs,
                            is_successful: false
                        }),
                        [0n, 0n, lastVoucherId]
                    )
                })
            })
        })
    })

    describe("three vouchers minted", () => {
        const voucherId0 = 0
        const voucher0 = makeVoucher({
            price: priceRatio,
            periodId,
            tokens: 300
        })

        const voucherId1 = 1
        const voucher1 = makeVoucher({
            price: priceRatio,
            periodId,
            tokens: 300
        })

        const voucherId2 = 2

        const configureParentContext = (props?: {
            extraMinted?: Assets
            voucherId2?: number
            tokensMentionedInVoucher2?: IntLike
        }) => {
            const voucher2 = makeVoucher({
                price: priceRatio,
                periodId,
                tokens: props?.tokensMentionedInVoucher2 ?? 400
            })

            const vId2 = props?.voucherId2 ?? voucherId2
            let minted = makeVoucherPair(voucherId0)
                .add(makeVoucherPair(voucherId1))
                .add(makeVoucherPair(vId2))
                .add(makeDvpTokens(1000))

            if (props?.extraMinted) {
                minted = minted.add(props.extraMinted)
            }

            return new ScriptContextBuilder()
                .mint({
                    assets: minted
                })
                .addVoucherOutput({ id: voucherId0, voucher: voucher0 })
                .addVoucherOutput({ id: voucherId1, voucher: voucher1 })
                .addVoucherOutput({ id: vId2, voucher: voucher2 })
                .redeemDummyTokenWithDvpPolicy()
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            const defaultTestArgs = {
                price: currentPrice.value,
                period_id: periodId,
                last_voucher_id: lastVoucherId,
                is_successful: true
            }

            it("VoucherModule::validate_minted_vouchers #12 (returns the fact that three vouchers is minted, that 1000 DVP tokens are mentioned in the vouchers, and that the id of the last voucher is 2)", () => {
                configureContext().use((currentScript, ctx) => {
                    deepEqual(
                        validate_minted_vouchers.eval({
                            $scriptContext: ctx,
                            $currentScript: currentScript,
                            ...defaultTestArgs
                        }),
                        [3n, 1000n, 2n]
                    )
                })
            })

            it("VoucherModule::validate_minted_vouchers #13 (returns the fact that only 900 DVP tokens are mentioned in the vouchers even if 1000 DVP tokens are actually minted)", () => {
                configureContext({ tokensMentionedInVoucher2: 300n }).use(
                    (currentScript, ctx) => {
                        deepEqual(
                            validate_minted_vouchers.eval({
                                $scriptContext: ctx,
                                $currentScript: currentScript,
                                ...defaultTestArgs
                            }),
                            [3n, 900n, 2n]
                        )
                    }
                )
            })

            it("VoucherModule::validate_minted_vouchers #14 (throws an error if one of the minted voucher has a non-unit quantity)", () => {
                configureContext({
                    extraMinted: makeVoucherPair(voucherId2, 1)
                }).use((currentScript, ctx) => {
                    throws(() => {
                        validate_minted_vouchers.eval({
                            $scriptContext: ctx,
                            $currentScript: currentScript,
                            ...defaultTestArgs
                        })
                    })
                })
            })

            it("VoucherModule::validate_minted_vouchers #15 (throws an error if the new voucher ids aren't consecutive)", () => {
                configureContext({ voucherId2: 3 }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            validate_minted_vouchers.eval({
                                $scriptContext: ctx,
                                $currentScript: currentScript,
                                ...defaultTestArgs
                            })
                        })
                    }
                )
            })

            it("VoucherModule::validate_minted_vouchers #16 (throws an error if some vouchers were minted but there is no success)", () => {
                configureContext().use((currentScript, ctx) => {
                    throws(() => {
                        validate_minted_vouchers.eval({
                            $scriptContext: ctx,
                            $currentScript: currentScript,
                            ...defaultTestArgs,
                            is_successful: false
                        })
                    })
                })
            })
        })
    })
})

describe("VoucherModule::validate_burned_vouchers", () => {
    const periodId = 0

    describe("one voucher burned", () => {
        const voucherId = 0
        const voucher = makeVoucher({
            periodId
        })

        const configureParentContext = (props?: { extraMinted?: Assets }) => {
            let minted = makeVoucherPair(voucherId, -1).add(
                makeDvpTokens(-1000)
            )

            if (props?.extraMinted) {
                // resulting zeroes are automatically removed
                minted = minted.add(props.extraMinted)
            }

            return new ScriptContextBuilder()
                .mint({
                    assets: minted
                })
                .addVoucherInput({ id: voucherId, voucher })
                .redeemDummyTokenWithDvpPolicy()
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            it("VoucherModule::validate_burned_vouchers #01 (returns 1 if both the voucher ref and user token are burned)", () => {
                configureContext().use((currentScript, ctx) => {
                    strictEqual(
                        validate_burned_vouchers.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            period_id: periodId
                        }),
                        1n
                    )
                })
            })

            it("VoucherModule::validate_burned_vouchers #02 (throws an error if not exactly 1 voucher pair is burned)", () => {
                configureContext({
                    extraMinted: makeVoucherPair(voucherId, -1)
                }).use((currentScript, ctx) => {
                    throws(() => {
                        validate_burned_vouchers.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            period_id: periodId
                        })
                    })
                })
            })

            it("VoucherModule::validate_burned_vouchers #03 (throws an error if not exactly 1 voucher ref token is burned)", () => {
                configureContext({
                    extraMinted: makeVoucherRefToken(voucherId, -1)
                }).use((currentScript, ctx) => {
                    throws(() => {
                        validate_burned_vouchers.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            period_id: periodId
                        })
                    })
                })
            })

            it("VoucherModule::validate_burned_vouchers #04 (throws an error if the voucher ref token isn't burned)", () => {
                configureContext({
                    extraMinted: makeVoucherRefToken(voucherId, 1)
                }).use((currentScript, ctx) => {
                    throws(() => {
                        validate_burned_vouchers.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            period_id: periodId
                        })
                    })
                })
            })

            it("VoucherModule::validate_burned_vouchers #05 (throws an error if not exactly 1 voucher user token burned)", () => {
                configureContext({
                    extraMinted: makeVoucherUserToken(voucherId, -1)
                }).use((currentScript, ctx) => {
                    throws(() => {
                        validate_burned_vouchers.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            period_id: periodId
                        })
                    })
                })
            })

            it("VoucherModule::validate_burned_vouchers #06 (throws an error if the voucher user token isn't burned)", () => {
                configureContext({
                    extraMinted: makeVoucherUserToken(voucherId, 1)
                }).use((currentScript, ctx) => {
                    throws(() => {
                        validate_burned_vouchers.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            period_id: periodId
                        })
                    })
                })
            })
        })
    })

    describe("three vouchers burned", () => {
        const voucherId0 = 0
        const voucherId1 = 1
        const voucherId2 = 2

        const configureParentContext = (props?: {
            lastVoucherPeriodId?: number
        }) => {
            return new ScriptContextBuilder()
                .mint({
                    assets: makeVoucherPair(voucherId0, -1)
                        .add(makeVoucherPair(voucherId1, -1))
                        .add(makeVoucherPair(voucherId2, -1))
                        .add(makeDvpTokens(-1000))
                })
                .addVoucherInput({
                    id: voucherId0,
                    voucher: makeVoucher({
                        periodId
                    })
                })
                .addVoucherInput({
                    id: voucherId1,
                    voucher: makeVoucher({
                        periodId
                    })
                })
                .addVoucherInput({
                    id: voucherId2,
                    voucher: makeVoucher({
                        periodId: props?.lastVoucherPeriodId ?? periodId
                    })
                })
                .redeemDummyTokenWithDvpPolicy()
        }

        describe("@ all validators", () => {
            const configureContext = withScripts(
                configureParentContext,
                scripts
            )

            it("VoucherModule::validate_burned_vouchers #07 (returns 3 if three voucher token pairs are burned)", () => {
                configureContext().use((currentScript, ctx) => {
                    strictEqual(
                        validate_burned_vouchers.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            period_id: periodId
                        }),
                        3n
                    )
                })
            })

            it("VoucherModule::validate_burned_vouchers #08 (throws an error if the period id of voucher three doesn't match the current period id)", () => {
                configureContext({ lastVoucherPeriodId: periodId + 1 }).use(
                    (currentScript, ctx) => {
                        throws(() => {
                            validate_burned_vouchers.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx,
                                period_id: periodId
                            })
                        })
                    }
                )
            })
        })
    })
})
