import { deepEqual, strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { ByteArrayData, IntData, ListData, UplcData } from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"
import { ScriptContextBuilder, withScripts } from "./tx"
import {
    RatioType,
    castReimbursement,
    makeConfig,
    makeReimbursement,
    makeSuccessFee
} from "./data"
import { Address, AssetClass, Assets } from "@helios-lang/ledger"
import { makeConfigToken } from "./tokens"
import { IntLike } from "@helios-lang/codec-utils"
import { scripts } from "./constants"

const {
    "Reimbursement::find_input": find_input,
    "Reimbursement::find_output": find_output,
    "Reimbursement::find_thread": find_thread,
    "Reimbursement::calc_alpha": calc_alpha,
    "Reimbursement::calc_phi_alpha_ratio": calc_phi_alpha_ratio
} = contract.ReimbursementModule

describe("ReimbursementModule::Reimbursement::find_input", () => {
    const nDvpTokens = 1000n
    const reimbursementId = 0n
    const reimbursement = makeReimbursement()

    const configureParentContext = (props?: {
        address?: Address
        extraTokens?: Assets
        redeemer?: UplcData
        nDvpTokens?: IntLike
    }) => {
        const scb = new ScriptContextBuilder().addReimbursementInput({
            address: props?.address,
            redeemer: props?.redeemer,
            datum: reimbursement,
            id: reimbursementId,
            extraTokens: props?.extraTokens,
            nDvpTokens: props?.nDvpTokens ?? nDvpTokens
        })

        if (!props?.redeemer) {
            scb.redeemDummyTokenWithDvpPolicy()
        }

        return scb
    }

    describe("@ reimbursement_validator", () => {
        const configureContext = withScripts(configureParentContext, [
            "reimbursement_validator"
        ])

        it("returns the reimbursement id, data and number of DVP tokens if the reimbursement UTxO is the current input", () => {
            configureContext({ redeemer: new IntData(0) }).use(
                (currentScript, ctx) => {
                    deepEqual(
                        find_input.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }),
                        [reimbursementId, reimbursement, nDvpTokens]
                    )
                }
            )
        })

        it("returns the reimbursement id, data and number of DVP tokens even if the reimbursement UTxO isn't at the reimbursement address", () => {
            configureContext({
                redeemer: new IntData(0),
                address: Address.dummy(false)
            }).use((currentScript, ctx) => {
                deepEqual(
                    find_input.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    }),
                    [reimbursementId, reimbursement, nDvpTokens]
                )
            })
        })

        it("throws an error if the reimbursement UTxO contains another token in addition to the reimbursement token and DVP tokens", () => {
            configureContext({
                redeemer: new IntData(0),
                extraTokens: makeConfigToken()
            }).use((currentScript, ctx) => {
                throws(() => {
                    find_input.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    })
                })
            })
        })

        it("throws an error if the reimbursement UTxO contains another non DVP-token in addition to the reimbursement token", () => {
            configureContext({
                redeemer: new IntData(0),
                extraTokens: makeConfigToken(),
                nDvpTokens: 0
            }).use((currentScript, ctx) => {
                throws(() => {
                    find_input.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    })
                })
            })
        })

        it("throws an error if the reimbursement UTxO isn't the current input", () => {
            configureContext().use((currentScript, ctx) => {
                throws(() => {
                    find_input.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    })
                })
            })
        })
    })

    describe("@ other validators", () => {
        const configureContext = withScripts(
            configureParentContext,
            scripts.filter((s) => s != "reimbursement_validator")
        )

        it("returns the reimbursement id, data and number of DVP tokens if a reimbursement UTxO is at the reimbursement_validator address and contains the reimbursement token", () => {
            configureContext().use((currentScript, ctx) => {
                deepEqual(
                    find_input.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    }),
                    [reimbursementId, reimbursement, nDvpTokens]
                )
            })
        })

        it("throws an error if the reimbursement UTxO isn't at the reimbursement_validator address", () => {
            configureContext({ address: Address.dummy(false) }).use(
                (currentScript, ctx) => {
                    throws(() => {
                        find_input.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })
                    })
                }
            )
        })
    })
})

