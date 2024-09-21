import { describe, it } from "node:test"
import contract from "pbg-token-validators-test-context"
import { ScriptContextBuilder } from "./tx"
import {
    PortfolioReductionModeType,
    PortfolioReductionType,
    PriceType,
    makeConfig,
    makePortfolio,
    makePrice,
    makeSupply
} from "./data"
import { AssetClass, PubKeyHash } from "@helios-lang/ledger"
import { IntData } from "@helios-lang/uplc"
import { throws } from "node:assert"
import { IntLike } from "@helios-lang/codec-utils"

const { main } = contract.price_validator

describe("price_validator::main", () => {
    const price = makePrice({ ratio: [1000, 1000], timestamp: 0 })

    const configureContext = (props?: {
        nGroups?: IntLike
        price?: PriceType
        reductionMode?: PortfolioReductionModeType
        signingAgent?: PubKeyHash
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
            nTokens: 1000
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

    it("succeeds if the price matches the ratio of the vault lovelace value and the number of tokens in circulation", () => {
        configureContext().use((ctx) => {
            main.eval({ $scriptContext: ctx, $datum: price, _: new IntData(0) })
        })
    })

    it("throws an error if not signed by the correct agent", () => {
        configureContext({ signingAgent: PubKeyHash.dummy(1) }).use((ctx) => {
            throws(() => {
                main.eval({
                    $scriptContext: ctx,
                    $datum: price,
                    _: new IntData(0)
                })
            })
        })
    })

    it("throws an error if the new price ratio doesn't match the vault lovelace value over the number of tokens in circulation", () => {
        const price = makePrice({ ratio: [1000, 100], timestamp: 0 })

        configureContext({ price }).use((ctx) => {
            throws(() => {
                main.eval({
                    $scriptContext: ctx,
                    $datum: price,
                    _: new IntData(0)
                })
            })
        })
    })

    it("throws an error if the new price timestamp doesn't match oldest timestamp from the portfolio reduction result", () => {
        const price = makePrice({ ratio: [1, 1], timestamp: 1 })

        configureContext({ price }).use((ctx) => {
            throws(() => {
                main.eval({
                    $scriptContext: ctx,
                    $datum: price,
                    _: new IntData(0)
                })
            })
        })
    })

    it("throws an error if the portfolio reduction state isn't TotalAssetValue", () => {
        configureContext({
            reductionMode: { DoesNotExist: { asset_class: AssetClass.dummy() } }
        }).use((ctx) => {
            throws(() => {
                main.eval({
                    $scriptContext: ctx,
                    $datum: price,
                    _: new IntData(0)
                })
            })
        })
    })

    it("throws an error if the portfolio reduction hasn't yet iterated over all groups", () => {
        configureContext({ nGroups: 2 }).use((ctx) => {
            throws(() => {
                main.eval({
                    $scriptContext: ctx,
                    $datum: price,
                    _: new IntData(0)
                })
            })
        })
    })
})
