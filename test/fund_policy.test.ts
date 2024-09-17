import { deepEqual, strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import contract, {
    SEED_ID as SEED_ID_PARAM,
    INITIAL_AGENT as INITIAL_AGENT_PARAM
} from "pbg-token-validators-test-context"
import { castMetadata, makeMetadata, makeSuccessFee } from "./data"
import { ScriptContextBuilder } from "./tx"
import {
    makeConfigToken,
    makeDvpTokens,
    makeMetadataToken,
    makePortfolioToken,
    makePriceToken,
    makeSupplyToken
} from "./tokens"
import { Assets } from "@helios-lang/ledger"

const {
    SEED_ID,
    INITIAL_AGENT,
    INITIAL_TICK,
    INITIAL_SUCCESS_FEE,
    validate_minted_tokens,
    validate_initial_metadata
} = contract.fund_policy

describe("fund_policy constants", () => {
    it("SEED_ID equals the intented parameter value", () => {
        strictEqual(SEED_ID.eval({}).toString(), SEED_ID_PARAM.toString())
    })

    it("INITIAL_AGENT equals the intended parameter value", () => {
        strictEqual(INITIAL_AGENT.eval({}).toHex(), INITIAL_AGENT_PARAM.toHex())
    })

    it("INITIAL_TICK equals 0", () => {
        strictEqual(INITIAL_TICK.eval({}), 0n)
    })

    it("INITIAL_SUCCESS_FEE has parameter c0=0, c1=0.3 and sigma1=1.05", () => {
        deepEqual(
            INITIAL_SUCCESS_FEE.eval({}),
            makeSuccessFee({
                c0: 0,
                steps: [{ c: 0.3, sigma: 1.05 }]
            })
        )
    })
})

describe("fund_policy::validate_minted_tokens", () => {
    const configureContext = () => {
        return new ScriptContextBuilder()
            .mint({ assets: makeMetadataToken(1) })
            .mint({ assets: makeConfigToken(1) })
            .mint({ assets: makePortfolioToken(1) })
            .mint({ assets: makePriceToken(1) })
            .mint({ assets: makeSupplyToken(1) })
    }

    it("returns true if all five tokens are minted", () => {
        configureContext().use((ctx) => {
            strictEqual(validate_minted_tokens.eval({ $scriptContext: ctx }), true)
        })
    })

    it("returns false if a token is missing", () => {
        configureContext()
            .mint({assets: makeConfigToken(-1)})
            .use(ctx => {
                strictEqual(
                    validate_minted_tokens.eval({ $scriptContext: ctx }), 
                    false
                )
            }) 
    })

    it("throws an error if the total tokens is 5 but a token is missing", () => {
        configureContext()
            .mint({assets: makeConfigToken(-1)})
            .mint({assets: makeDvpTokens(1)})
            .use(ctx => {
                throws(() => {
                    validate_minted_tokens.eval({$scriptContext: ctx})
                })
            })
    })

    it("returns false if an additional token is minted", () => {
        configureContext()
            .mint({ assets: makeDvpTokens(1) })
            .use((ctx) => {
                strictEqual(
                    validate_minted_tokens.eval({ $scriptContext: ctx })
            , false )
            })
    })

    it("returns false if an additional token is minted too much", () => {
        configureContext()
            .mint({ assets: makeSupplyToken(1) })
            .use((ctx) => {
                strictEqual(
                    validate_minted_tokens.eval({ $scriptContext: ctx })
            , false )
            })
    })
})

describe("fund_policy::validate_initial_metadata", () => {
    const configureContext = (props?: {logo?: string, token?: Assets}) => {
        const name = "PBG Token"
        const description = "The first DVP"
        const ticker = "PBG"
        const url = "https://pbg.io"
        const decimals = 6
        const logo = props?.logo ?? "https://token.pbg.io/logo.png"
        const metadata = makeMetadata({
            name, 
            decimals, 
            description, 
            ticker, 
            url, 
            logo
        })

        return new ScriptContextBuilder()
            .addMetadataOutput({metadata, token: props?.token})
    }

    it("returns true if initial metadata is correct", () => {
        configureContext()
            .use(ctx => {
                strictEqual(validate_initial_metadata.eval({$scriptContext: ctx}), true)
            })
    })

    it("returns false if one of the metadata is wrong", () => {
        configureContext({logo: "asd"})
            .use(ctx => {
                strictEqual(validate_initial_metadata.eval({$scriptContext: ctx}), false)
            })
    })

    it("throws an error if the metadata UTxO doesn't contain the metadata token", () => {
        configureContext({token: makeDvpTokens(1)})
            .use(ctx => {
                throws(() => {
                    validate_initial_metadata.eval({$scriptContext: ctx})
                })
            })
    })
})
