import { deepEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import contract from "pbg-token-validators-test-context"
import { scripts } from "./constants"
import { makePortfolio } from "./data"
import { ScriptContextBuilder } from "./tx"
import { Address, AssetClass, Assets } from "@helios-lang/ledger"
import { makePortfolioToken } from "./tokens"
import { IntData } from "@helios-lang/uplc"
const {
    "Portfolio::find_input": find_input,
    "Portfolio::find_output": find_output,
    "Portfolio::find_ref": find_ref
} = contract.PortfolioModule

describe("Portfolio::find_input", () => {
    const portfolio = makePortfolio()
    it("found if portfolio UTxO is spent", () => {
        const ctx = new ScriptContextBuilder()
            .addDummyInputs(10)
            .addPortfolioInput({ portfolio, redeemer: { AddAssetClass: {} } })
            .build()

        scripts.forEach((currentScript) => {
            deepEqual(
                find_input.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctx
                }),
                portfolio
            )
        })
    })

    it("fails if portfolio UTxO is at wrong address", () => {
        const ctx = new ScriptContextBuilder()
            .addPortfolioInput({
                address: Address.dummy(false),
                portfolio
            })
            .addDummyInputs(10)
            .addDummyInput({ redeemer: new IntData(0) })
            .build()

        scripts.forEach((currentScript) => {
            throws(() => {
                find_input.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctx
                })
            })
        })
    })

    it("fails if portfolio UTxO contains wrong token", () => {
        const ctx = new ScriptContextBuilder()
            .addDummyInput({ redeemer: new IntData(0) })
            .addDummyInputs(5)
            .addPortfolioInput({
                portfolio,
                token: Assets.fromAssetClasses([[AssetClass.dummy(), 1]])
            })
            .addDummyInputs(5)
            .build()

        scripts.forEach((currentScript) => {
            throws(() => {
                find_input.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctx
                })
            })
        })
    })

    it("fails if portfolio UTxO contains less than 1 token", () => {
        const ctx = new ScriptContextBuilder()
            .addDummyInputs(5)
            .addDummyInput({ redeemer: new IntData(0) })
            .addPortfolioInput({
                portfolio,
                token: makePortfolioToken(0)
            })
            .addDummyInputs(5)
            .build()

        scripts.forEach((currentScript) => {
            throws(() => {
                find_input.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctx
                })
            })
        })
    })

    it("ok if portfolio UTxO contains more than 1 token", () => {
        const ctx = new ScriptContextBuilder()
            .addDummyInputs(5)
            .addDummyInput({ redeemer: new IntData(0) })
            .addPortfolioInput({
                portfolio,
                token: makePortfolioToken(2)
            })
            .addDummyInputs(5)
            .build()

        scripts.forEach((currentScript) => {
            deepEqual(
                find_input.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctx
                }),
                portfolio
            )
        })
    })
})

describe("Portfolio::find_output", () => {
    const portfolio = makePortfolio()

    it("ok if portfolio UTxO is returned", () => {
        const ctx = new ScriptContextBuilder()
            .addDummyInput({ redeemer: new IntData(0) })
            .addPortfolioOutput({ portfolio })
            .build()

        scripts.forEach((currentScript) => {
            deepEqual(
                find_output.eval({
                    $scriptContext: ctx,
                    $currentScript: currentScript
                }),
                portfolio
            )
        })
    })

    it("fails if incorrect address", () => {
        const ctx = new ScriptContextBuilder()
            .addDummyInput({ redeemer: new IntData(0) })
            .addDummyInputs(9)
            .addPortfolioOutput({ address: Address.dummy(false), portfolio })
            .build()

        scripts.forEach((currentScript) => {
            throws(() => {
                find_output.eval({
                    $scriptContext: ctx,
                    $currentScript: currentScript
                })
            })
        })
    })

    it("fails if not exactly 1 token is returned", () => {
        const ctx = new ScriptContextBuilder()
            .addDummyInput({ redeemer: new IntData(0) })
            .addPortfolioOutput({ portfolio, token: makePortfolioToken(2) })
            .build()

        scripts.forEach((currentScript) => {
            throws(() => {
                find_output.eval({
                    $scriptContext: ctx,
                    $currentScript: currentScript
                })
            })
        })
    })
})

describe("Portfolio::find_ref", () => {
    const portfolio = makePortfolio()

    it("ok if correctly referenced", () => {    
        const ctx = new ScriptContextBuilder().addPortfolioRef({portfolio}).addDummyInput({redeemer: new IntData(0)}).build()

        scripts.forEach(currentScript => {
            deepEqual(find_ref.eval({
                $scriptContext: ctx,
                $currentScript: currentScript
            }), portfolio)
        })
    })

    it("fails if at wrong address for all script except config_validator", () => {
        const ctx = new ScriptContextBuilder().addPortfolioRef({address: Address.dummy(false), portfolio}).addDummyInput({redeemer: new IntData(0)}).build()

        scripts.forEach(currentScript => {
            if (currentScript == "config_validator") {
                deepEqual(find_ref.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctx
                }), portfolio)
            } else {
                throws(() => {
                    find_ref.eval({
                        $currentScript: currentScript,
                        $scriptContext: ctx
                    })
                })
            }
        })
    })
})