describe("ReimbursementModule::Reimbursement::find_output", () => {
    const reimbursementId = 0
    const nDvpTokens = 1000n
    const reimbursement = makeReimbursement()
    const configureParentContext = (props?: {
        address?: Address
        datum?: UplcData
        nDvpTokens?: IntLike
        extraTokens?: Assets
    }) => {
        return new ScriptContextBuilder()
            .addDummyOutputs(5)
            .addReimbursementOutput({
                address: props?.address,
                datum: props?.datum ?? reimbursement,
                extraTokens: props?.extraTokens,
                id: reimbursementId,
                nDvpTokens: props?.nDvpTokens ?? nDvpTokens
            })
            .addDummyOutputs(5)
            .redeemDummyTokenWithDvpPolicy()
    }

    describe("@ all validators", () => {
        const configureContext = withScripts(configureParentContext, scripts)

        it("returns the reimbursement data and number of DVP tokens if the reimbursement UTxO is returned to the reimbursement_validator address with the reimbursement token", () => {
            configureContext().use((currentScript, ctx) => {
                deepEqual(
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        id: reimbursementId,
                        min_tokens: 0
                    }),
                    [reimbursement, nDvpTokens]
                )
            })
        })

        it("returns the reimbursement data and zero DVP tokens if the reimbursement UTxO is returned to the reimbursement_validator address with the reimbursement token but no DVP tokens", () => {
            configureContext({ nDvpTokens: 0 }).use((currentScript, ctx) => {
                deepEqual(
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        id: reimbursementId,
                        min_tokens: 0
                    }),
                    [reimbursement, 0]
                )
            })
        })

        it("throws an error if the reimbursement output contains less DVP tokens than the minimum required", () => {
            configureContext({ nDvpTokens: 0 }).use((currentScript, ctx) => {
                throws(() => {
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        id: reimbursementId,
                        min_tokens: 1
                    })
                })
            })
        })

        it("throws an error if the reimbursement output doesn't contain a reimbursement token with the expected id", () => {
            configureContext().use((currentScript, ctx) => {
                throws(() => {
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        id: reimbursementId + 1,
                        min_tokens: 0
                    })
                })
            })
        })

        it("throws an error if the reimbursement output contains additional policy-related tokens alongside the reimbursement token and DVP tokens", () => {
            configureContext({ extraTokens: makeConfigToken() }).use(
                (currentScript, ctx) => {
                    throws(() => {
                        find_output.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            id: reimbursementId,
                            min_tokens: 0
                        })
                    })
                }
            )
        })

        it("throws an error if the reimbursement output contains additional unrelated tokens alongside the reimbursement token and DVP tokens", () => {
            configureContext({
                extraTokens: Assets.fromAssetClasses([[AssetClass.dummy(), 1]])
            }).use((currentScript, ctx) => {
                throws(() => {
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        id: reimbursementId,
                        min_tokens: 0
                    })
                })
            })
        })

        it("throws an error if the reimbursement output isn't sent to the reimbursement_validator address", () => {
            configureContext({ address: Address.dummy(false) }).use(
                (currentScript, ctx) => {
                    throws(() => {
                        find_output.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            id: reimbursementId,
                            min_tokens: 0
                        })
                    })
                }
            )
        })

        it("throws an error if the first field in the listData isn't iData", () => {
            const datum = ListData.expect(
                castReimbursement.toUplcData(reimbursement)
            )
            datum.items[0] = new ByteArrayData([])

            configureContext({ datum }).use((currentScript, ctx) => {
                throws(() => {
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        id: reimbursementId,
                        min_tokens: 0
                    })
                })
            })
        })

        it("throws an error if the listData contains an additional field", () => {
            const datum = ListData.expect(
                castReimbursement.toUplcData(reimbursement)
            )
            datum.items.push(new ByteArrayData([]))

            configureContext({ datum }).use((currentScript, ctx) => {
                throws(() => {
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        id: reimbursementId,
                        min_tokens: 0
                    })
                })
            })
        })

        it("throws an error if the startPrice ratio denominator is zero", () => {
            const datum = ListData.expect(
                castReimbursement.toUplcData(reimbursement)
            )
            ListData.expect(datum.items[1]).items[1] = new IntData(0)

            configureContext({ datum }).use((currentScript, ctx) => {
                throws(() => {
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        id: reimbursementId,
                        min_tokens: 0
                    })
                })
            })
        })

        it("throws an error if the endPrice ratio denominator is zero", () => {
            const datum = ListData.expect(
                castReimbursement.toUplcData(reimbursement)
            )
            ListData.expect(datum.items[2]).items[1] = new IntData(0)

            configureContext({ datum }).use((currentScript, ctx) => {
                throws(() => {
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        id: reimbursementId,
                        min_tokens: 0
                    })
                })
            })
        })
    })
})

