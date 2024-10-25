import { deepEqual, strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { IntLike } from "@helios-lang/codec-utils"
import { Address, AssetClass, Assets } from "@helios-lang/ledger"
import {
    ByteArrayData,
    ConstrData,
    IntData,
    ListData,
    UplcData
} from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"
import { scripts } from "./constants"
import {
    RatioType,
    ReimbursementType,
    castReimbursement,
    makeCollectingReimbursement,
    makeExtractingReimbursement,
    makeSuccessFee,
    makeVoucher
} from "./data"
import {
    makeConfigToken,
    makeDvpTokens,
    makeReimbursementToken
} from "./tokens"
import { ScriptContextBuilder, withScripts } from "./tx"

const {
    "Reimbursement::find_input": find_input,
    "Reimbursement::find_output": find_output,
    "Reimbursement::find_thread": find_thread,
    "Reimbursement::calc_phi_alpha_ratio": calc_phi_alpha_ratio,
    "Reimbursement::calc_success_fee_reimbursement":
        calc_success_fee_reimbursement,
    witnessed_by_reimbursement
} = contract.ReimbursementModule

describe("ReimbursementModule::Reimbursement::find_input", () => {
    const nDvpTokens = 1000n
    const reimbursementId = 0n
    const reimbursement = makeExtractingReimbursement()

    const configureParentContext = (props?: {
        datum?: ReimbursementType
        address?: Address
        extraTokens?: Assets
        redeemer?: UplcData
        nDvpTokens?: IntLike
    }) => {
        const scb = new ScriptContextBuilder().addReimbursementInput({
            address: props?.address,
            redeemer: props?.redeemer,
            datum: props?.datum ?? reimbursement,
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

        it("ReimbursementModule::Reimbursement::find_input #01 (returns the reimbursement id, data and number of DVP tokens if the reimbursement UTxO is the current input)", () => {
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

        it("ReimbursementModule::Reimbursement::find_input #02 (returns the reimbursement id, data and number of DVP tokens even if the reimbursement UTxO isn't at the reimbursement address)", () => {
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

        it("ReimbursementModule::Reimbursement::find_input #03 (throws an error if the reimbursement UTxO contains another token in addition to the reimbursement token and DVP tokens)", () => {
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

        it("ReimbursementModule::Reimbursement::find_input #04 (throws an error if the reimbursement UTxO contains another non DVP-token in addition to the reimbursement token)", () => {
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

        it("ReimbursementModule::Reimbursement::find_input #05 (throws an error if the reimbursement UTxO isn't the current input)", () => {
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

        it("ReimbursementModule::Reimbursement::find_input #06 (returns the reimbursement id, data and number of DVP tokens if a reimbursement UTxO is at the reimbursement_validator address and contains the reimbursement token)", () => {
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

        it("ReimbursementModule::Reimbursement::find_input #07 (also returns the reimbursement id, data and number of DVP tokens if a reimbursement UTxO is in Collecting state)", () => {
            const reimbursement = makeCollectingReimbursement()
            configureContext({ datum: reimbursement }).use(
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

        it("ReimbursementModule::Reimbursement::find_input #08 (throws an error if the reimbursement UTxO isn't at the reimbursement_validator address)", () => {
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
    const reimbursement = makeExtractingReimbursement()
    const configureParentContext = (props?: {
        address?: Address
        datum?: UplcData
        nDvpTokens?: IntLike
        extraTokens?: Assets
        secondReimbursementOutput?: IntLike
    }) => {
        const b = new ScriptContextBuilder()
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

        if (props?.secondReimbursementOutput) {
            b.addReimbursementOutput({
                id: props.secondReimbursementOutput,
                reimbursement: makeCollectingReimbursement()
            })
        }

        return b
    }

    describe("@ all validators", () => {
        const configureContext = withScripts(configureParentContext, scripts)

        it("ReimbursementModule::Reimbursement::find_output #01 (returns the reimbursement data and number of DVP tokens if the reimbursement UTxO is returned to the reimbursement_validator address with the reimbursement token)", () => {
            configureContext().use((currentScript, ctx) => {
                deepEqual(
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        id: reimbursementId
                    }),
                    [reimbursement, nDvpTokens]
                )
            })
        })

        it("ReimbursementModule::Reimbursement::find_output #02 (returns the reimbursement data and number of DVP tokens even if there is another reimbursement UTxO)", () => {
            configureContext({ secondReimbursementOutput: 3 }).use(
                (currentScript, ctx) => {
                    deepEqual(
                        find_output.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            id: reimbursementId
                        }),
                        [reimbursement, nDvpTokens]
                    )
                }
            )
        })

        it("ReimbursementModule::Reimbursement::find_output #03 (returns the reimbursement data and zero DVP tokens if the reimbursement UTxO is returned to the reimbursement_validator address with the reimbursement token but no DVP tokens)", () => {
            configureContext({ nDvpTokens: 0 }).use((currentScript, ctx) => {
                deepEqual(
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        id: reimbursementId
                    }),
                    [reimbursement, 0]
                )
            })
        })

        it("ReimbursementModule::Reimbursement::find_output #04 (throws an error if there is no reimbursement output with the expected id)", () => {
            configureContext().use((currentScript, ctx) => {
                throws(() => {
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        id: reimbursementId + 1
                    })
                }, /not found/)
            })
        })

        it("ReimbursementModule::Reimbursement::find_output #05 (throws an error if the reimbursement output contains additional policy-related tokens alongside the reimbursement token and DVP tokens)", () => {
            configureContext({ extraTokens: makeConfigToken() }).use(
                (currentScript, ctx) => {
                    throws(() => {
                        find_output.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            id: reimbursementId
                        })
                    }, /output contains unexpected tokens/)
                }
            )
        })

        it("ReimbursementModule::Reimbursement::find_output #06 (throws an error if the reimbursement output contains additional unrelated tokens alongside the reimbursement token and DVP tokens)", () => {
            configureContext({
                extraTokens: Assets.fromAssetClasses([[AssetClass.dummy(), 1]])
            }).use((currentScript, ctx) => {
                throws(() => {
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        id: reimbursementId
                    })
                }, /output contains unexpected token policies/)
            })
        })

        it("ReimbursementModule::Reimbursement::find_output #07 (throws an error if the reimbursement output isn't sent to the reimbursement_validator address)", () => {
            configureContext({ address: Address.dummy(false) }).use(
                (currentScript, ctx) => {
                    throws(() => {
                        find_output.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx,
                            id: reimbursementId
                        })
                    }, /not found/)
                }
            )
        })

        it("ReimbursementModule::Reimbursement::find_output #08 (throws an error if the first field in the listData isn't iData)", () => {
            const datum = ListData.expect(
                castReimbursement.toUplcData(reimbursement)
            )
            datum.items[0] = new ByteArrayData([])

            configureContext({ datum }).use((currentScript, ctx) => {
                throws(() => {
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        id: reimbursementId
                    })
                }, /invalid data structure/)
            })
        })

        it("ReimbursementModule::Reimbursement::find_output #09 (throws an error if the listData contains an additional field)", () => {
            const datum = ListData.expect(
                castReimbursement.toUplcData(reimbursement)
            )
            datum.items.push(new ByteArrayData([]))

            configureContext({ datum }).use((currentScript, ctx) => {
                throws(() => {
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        id: reimbursementId
                    })
                }, /invalid data structure/)
            })
        })

        it("ReimbursementModule::Reimbursement::find_output #10 (throws an error if the startPrice ratio denominator is zero)", () => {
            const datum = ListData.expect(
                castReimbursement.toUplcData(reimbursement)
            )
            ListData.expect(datum.items[0]).items[1] = new IntData(0)

            configureContext({ datum }).use((currentScript, ctx) => {
                throws(() => {
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        id: reimbursementId
                    })
                }, /invalid data structure/)
            })
        })

        it("ReimbursementModule::Reimbursement::find_output #11 (throws an error if the endPrice ratio denominator is zero)", () => {
            const datum = ListData.expect(
                castReimbursement.toUplcData(reimbursement)
            )
            ConstrData.expect(datum.items[1]).fields[0] = new IntData(0)

            configureContext({ datum }).use((currentScript, ctx) => {
                throws(() => {
                    find_output.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx,
                        id: reimbursementId
                    })
                }, /invalid data structure/)
            })
        })
    })
})

