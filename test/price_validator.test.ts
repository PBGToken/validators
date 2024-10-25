import { strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { IntLike } from "@helios-lang/codec-utils"
import { AssetClass, PubKeyHash } from "@helios-lang/ledger"
import { IntData, ListData } from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"
import { MAX_SCRIPT_SIZE } from "./constants"
import {
    PortfolioReductionModeType,
    PriceType,
    makeConfig,
    makePortfolio,
    makePrice,
    makeSupply
} from "./data"
import { ScriptContextBuilder } from "./tx"

const { main } = contract.price_validator

describe("price_validator::main", () => {
    const price = makePrice({ ratio: [1000, 1000], timestamp: 0 })
    const price0 = makePrice({ ratio: [100, 1], timestamp: 0 })

    const configureContext = (props?: {
        nGroups?: IntLike
        price?: PriceType
        supplyTick?: IntLike
        reductionMode?: PortfolioReductionModeType
        signingAgent?: PubKeyHash
        nTokens?: IntLike
    }) => {
        const portfolio = makePortfolio({
            nGroups: 1,
            state: {
                Reducing: {
                    group_iter: props?.nGroups ?? 1,
                    start_tick: 0,
                    mode: props?.reductionMode ?? {
                        TotalAssetValue: {
                            total: 1000,
                            oldest_timestamp: 0
                        }
                    }
                }
            }
        })

        const supply = makeSupply({
            tick: props?.supplyTick,
            nTokens: props?.nTokens ?? 1000
        })

        const agent = PubKeyHash.dummy(10)
        const config = makeConfig({ agent })

        return new ScriptContextBuilder()
            .addPortfolioRef({ portfolio })
            .addSigner(props?.signingAgent ?? agent)
            .addSupplyRef({ supply })
            .addConfigRef({ config })
            .addPriceInput({ redeemer: new IntData(0), price })
            .addPriceOutput({ price: props?.price ?? price })
    }

    const defaultTestArgs = {
        $datum: price,
        price0,
        _: new IntData(0)
    }

    it("price_validator::main #01 (succeeds if the price matches the ratio of the vault lovelace value and the number of tokens in circulation)", () => {
        configureContext().use((ctx) => {
            strictEqual(
                main.eval({ $scriptContext: ctx, ...defaultTestArgs }),
                undefined
            )
        })
    })

    it("price_validator::main #02 (throws an error if not signed by the correct agent)", () => {
        configureContext({ signingAgent: PubKeyHash.dummy(1) }).use((ctx) => {
            throws(() => {
                main.eval({
                    $scriptContext: ctx,
                    ...defaultTestArgs
                })
            }, /not signed by agent/)
        })
    })

    it("price_validator::main #03 (throws an error if the new price ratio doesn't match the vault lovelace value over the number of tokens in circulation)", () => {
        const price = makePrice({ ratio: [1000, 100], timestamp: 0 })

        configureContext({ price }).use((ctx) => {
            throws(() => {
                main.eval({
                    $scriptContext: ctx,
                    ...defaultTestArgs
                })
            }, /price denominator not equal to token circulating supply/)
        })
    })

    it("price_validator::main #04 (throws an error if the new price timestamp doesn't match oldest timestamp from the portfolio reduction result)", () => {
        const price = makePrice({ ratio: [1000, 1000], timestamp: 1 })

        configureContext({ price }).use((ctx) => {
            throws(() => {
                main.eval({
                    $scriptContext: ctx,
                    ...defaultTestArgs
                })
            }, /price timestamp not equal to oldest timestamp from reduction/)
        })
    })

    it("price_validator::main #05 (throws an error if the portfolio reduction state isn't TotalAssetValue)", () => {
        configureContext({
            reductionMode: { DoesNotExist: { asset_class: AssetClass.dummy() } }
        }).use((ctx) => {
            throws(() => {
                main.eval({
                    $scriptContext: ctx,
                    ...defaultTestArgs
                })
            }, /unexpected constructor index/)
        })
    })

    it("price_validator::main #06 (throws an error if the portfolio reduction hasn't yet iterated over all groups)", () => {
        configureContext({ nGroups: 2 }).use((ctx) => {
            throws(() => {
                main.eval({
                    $scriptContext: ctx,
                    ...defaultTestArgs
                })
            }, /reduction is incomplete/)
        })
    })

    it("price_validator::main #07 (throws an error if the supply tick is more recent than the tick in the portfolio reduction state)", () => {
        configureContext({ supplyTick: 1 }).use((ctx) => {
            throws(() => {
                main.eval({ $scriptContext: ctx, ...defaultTestArgs })
            }, /unexpected tick/)
        })
    })

    it("price_validator::main #08 (throws an error if the number of tokens is zero and the price ratio isn't copied from the previous datum)", () => {
        configureContext({ nTokens: 0 }).use((ctx) => {
            throws(() => {
                main.eval({ $scriptContext: ctx, ...defaultTestArgs })
            }, /price can't change if n_tokens is zero/)
        })
    })

    it("price_validator::main #09 (succeeds if the number of tokens is zero and the price doesn't change", () => {
        configureContext({
            nTokens: 0,
            price: makePrice({
                ratio: price0.ratio,
                timestamp: price.timestamp
            })
        }).use((ctx) => {
            strictEqual(
                main.eval({ $scriptContext: ctx, ...defaultTestArgs }),
                undefined
            )
        })
    })
})

describe("price_validator metrics", () => {
    const program = contract.price_validator.$hash.context.program

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