describe("ReimbursementModule::find_thread", () => {
    const reimbursementId = 0
    const reimbursement = makeReimbursement()
    const nDvpTokens = 1000n
    const configureParentContext = (props?: { redeemer?: UplcData }) => {
        const scb = new ScriptContextBuilder().addReimbursementThread({
            id: reimbursementId,
            datum: reimbursement,
            redeemer: props?.redeemer,
            nDvpTokens
        })

        if (!props?.redeemer) {
            scb.redeemDummyTokenWithDvpPolicy()
        }

        return scb
    }

    describe("@ reimbursement_validator", () => {
        const configureContext = withScripts(configureParentContext, [
            "reimbursement_validator"
        ])

        it("returns the reimbursement data twice, along with its id, and the unchanged amount of DVP tokens in the input and the output if the reimbursement UTxO remains unchanged after being spent and returned", () => {
            configureContext({ redeemer: new IntData(0) }).use(
                (currentScript, ctx) => {
                    deepEqual(
                        find_thread.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        }),
                        [
                            reimbursementId,
                            reimbursement,
                            nDvpTokens,
                            reimbursement,
                            nDvpTokens
                        ]
                    )
                }
            )
        })
    })

    describe("@ other validators", () => {
        const configureContext = withScripts(
            configureParentContext,
            scripts.filter((s) => s != "reimbursement_validator")
        )

        it("returns the reimbursement data twice, along with its id, and the unchanged amount of DVP tokens in the input and the output if the reimbursement UTxO remains unchanged after being spent and returned", () => {
            configureContext().use((currentScript, ctx) => {
                deepEqual(
                    find_thread.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    }),
                    [
                        reimbursementId,
                        reimbursement,
                        nDvpTokens,
                        reimbursement,
                        nDvpTokens
                    ]
                )
            })
        })
    })
})

describe("ReimbursementModule::Reimbursement::calc_alpha", () => {
    it("correct ratio division with non-default end_price (typesafe eval)", () => {
        strictEqual(
            calc_alpha.eval({
                self: {
                    n_remaining_vouchers: 0,
                    start_price: [100, 1],
                    end_price: [200_000_000, 1_000_000],
                    success_fee: {
                        c0: 0,
                        steps: []
                    }
                },
                start_price: [200_000_000n, 1_000_000n]
            }),
            1.0
        )
    })

    it("correct ratio division with non-default end_price (evalUnsafe)", () => {
        const self = contract.ReimbursementModule.Reimbursement.toUplcData({
            n_remaining_vouchers: 0,
            start_price: [100, 1],
            end_price: [200_000_000, 1_000_000],
            success_fee: {
                c0: 0,
                steps: []
            }
        })

        const startPrice = new ListData([
            new IntData(200_000_000),
            new IntData(1_000_000)
        ])

        strictEqual(
            calc_alpha
                .evalUnsafe({
                    self: self,
                    start_price: startPrice
                })
                .toString(),
            "1000000"
        )
    })

    it("correct ratio division with default start_price (typesafe eval)", () => {
        strictEqual(
            calc_alpha.eval({
                self: {
                    n_remaining_vouchers: 0,
                    start_price: [100, 1],
                    end_price: [200_000_000, 1_000_000],
                    success_fee: {
                        c0: 0,
                        steps: []
                    }
                }
            }),
            2.0
        )
    })

    it("correct ratio division with default start_price (evalUnsafe)", () => {
        const self = contract.ReimbursementModule.Reimbursement.toUplcData({
            n_remaining_vouchers: 0,
            start_price: [100, 1],
            end_price: [200_000_000, 1_000_000],
            success_fee: {
                c0: 0,
                steps: []
            }
        })

        strictEqual(
            calc_alpha
                .evalUnsafe({
                    self
                })
                .toString(),
            "2000000"
        )
    })
})

describe("ReimbursementModule::Reimbursement::calc_phi_alpha_ratio", () => {
    describe("whitepaper example", () => {
        const startPrice: RatioType = [100, 1]
        const endPrice: RatioType = [150, 1]
        const successFee = makeSuccessFee({
            c0: 0,
            steps: [{ c: 0.3, sigma: 1.05 }]
        })

        const reimbursement = makeReimbursement({
            startPrice,
            endPrice,
            successFee
        })

        const expected = 0.098901

        it("returns the correct value with the implicit start price", () => {
            strictEqual(
                calc_phi_alpha_ratio.eval({
                    self: reimbursement
                }),
                expected
            )
        })

        it("returns the correct value with the explicit start price", () => {
            strictEqual(
                calc_phi_alpha_ratio.eval({
                    self: reimbursement,
                    start_price: startPrice
                }),
                expected
            )
        })
    })
})