describe("ReimbursementModule::find_thread", () => {
    const reimbursementId = 0
    const reimbursement = makeExtractingReimbursement()
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

        it("ReimbursementModule::find_thread #01 (returns the reimbursement data twice, along with its id, and the unchanged amount of DVP tokens in the input and the output if the reimbursement UTxO remains unchanged after being spent and returned)", () => {
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

        it("ReimbursementModule::find_thread #02 (returns the reimbursement data twice, along with its id, and the unchanged amount of DVP tokens in the input and the output if the reimbursement UTxO remains unchanged after being spent and returned)", () => {
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

describe("ReimbursementModule::Reimbursement::calc_phi_alpha_ratio", () => {
    describe("whitepaper example", () => {
        const startPrice: RatioType = [100, 1]
        const endPrice: RatioType = [150, 1]
        const successFee = makeSuccessFee({
            c0: 0,
            steps: [{ c: 0.3, sigma: 1.05 }]
        })

        const reimbursement = makeExtractingReimbursement({
            startPrice,
            endPrice,
            successFee
        })

        const expected = 0.098901

        it("ReimbursementModule::Reimbursement::calc_phi_alpha_ratio #01 (returns the correct value with the implicit start price)", () => {
            strictEqual(
                calc_phi_alpha_ratio.eval({
                    self: reimbursement
                }),
                expected
            )
        })

        it("ReimbursementModule::Reimbursement::calc_phi_alpha_ratio #02 (returns the correct value with the explicit start price)", () => {
            strictEqual(
                calc_phi_alpha_ratio.eval({
                    self: reimbursement,
                    start_price: startPrice
                }),
                expected
            )
        })

        it("ReimbursementModule::Reimbursement::calc_phi_alpha_ratio #03 (throws an error when the reimbursement is in Collecting state)", () => {
            throws(() => {
                calc_phi_alpha_ratio.eval({
                    self: makeCollectingReimbursement(),
                    start_price: startPrice
                })
            }, /can't calculate phi alpha ratio while in Collecting state/)
        })
    })
})

describe("ReimbursementModule::Reimbursement::calc_success_fee_reimbursement", () => {
    it("whitepaper example", () => {
        const startPrice: RatioType = [100, 1]
        const endPrice: RatioType = [150, 1]
        const successFee = makeSuccessFee({
            c0: 0,
            steps: [{ c: 0.3, sigma: 1.05 }]
        })
        const reimbursement = makeExtractingReimbursement({
            startPrice: startPrice,
            endPrice: endPrice,
            successFee
        })

        const voucher = makeVoucher({ tokens: 10_000_000n, price: [120, 1] })

        strictEqual(
            calc_success_fee_reimbursement.eval({
                self: reimbursement,
                voucher,
                main_phi_alpha_ratio: calc_phi_alpha_ratio.eval({
                    self: reimbursement
                })
            }),
            484810n
        )
    })
})

describe("ReimbursementModule::witnessed_by_reimbursement", () => {
    const reimbursementId = 1
    const reimbursement = makeExtractingReimbursement()

    const configureContext = (props?: {
        redeemer?: UplcData
        extraInputTokens?: Assets
    }) => {
        const scb = new ScriptContextBuilder()
            .addDummyInputs(10)
            .addReimbursementThread({
                id: reimbursementId,
                datum: reimbursement,
                redeemer: props?.redeemer,
                extraInputTokens: props?.extraInputTokens,
                nDvpTokens: 0
            })

        if (!props?.redeemer) {
            scb.redeemDummyTokenWithDvpPolicy()
        }

        return scb
    }

    describe("@ supply_validator", () => {
        it("ReimbursementModule::witnessed_by_reimbursement #01 (returns true if one of the inputs contains the reimbursement token with the given id)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    witnessed_by_reimbursement.eval({
                        $currentScript: "supply_validator",
                        $scriptContext: ctx,
                        id: reimbursementId
                    }),
                    true
                )
            })
        })

        it("ReimbursementModule::witnessed_by_reimbursement #02 (returns false if a reimbursement token is spent with another id)", () => {
            configureContext().use((ctx) => {
                strictEqual(
                    witnessed_by_reimbursement.eval({
                        $currentScript: "supply_validator",
                        $scriptContext: ctx,
                        id: reimbursementId + 1
                    }),
                    false
                )
            })
        })

        it("ReimbursementModule::witnessed_by_reimbursement #03 (returns false if no reimbursement token is spent)", () => {
            new ScriptContextBuilder()
                .addDummyInputs(10)
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    strictEqual(
                        witnessed_by_reimbursement.eval({
                            $currentScript: "supply_validator",
                            $scriptContext: ctx,
                            id: reimbursementId
                        }),
                        false
                    )
                })
        })

        it("ReimbursementModule::witnessed_by_reimbursement #04 (throws an error if an input at the reimbursement validator addressdoesn't contain a token)", () => {
            configureContext({
                extraInputTokens: makeReimbursementToken(
                    reimbursementId,
                    -1
                ).add(makeDvpTokens(1000n))
            }).use((ctx) => {
                throws(() => {
                    witnessed_by_reimbursement.eval({
                        $currentScript: "supply_validator",
                        $scriptContext: ctx,
                        id: reimbursementId
                    })
                }, /expected only 1 reimbursement token/)
            })
        })
    })
})
