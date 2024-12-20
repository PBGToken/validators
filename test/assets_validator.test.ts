import { strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { type Assets } from "@helios-lang/ledger"
import { makeConstrData, makeIntData, makeListData } from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"
import { MAX_SCRIPT_SIZE } from "./constants"
import { AssetGroupAction } from "./data"
import { makeConfigToken } from "./tokens"
import { ScriptContextBuilder } from "./tx"

const { main } = contract.assets_validator

describe("assets_validator::main", () => {
    describe("no supply or portfolio UTxO is spent", () => {
        const contextContext = (props?: { redeemer?: AssetGroupAction }) => {
            return new ScriptContextBuilder()
                .addDummyInputs(10)
                .addAssetGroupInput({ redeemer: props?.redeemer })
        }

        it("throws an error for the Count Action", () => {
            const redeemer: AssetGroupAction = {
                Count: {
                    supply_ptr: 0
                }
            }

            throws(() => {
                contextContext({ redeemer }).use((ctx) => {
                    main.eval({
                        $scriptContext: ctx,
                        _: { assets: [] },
                        action: redeemer
                    })
                })
            })
        })

        it("throws an error for the Other Action", () => {
            const redeemer: AssetGroupAction = {
                Other: {
                    portfolio_ptr: 0
                }
            }

            throws(() => {
                contextContext({ redeemer }).use((ctx) => {
                    main.eval({
                        $scriptContext: ctx,
                        _: { assets: [] },
                        action: redeemer
                    })
                })
            })
        })

        it("throws an error for a garbage redeemer with a higher tag", () => {
            const redeemer: AssetGroupAction = {
                Other: {
                    portfolio_ptr: 0
                }
            }

            throws(() => {
                contextContext({ redeemer }).use((ctx) => {
                    main.evalUnsafe({
                        $scriptContext: ctx,
                        _: makeListData([]),
                        action: makeConstrData(2, [makeIntData(0)])
                    })
                })
            })
        })
    })

    describe("the supply UTxO is spent", () => {
        const contextContext = (props?: {
            redeemer?: AssetGroupAction
            token?: Assets
        }) => {
            return new ScriptContextBuilder()
                .addDummyInputs(10)
                .addAssetGroupInput({ redeemer: props?.redeemer })
                .addSupplyInput({ token: props?.token })
        }

        it("succeeds if the correct supply UTxO index is supplied", () => {
            const redeemer: AssetGroupAction = {
                Count: {
                    supply_ptr: 11
                }
            }

            contextContext({ redeemer }).use((ctx) => {
                main.eval({
                    $scriptContext: ctx,
                    _: { assets: [] },
                    action: redeemer
                })
            })
        })

        it("throws an error if the supply UTxO doesn't contain the supply token", () => {
            const redeemer: AssetGroupAction = {
                Count: {
                    supply_ptr: 11
                }
            }

            contextContext({ redeemer, token: makeConfigToken() }).use(
                (ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            _: { assets: [] },
                            action: redeemer
                        })
                    })
                }
            )
        })

        it("throws an error if the wrong supply UTxO index is supplied", () => {
            const redeemer: AssetGroupAction = {
                Count: {
                    supply_ptr: 10
                }
            }

            contextContext({ redeemer }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        _: { assets: [] },
                        action: redeemer
                    })
                })
            })
        })

        it("throws an error if the Other redeemer action is used", () => {
            const redeemer: AssetGroupAction = {
                Other: {
                    portfolio_ptr: 11
                }
            }

            contextContext({ redeemer }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        _: { assets: [] },
                        action: redeemer
                    })
                })
            })
        })

        it("throws an error with a garbage redeemer action", () => {
            const redeemer: AssetGroupAction = {
                Other: {
                    portfolio_ptr: 11
                }
            }

            contextContext({ redeemer }).use((ctx) => {
                throws(() => {
                    main.evalUnsafe({
                        $scriptContext: ctx,
                        _: makeListData([]),
                        action: makeConstrData(2, [makeIntData(0)])
                    })
                })
            })
        })
    })

    describe("the portfolio UTxO is spent", () => {
        const contextContext = (props?: {
            redeemer?: AssetGroupAction
            token?: Assets
        }) => {
            return new ScriptContextBuilder()
                .addDummyInputs(10)
                .addAssetGroupInput({ redeemer: props?.redeemer })
                .addPortfolioInput({ token: props?.token })
        }

        it("succeeds if the correct portfolio UTxO index is supplied", () => {
            const redeemer: AssetGroupAction = {
                Other: {
                    portfolio_ptr: 11
                }
            }

            contextContext({ redeemer }).use((ctx) => {
                main.eval({
                    $scriptContext: ctx,
                    _: { assets: [] },
                    action: redeemer
                })
            })
        })

        it("throws an error if the portfolio UTxO doesn't contain the portfolio token", () => {
            const redeemer: AssetGroupAction = {
                Other: {
                    portfolio_ptr: 11
                }
            }

            contextContext({ redeemer, token: makeConfigToken() }).use(
                (ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            _: { assets: [] },
                            action: redeemer
                        })
                    })
                }
            )
        })

        it("throws an error if the wrong portfolio UTxO index is supplied", () => {
            const redeemer: AssetGroupAction = {
                Other: {
                    portfolio_ptr: 10
                }
            }

            contextContext({ redeemer }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        _: { assets: [] },
                        action: redeemer
                    })
                })
            })
        })

        it("throws an error if the Count redeemer action is used", () => {
            const redeemer: AssetGroupAction = {
                Count: {
                    supply_ptr: 11
                }
            }

            contextContext({ redeemer }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        _: { assets: [] },
                        action: redeemer
                    })
                })
            })
        })

        it("succeeds with a redeemer action with a tag larger than 1 (because it is the last branch in the switch expression)", () => {
            const redeemer: AssetGroupAction = {
                Other: {
                    portfolio_ptr: 11
                }
            }

            contextContext({ redeemer }).use((ctx) => {
                main.evalUnsafe({
                    $scriptContext: ctx,
                    _: makeListData([]),
                    action: makeConstrData(2, [makeIntData(11)])
                })
            })
        })
    })
})

describe("assets_validator metrics", () => {
    const program = contract.assets_validator.$hash.context.program

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
