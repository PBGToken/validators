import { deepEqual, strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { IntLike } from "@helios-lang/codec-utils"
import {
    Address,
    AssetClass,
    Assets,
    PubKeyHash,
    TxOutputId,
    Value
} from "@helios-lang/ledger"
import { ByteArrayData, IntData } from "@helios-lang/uplc"
import contract, {
    SEED_ID as SEED_ID_PARAM,
    INITIAL_AGENT as INITIAL_AGENT_PARAM
} from "pbg-token-validators-test-context"
import { MAX_SCRIPT_SIZE } from "./constants"
import {
    RatioType,
    ReimbursementType,
    SuccessFeeType,
    makeCollectingReimbursement,
    makeConfig,
    makeExtractingReimbursement,
    makeMetadata,
    makePortfolio,
    makePrice,
    makeSuccessFee,
    makeSupply
} from "./data"
import {
    makeAssetsToken,
    makeConfigToken,
    makeDvpTokens,
    makeMetadataToken,
    makePortfolioToken,
    makePriceToken,
    makeReimbursementToken,
    makeSupplyToken,
    makeVoucherRefToken,
    makeVoucherUserToken,
    AssetClasses,
    makeVoucherPair
} from "./tokens"
import { ScriptContextBuilder } from "./tx"

const {
    SEED_ID,
    INITIAL_AGENT,
    INITIAL_TICK,
    INITIAL_SUCCESS_FEE,
    INITIAL_CYCLE_PERIOD,
    INITIAL_UPDATE_DELAY,
    INITIAL_CYCLE_ID,
    validate_minted_tokens,
    validate_initial_metadata,
    validate_initial_config,
    validate_initial_portfolio,
    validate_initial_price,
    validate_initial_reimbursement,
    validate_initial_supply,
    validate_initialization,
    validate_vault_spending,
    validate_mint_or_burn_asset_groups,
    validate_mint_or_burn_dvp_tokens_vouchers_or_reimbursement,
    main
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

    it("INITIAL_CYCLE_PERIOD equals 365 days", () => {
        strictEqual(INITIAL_CYCLE_PERIOD.eval({}), 365n * 24n * 3600n * 1000n)
    })

    it("INITIAL_UPDATE_DELAY equals 2 weeks", () => {
        strictEqual(
            INITIAL_UPDATE_DELAY.eval({}),
            2n * 7n * 24n * 3600n * 1000n
        )
    })

    it("INITIAL_CYCLE_ID equals 1", () => {
        strictEqual(INITIAL_CYCLE_ID.eval({}), 1n)
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
            .mint({ assets: makeReimbursementToken(1, 1) })
    }

    it("fund_policy::validate_minted_tokens #01 (succeeds if all five tokens are minted)", () => {
        configureContext().use((ctx) => {
            validate_minted_tokens.eval({ $scriptContext: ctx })
        })
    })

    it("fund_policy::validate_minted_tokens #02 (throws an error if a token is missing)", () => {
        configureContext()
            .mint({ assets: makeConfigToken(-1) })
            .use((ctx) => {
                throws(() => {
                    validate_minted_tokens.eval({ $scriptContext: ctx })
                }, /not precisely 6 tokens minted/)
            })
    })

    it("fund_policy::validate_minted_tokens #03 (throws an error if the total tokens is 6 but a token is missing)", () => {
        configureContext()
            .mint({ assets: makeConfigToken(-1) })
            .mint({ assets: makeDvpTokens(1) })
            .use((ctx) => {
                throws(() => {
                    validate_minted_tokens.eval({ $scriptContext: ctx })
                }, /key not found/)
            })
    })

    it("fund_policy::validate_minted_tokens #04 (throws an error if an additional token is minted)", () => {
        configureContext()
            .mint({ assets: makeDvpTokens(1) })
            .use((ctx) => {
                throws(() => {
                    validate_minted_tokens.eval({ $scriptContext: ctx })
                }, /not precisely 6 tokens minted/)
            })
    })

    it("fund_policy::validate_minted_tokens #05 (throws an error if the initial supply token is minted twice)", () => {
        configureContext()
            .mint({ assets: makeSupplyToken(1) })
            .use((ctx) => {
                throws(() => {
                    validate_minted_tokens.eval({ $scriptContext: ctx })
                }, /supply token not minted/)
            })
    })

    it("fund_policy::validate_minted_tokens #06 (throws an error if the initial reimbursement token has the wrong id)", () => {
        configureContext()
            .mint({
                assets: makeReimbursementToken(1, -1).add(
                    makeReimbursementToken(2, 1)
                )
            })
            .use((ctx) => {
                throws(() => {
                    validate_minted_tokens.eval({ $scriptContext: ctx })
                }, /key not found/)
            })
    })

    it("fund_policy::validate_minted_tokens #07 (throws an error if the initial reimbursement token is minted twice)", () => {
        configureContext()
            .mint({ assets: makeReimbursementToken(1, 1) })
            .use((ctx) => {
                throws(() => {
                    validate_minted_tokens.eval({ $scriptContext: ctx })
                }, /reimbursement token not minted/)
            })
    })
})

function makeInitialMetadata(props?: { logo?: string }) {
    const name = "PBG Token"
    const description = "The first DVP"
    const ticker = "PBG"
    const url = "https://pbg.io"
    const decimals = 6
    const logo = props?.logo ?? "https://token.pbg.io/logo.png"

    return makeMetadata({
        name,
        decimals,
        description,
        ticker,
        url,
        logo
    })
}

describe("fund_policy::validate_initial_metadata", () => {
    const configureContext = (props?: { logo?: string; token?: Assets }) => {
        const metadata = makeInitialMetadata({ logo: props?.logo })

        return new ScriptContextBuilder().addMetadataOutput({
            metadata,
            token: props?.token
        })
    }

    it("fund_policy::validate_initial_metadata #01 (succeeds if the initial metadata is correct)", () => {
        configureContext().use((ctx) => {
            validate_initial_metadata.eval({ $scriptContext: ctx })
        })
    })

    it("fund_policy::validate_initial_metadata #02 (throws an error if one of the metadata is wrong)", () => {
        configureContext({ logo: "asd" }).use((ctx) => {
            throws(() => {
                validate_initial_metadata.eval({ $scriptContext: ctx })
            }, /wrong metadata logo uri/)
        })
    })

    it("fund_policy::validate_initial_metadata #03 (throws an error if the metadata UTxO doesn't contain the metadata token)", () => {
        configureContext({ token: makeDvpTokens(1) }).use((ctx) => {
            throws(() => {
                validate_initial_metadata.eval({ $scriptContext: ctx })
            })
        })
    })
})

function makeInitialConfig(props?: {
    relMintFee?: number
    successFee?: SuccessFeeType
}) {
    const successFee =
        props?.successFee ??
        makeSuccessFee({
            c0: 0,
            steps: [{ c: 0.3, sigma: 1.05 }]
        })

    return makeConfig({
        agent: INITIAL_AGENT_PARAM,
        mintFee: {
            relative: props?.relMintFee ?? 0.005,
            minimum: 30_000
        },
        burnFee: {
            relative: 0.005,
            minimum: 30_000
        },
        managementFeePeriod: 24 * 60 * 60 * 1000,
        relManagementFee: 0.0001,
        successFee,
        token: {
            maxSupply: 100_000_000_000,
            maxPriceAge: 24 * 60 * 60 * 1000
        },
        governance: {
            updateDelay: 2 * 7 * 24 * 60 * 60 * 1000
        }
    })
}

describe("fund_policy::validate_initial_config", () => {
    const configureContext = (props?: {
        relMintFee?: number
        signingAgent?: PubKeyHash
        successFee?: SuccessFeeType
        token?: Assets
    }) => {
        const config = makeInitialConfig({
            relMintFee: props?.relMintFee,
            successFee: props?.successFee
        })

        return new ScriptContextBuilder()
            .addSigner(props?.signingAgent ?? INITIAL_AGENT_PARAM)
            .addConfigOutput({ config, token: props?.token })
    }

    it("fund_policy::validate_initial_config #01 (succeeds if config data is correct)", () => {
        configureContext().use((ctx) => {
            validate_initial_config.eval({ $scriptContext: ctx })
        })
    })

    it("fund_policy::validate_initial_config #02 (throws an error if the tx isn't signed by the agent)", () => {
        configureContext({ signingAgent: PubKeyHash.dummy(6) }).use((ctx) => {
            throws(() => {
                validate_initial_config.eval({ $scriptContext: ctx })
            }, /not signed by agent/)
        })
    })

    it("fund_policy::validate_initial_config #03 (throws an error if the success fee parameters are invalid)", () => {
        configureContext({
            successFee: makeSuccessFee({ c0: -0.1, steps: [] })
        }).use((ctx) => {
            throws(
                () => {
                    validate_initial_config.eval({ $scriptContext: ctx })
                },
                // part of config equality check, the INITIAL_SUCCESS_FEE isn't actually checked here
                /unexpected initial config datum/
            )
        })
    })

    it("fund_policy::validate_initial_config #04 (throws an error if the config data is wrong)", () => {
        configureContext({ relMintFee: 0.004 }).use((ctx) => {
            throws(() => {
                validate_initial_config.eval({ $scriptContext: ctx })
            }, /unexpected initial config datum/)
        })
    })

    it("fund_policy::validate_initial_config #05 (throws an error if the config UTxO doesn't contain the config token)", () => {
        configureContext({ token: makeDvpTokens(1) }).use((ctx) => {
            throws(() => {
                validate_initial_config.eval({ $scriptContext: ctx })
            })
        })
    })
})

function makeInitialPortfolio(props?: { nGroups?: number }) {
    return makePortfolio({
        nGroups: props?.nGroups ?? 0,
        state: {
            Idle: {}
        }
    })
}

describe("fund_policy::validate_initial_portfolio", () => {
    const configureContext = (props?: { nGroups?: number; token?: Assets }) => {
        const portfolio = makeInitialPortfolio({ nGroups: props?.nGroups })

        return new ScriptContextBuilder().addPortfolioOutput({
            portfolio,
            token: props?.token
        })
    }

    it("fund_policy::validate_initial_portfolio #01 (succeeds if the portfolio output datum is correct)", () => {
        configureContext().use((ctx) => {
            validate_initial_portfolio.eval({ $scriptContext: ctx })
        })
    })

    it("fund_policy::validate_initial_portfolio #02 (throws an error if the portfolio output datum isn't correct)", () => {
        configureContext({ nGroups: 1 }).use((ctx) => {
            throws(() => {
                validate_initial_portfolio.eval({ $scriptContext: ctx })
            }, /unexpected initial portfolio datum/)
        })
    })

    it("fund_policy::validate_initial_portfolio #03 (throws an error of the portfolio UTxO doesn't contain the portfolio token)", () => {
        configureContext({ token: makeDvpTokens(1) }).use((ctx) => {
            throws(() => {
                validate_initial_portfolio.eval({ $scriptContext: ctx })
            })
        })
    })
})

function makeInitialPrice(props?: { ratio?: RatioType; timestamp?: number }) {
    return makePrice({
        ratio: props?.ratio ?? [100, 1],
        timestamp: props?.timestamp ?? 0
    })
}

describe("func_policy::validate_initial_price", () => {
    const configureContext = (props?: {
        ratio?: RatioType
        timestamp?: number
        token?: Assets
    }) => {
        const price = makeInitialPrice({
            ratio: props?.ratio,
            timestamp: props?.timestamp
        })

        return new ScriptContextBuilder().addPriceOutput({
            price,
            token: props?.token
        })
    }

    it("func_policy::validate_initial_price #01 (succeeds if the price output datum is correct)", () => {
        configureContext().use((ctx) => {
            validate_initial_price.eval({ $scriptContext: ctx })
        })
    })

    it("func_policy::validate_initial_price #02 (throws an error if the price UTxO doesn't contain the price token)", () => {
        configureContext({ token: makeDvpTokens(1) }).use((ctx) => {
            throws(() => {
                validate_initial_price.eval({ $scriptContext: ctx })
            })
        })
    })

    it("func_policy::validate_initial_price #03 (throws an error if the price timestamp is wrong)", () => {
        configureContext({ timestamp: 1 }).use((ctx) => {
            throws(() => {
                validate_initial_price.eval({ $scriptContext: ctx })
            }, /unexpected initial price datum/)
        })
    })

    it("func_policy::validate_initial_price #04 (throws an error if the price ratio is wrong)", () => {
        configureContext({ ratio: [1000, 10] }).use((ctx) => {
            throws(() => {
                validate_initial_price.eval({ $scriptContext: ctx })
            }, /unexpected initial price datum/)
        })
    })
})

function makeInitialSupply(props?: {
    initialTick?: number
    managementFeeTimestmap?: number
    successFeeStart?: number
    nTokens?: number
    nVouchers?: number
    lastVoucherId?: number
    nLovelace?: number
    successFeePeriodId?: number
    successFeePeriod?: number
    successFeeStartPrice?: [number, number]
}) {
    return makeSupply({
        tick: props?.initialTick ?? 0,
        nTokens: props?.nTokens ?? 0,
        nVouchers: props?.nVouchers ?? 0,
        lastVoucherId: props?.lastVoucherId ?? 0,
        nLovelace: props?.nLovelace ?? 0,
        managementFeeTimestamp: props?.managementFeeTimestmap ?? 0,
        successFee: {
            periodId: props?.successFeePeriodId ?? 0,
            start_time: props?.successFeeStart ?? 0,
            period: props?.successFeePeriod ?? 365 * 24 * 60 * 60 * 1000
        },
        startPrice: props?.successFeeStartPrice ?? [100, 1]
    })
}

describe("fund_policy::validate_initial_reimbursement", () => {
    const configureContext = (props?: {
        reimbursement?: ReimbursementType
        id?: IntLike
    }) => {
        const reimbursement = makeCollectingReimbursement()

        return new ScriptContextBuilder()
            .addReimbursementOutput({
                id: props?.id ?? 1,
                reimbursement: props?.reimbursement ?? reimbursement
            })
            .addDummyInputs(10)
    }

    it("fund_policy::validate_initial_reimbursement #01 (succeeds if the initial reimbursement with id 1 has the correct datum)", () => {
        configureContext().use((ctx) => {
            strictEqual(
                validate_initial_reimbursement.eval({ $scriptContext: ctx }),
                undefined
            )
        })
    })

    it("fund_policy::validate_initial_reimbursement #02 (throws an error if the reimbursement id of the output doesn't correspond)", () => {
        configureContext({ id: 0 }).use((ctx) => {
            throws(() => {
                validate_initial_reimbursement.eval({ $scriptContext: ctx })
            }, /not found/)
        })
    })

    it("fund_policy::validate_initial_reimbursement #03 (throws an error if the reimbursement datum contains the wrong start price)", () => {
        configureContext({
            reimbursement: makeCollectingReimbursement({
                startPrice: [1000, 10]
            })
        }).use((ctx) => {
            throws(() => {
                validate_initial_reimbursement.eval({ $scriptContext: ctx })
            }, /initial reimbursement start_price not correctly set/)
        })
    })

    it("fund_policy::validate_initial_reimbursement #04 (throws an error if the reimbursement datum isn't in Collecting state)", () => {
        configureContext({ reimbursement: makeExtractingReimbursement() }).use(
            (ctx) => {
                throws(() => {
                    validate_initial_reimbursement.eval({ $scriptContext: ctx })
                }, /initial reimbursement state not set to Collecting/)
            }
        )
    })
})

describe("fund_policy::validate_initial_supply", () => {
    const configureContext = (props?: {
        initialTick?: number
        nTokens?: number
        nVouchers?: number
        lastVoucherId?: number
        token?: Assets
        nLovelace?: number
        managementFeeTimestamp?: number
        successFeeTimestamp?: number
        successFeePeriodId?: number
        successFeePeriod?: number
        successFeeStartPrice?: [number, number]
    }) => {
        const supply = makeInitialSupply({
            initialTick: props?.initialTick,
            managementFeeTimestmap: props?.managementFeeTimestamp ?? 124,
            successFeeStart: props?.successFeeTimestamp ?? 124,
            nTokens: props?.nTokens ?? 0,
            nVouchers: props?.nVouchers ?? 0,
            lastVoucherId: props?.lastVoucherId ?? 0,
            nLovelace: props?.nLovelace ?? 0,
            successFeePeriodId: props?.successFeePeriodId ?? 1,
            successFeePeriod: props?.successFeePeriod ?? 365 * 24 * 3600 * 1000,
            successFeeStartPrice: props?.successFeeStartPrice ?? [100, 1]
        })

        return new ScriptContextBuilder()
            .setTimeRange({ start: 100, end: 123 })
            .addSupplyOutput({
                supply,
                token: props?.token
            })
    }

    it("fund_policy::validate_initial_supply #01 (succeeds if the supply output datum is correct)", () => {
        configureContext().use((ctx) => {
            strictEqual(
                validate_initial_supply.eval({ $scriptContext: ctx }),
                undefined
            )
        })
    })

    it("fund_policy::validate_initial_supply #02 (throws an error if the supply UTxO doesn't contain the supply token)", () => {
        configureContext({ token: makeDvpTokens(1) }).use((ctx) => {
            throws(() => {
                validate_initial_supply.eval({ $scriptContext: ctx })
            }, /doesn't contain only the supply token/)
        })
    })

    it("fund_policy::validate_initial_supply #03 (throws an error if the initial tick isn't zero)", () => {
        configureContext({ initialTick: 1 }).use((ctx) => {
            throws(() => {
                validate_initial_supply.eval({ $scriptContext: ctx })
            }, /supply tick not correctly set/)
        })
    })

    it("fund_policy::validate_initial_supply #04 (throws an error if the validity time range start isn't set)", () => {
        configureContext()
            .setTimeRange({ start: undefined })
            .use((ctx) => {
                throws(() => {
                    validate_initial_supply.eval({ $scriptContext: ctx })
                }, /empty list in headList/)
            })
    })

    it("fund_policy::validate_initial_supply #05 (throws an error if the validity time range end isn't set)", () => {
        configureContext()
            .setTimeRange({ end: undefined })
            .use((ctx) => {
                throws(() => {
                    validate_initial_supply.eval({ $scriptContext: ctx })
                }, /empty list in headList/)
            })
    })

    it("fund_policy::validate_initial_supply #06 (throws an error if the validity time range is too large)", () => {
        configureContext()
            .setTimeRange({ start: 0, end: 90_000_000 })
            .use((ctx) => {
                throws(() => {
                    validate_initial_supply.eval({ $scriptContext: ctx })
                }, /validity time range is too large/)
            })
    })

    it("fund_policy::validate_initial_supply #07 (throws an error if the circulating token supply isn't zero)", () => {
        configureContext({ nTokens: 1 }).use((ctx) => {
            throws(() => {
                validate_initial_supply.eval({ $scriptContext: ctx })
            }, /circulating supply not set to 0/)
        })
    })

    it("fund_policy::validate_initial_supply #08 (throws an error if the circulating token supply isn't zero)", () => {
        configureContext({ nTokens: 1 }).use((ctx) => {
            throws(() => {
                validate_initial_supply.eval({ $scriptContext: ctx })
            }, /circulating supply not set to 0/)
        })
    })

    it("fund_policy::validate_initial_supply #09 (throws an error if the voucher count isn't zero)", () => {
        configureContext({ nVouchers: 1 }).use((ctx) => {
            throws(() => {
                validate_initial_supply.eval({ $scriptContext: ctx })
            }, /voucher count not set to 0/)
        })
    })

    it("fund_policy::validate_initial_supply #10 (throws an error if the last_voucher_id isn't zero)", () => {
        configureContext({ lastVoucherId: 1 }).use((ctx) => {
            throws(() => {
                validate_initial_supply.eval({ $scriptContext: ctx })
            }, /last_voucher_id not set to 0/)
        })
    })

    it("fund_policy::validate_initial_supply #11 (throws an error if the number of lovelace isn't zero)", () => {
        configureContext({ nLovelace: 1 }).use((ctx) => {
            throws(() => {
                validate_initial_supply.eval({ $scriptContext: ctx })
            }, /n_lovelace not set to 0/)
        })
    })

    it("fund policy::validate_initial_supply #12 (throws an error if the management fee timestamp doesn't lie in the future)", () => {
        configureContext({ managementFeeTimestamp: 122 }).use((ctx) => {
            throws(() => {
                validate_initial_supply.eval({ $scriptContext: ctx })
            }, /management fee timestamp lies in the past/)
        })
    })

    it("fund policy::validate_initial_supply #13 (throws an error if the management fee timestamp lies too far in the future)", () => {
        configureContext({ managementFeeTimestamp: 90_000_000 }).use((ctx) => {
            throws(() => {
                validate_initial_supply.eval({ $scriptContext: ctx })
            }, /management fee timestamp lies too far in the future/)
        })
    })

    it("fund_policy::validate_initial_supply #14 (throws an error if the success fee cycle period id isn't 1)", () => {
        configureContext({ successFeePeriodId: 0 }).use((ctx) => {
            throws(() => {
                validate_initial_supply.eval({ $scriptContext: ctx })
            }, /cycle id not set to 1/)
        })
    })

    it("fund policy::validate_initial_supply #15 (throws an error if the success fee cycle start timestamp doesn't lie in the future)", () => {
        configureContext({ successFeeTimestamp: 122 }).use((ctx) => {
            throws(() => {
                validate_initial_supply.eval({ $scriptContext: ctx })
            }, /cycle start time lies in the past/)
        })
    })

    it("fund policy::validate_initial_supply #16 (throws an error if the success fee cycle start timestamp lies too far in the future)", () => {
        configureContext({ successFeeTimestamp: 90_000_000 }).use((ctx) => {
            throws(() => {
                validate_initial_supply.eval({ $scriptContext: ctx })
            }, /success fee timestamp lies too far in the future/)
        })
    })

    it("fund_policy::validate_initial_supply #17 (throws an error if the success fee cycle period isn't set to 1 year)", () => {
        configureContext({ successFeePeriod: 366 * 24 * 3600 * 1000 }).use(
            (ctx) => {
                throws(() => {
                    validate_initial_supply.eval({ $scriptContext: ctx })
                }, /cycle period not correctly set/)
            }
        )
    })

    it("fund_policy::validate_initial_supply #18 (throws an error if the success fee start price isn't set to 100/1)", () => {
        configureContext({ successFeeStartPrice: [1000, 10] }).use((ctx) => {
            throws(() => {
                validate_initial_supply.eval({ $scriptContext: ctx })
            }, /cycle price not correctly set/)
        })
    })
})

describe("fund_policy::validate_initialization", () => {
    const configureContext = (props?: {
        initialTick?: number
        metadataLogo?: string
        nGroups?: number
        priceTimestamp?: number
        relMintFee?: number
        reimbursement?: ReimbursementType
    }) => {
        const metadata = makeInitialMetadata({ logo: props?.metadataLogo })
        const config = makeInitialConfig({ relMintFee: props?.relMintFee })
        const portfolio = makeInitialPortfolio({ nGroups: props?.nGroups })
        const price = makeInitialPrice({ timestamp: props?.priceTimestamp })
        const supply = makeInitialSupply({
            initialTick: props?.initialTick,
            managementFeeTimestmap: 124,
            successFeeStart: 125,
            successFeePeriodId: 1
        })
        const reimbursement =
            props?.reimbursement ??
            makeCollectingReimbursement({ startPrice: price.value })

        const metadataToken = makeMetadataToken(1)
        const configToken = makeConfigToken(1)
        const portfolioToken = makePortfolioToken(1)
        const priceToken = makePriceToken(1)
        const supplyToken = makeSupplyToken(1)
        const reimbursementToken = makeReimbursementToken(1, 1)

        return new ScriptContextBuilder()
            .mint({ assets: metadataToken })
            .mint({ assets: configToken })
            .mint({ assets: portfolioToken })
            .mint({ assets: priceToken })
            .mint({ assets: reimbursementToken })
            .mint({ assets: supplyToken })
            .setTimeRange({ start: 100, end: 123 })
            .addSupplyOutput({ supply, token: supplyToken })
            .addPriceOutput({ price, token: priceToken })
            .addPortfolioOutput({ portfolio, token: portfolioToken })
            .addSigner(INITIAL_AGENT_PARAM)
            .addConfigOutput({ config, token: configToken })
            .addMetadataOutput({ metadata, token: metadataToken })
            .addReimbursementOutput({
                reimbursement,
                token: reimbursementToken
            })
    }

    it("fund_policy::validate_initialization #01 (succeeds if all UTxO are correctly initialized and contain the correct tokens)", () => {
        configureContext().use((ctx) => {
            validate_initialization.eval({ $scriptContext: ctx })
        })
    })

    it("fund_policy::validate_initialization #02 (throws an error if the metadata contains a mistake)", () => {
        configureContext({ metadataLogo: "asd" }).use((ctx) => {
            throws(() => {
                validate_initialization.eval({ $scriptContext: ctx })
            }, /wrong metadata logo uri/)
        })
    })

    it("fund_policy::validate_initialization #03 (throws an error if the config data contains a mistake)", () => {
        configureContext({ relMintFee: 0 }).use((ctx) => {
            throws(() => {
                validate_initialization.eval({ $scriptContext: ctx })
            }, /unexpected initial config datum/)
        })
    })

    it("fund_policy::validate_initialization #04 (throws an error if the portfolio data contains a mistake)", () => {
        configureContext({ nGroups: -1 }).use((ctx) => {
            throws(() => {
                validate_initialization.eval({ $scriptContext: ctx })
            }, /unexpected initial portfolio datum/)
        })
    })

    it("fund_policy::validate_initialization #05 (throws an error if the price data contains a mistake)", () => {
        configureContext({ priceTimestamp: -1 }).use((ctx) => {
            throws(() => {
                validate_initialization.eval({ $scriptContext: ctx })
            }, /unexpected initial price datum/)
        })
    })

    it("fund_policy::validate_initialization #06 (throws an error if the supply data contains a mistake)", () => {
        configureContext({ initialTick: -1 }).use((ctx) => {
            throws(() => {
                validate_initialization.eval({ $scriptContext: ctx })
            }, /supply tick not correctly set/)
        })
    })

    it("fund_policy::validate_initialization #07 (throws an error if the reimbursement datum is in the wrong state)", () => {
        configureContext({ reimbursement: makeExtractingReimbursement() }).use(
            (ctx) => {
                throws(() => {
                    validate_initialization.eval({ $scriptContext: ctx })
                }, /initial reimbursement state not set to Collecting/)
            }
        )
    })
})

describe("fund_policy::validate_vault_spending", () => {
    const configureContext = (props?: {
        address?: Address
        refer?: boolean
        token?: Assets
    }) => {
        const scb = new ScriptContextBuilder()

        if (props?.refer) {
            scb.addSupplyRef({ address: props?.address, token: props?.token })
        } else {
            scb.addSupplyInput({ address: props?.address, token: props?.token })
        }

        return scb
    }

    it("fund_policy::validate_vault_spending #01 (succeeds if the tx is witnessed by spending the supply UTxO)", () => {
        configureContext().use((ctx) => {
            validate_vault_spending.eval({ $scriptContext: ctx })
        })
    })

    it("fund_policy::validate_vault_spending #02 (throws an error if the supply UTxO doesn't contain the supply token)", () => {
        configureContext({ token: makeDvpTokens(1) }).use((ctx) => {
            throws(() => {
                validate_vault_spending.eval({ $scriptContext: ctx })
            })
        })
    })

    it("fund_policy::validate_vault_spending #03 (throws an error if the supply UTxO isn't at the supply_validator address)", () => {
        configureContext({ address: Address.dummy(false) }).use((ctx) => {
            throws(() => {
                validate_vault_spending.eval({ $scriptContext: ctx })
            }, /vault spending not witnessed by supply spending/)
        })
    })

    it("fund_policy::validate_vault_spending #04 (throws an error if the supply UTxO is referenced instead of spent)", () => {
        configureContext({ refer: true }).use((ctx) => {
            throws(() => {
                validate_vault_spending.eval({ $scriptContext: ctx })
            }, /vault spending not witnessed by supply spending/)
        })
    })
})

describe("fund_policy::validate_mint_or_burn_asset_groups", () => {
    const configureContext = (props?: {
        address?: Address
        refer?: boolean
        token?: Assets
    }) => {
        const scb = new ScriptContextBuilder()

        if (props?.refer) {
            scb.addPortfolioRef({
                address: props?.address,
                token: props?.token
            })
        } else {
            scb.addPortfolioInput({
                address: props?.address,
                token: props?.token
            })
        }

        return scb
    }

    it("fund_policy::validate_mint_or_burn_asset_groups #01 (succeeds if the tx is witnessed by spending the portfolio UTxO)", () => {
        configureContext().use((ctx) => {
            validate_mint_or_burn_asset_groups.eval({
                $scriptContext: ctx
            })
        })
    })

    it("fund_policy::validate_mint_or_burn_asset_groups #02 (throws an error if the supply UTxO doesn't contain the portfolio token)", () => {
        configureContext({ token: makeDvpTokens(1) }).use((ctx) => {
            throws(() => {
                validate_mint_or_burn_asset_groups.eval({ $scriptContext: ctx })
            })
        })
    })

    it("fund_policy::validate_mint_or_burn_asset_groups #03 (throws an error if the portfolio UTxO isn't at the portfolio_validator address)", () => {
        configureContext({ address: Address.dummy(false) }).use((ctx) => {
            throws(() => {
                validate_mint_or_burn_asset_groups.eval({
                    $scriptContext: ctx
                })
            }, /mint\/burn of asset groups not witnessed by portfolio spending/)
        })
    })

    it("fund_policy::validate_mint_or_burn_asset_groups #04 (throws an error if the portfolio UTxO is referenced instead of spent)", () => {
        configureContext({ refer: true }).use((ctx) => {
            throws(() => {
                validate_mint_or_burn_asset_groups.eval({
                    $scriptContext: ctx
                })
            }, /mint\/burn of asset groups not witnessed by portfolio spending/)
        })
    })
})

describe("fund_policy::validate_mint_or_burn_dvp_tokens_vouchers_or_reimbursement", () => {
    const configureContext = (props?: {
        address?: Address
        refer?: boolean
        token?: Assets
    }) => {
        const scb = new ScriptContextBuilder()

        if (props?.refer) {
            scb.addSupplyRef({ address: props?.address, token: props?.token })
        } else {
            scb.addSupplyInput({ address: props?.address, token: props?.token })
        }

        return scb
    }

    it("fund_policy::validate_mint_or_burn_dvp_tokens_vouchers_or_reimbursement #01 (succeeds if the tx is witnessed by spending the supply UTxO)", () => {
        configureContext().use((ctx) => {
            validate_mint_or_burn_dvp_tokens_vouchers_or_reimbursement.eval({
                $scriptContext: ctx
            })
        })
    })

    it("fund_policy::validate_mint_or_burn_dvp_tokens_vouchers_or_reimbursement #02 (throws an error if the supply UTxO doesn't contain the supply token)", () => {
        configureContext({ token: makeDvpTokens(1) }).use((ctx) => {
            throws(() => {
                validate_mint_or_burn_dvp_tokens_vouchers_or_reimbursement.eval(
                    { $scriptContext: ctx }
                )
            })
        })
    })

    it("fund_policy::validate_mint_or_burn_dvp_tokens_vouchers_or_reimbursement #03 (throws an error if the supply UTxO isn't at the supply_validator address)", () => {
        configureContext({ address: Address.dummy(false) }).use((ctx) => {
            throws(() => {
                validate_mint_or_burn_dvp_tokens_vouchers_or_reimbursement.eval(
                    { $scriptContext: ctx }
                )
            }, /mint\/burn of other tokens not witnessed by supply spending/)
        })
    })

    it("fund_policy::validate_mint_or_burn_dvp_tokens_vouchers_or_reimbursement #04 (throws an error if the supply UTxO is referenced instead of spent)", () => {
        configureContext({ refer: true }).use((ctx) => {
            throws(() => {
                validate_mint_or_burn_dvp_tokens_vouchers_or_reimbursement.eval(
                    { $scriptContext: ctx }
                )
            }, /mint\/burn of other tokens not witnessed by supply spending/)
        })
    })
})

describe("fund_policy::main", () => {
    describe("spending from vault", () => {
        const configureContext = (props?: { address?: Address }) => {
            return new ScriptContextBuilder().addSupplyInput().takeFromVault({
                address: props?.address,
                redeemer: new IntData(0),
                value: new Value(2_000_000)
            })
        }

        it("fund_policy::main #01 (succeeds if called for spending and witnessed by supply_validator)", () => {
            configureContext().use((ctx) => {
                main.eval({
                    $scriptContext: ctx,
                    $datum: new ByteArrayData([]),
                    args: {
                        Spending: {
                            redeemer: new IntData(0)
                        }
                    }
                })
            })
        })

        it("fund_policy::main #02 (throws an error if the currently spent input isn't from a validator address (unable to get own hash))", () => {
            configureContext({ address: Address.dummy(false) }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        $datum: new ByteArrayData([]),
                        args: {
                            Spending: {
                                redeemer: new IntData(0)
                            }
                        }
                    })
                })
            })
        })
    })

    describe("initializing", () => {
        const redeemer = new IntData(0)

        const configureContext = (props?: { seedId?: TxOutputId }) => {
            const metadata = makeInitialMetadata()
            const config = makeInitialConfig()
            const portfolio = makeInitialPortfolio()
            const price = makeInitialPrice()
            const supply = makeInitialSupply({
                managementFeeTimestmap: 124,
                successFeeStart: 124,
                successFeePeriodId: 1
            })
            const reimbursement = makeCollectingReimbursement({
                startPrice: price.value
            })

            const metadataToken = makeMetadataToken(1)
            const configToken = makeConfigToken(1)
            const portfolioToken = makePortfolioToken(1)
            const priceToken = makePriceToken(1)
            const reimbursementToken = makeReimbursementToken(1, 1)
            const supplyToken = makeSupplyToken(1)

            return new ScriptContextBuilder()
                .setTimeRange({ start: 100, end: 123 })
                .mint({ assets: metadataToken, redeemer })
                .mint({ assets: configToken })
                .mint({ assets: portfolioToken })
                .mint({ assets: priceToken })
                .mint({ assets: reimbursementToken })
                .mint({ assets: supplyToken })
                .addSupplyOutput({ supply, token: supplyToken })
                .addPriceOutput({ price, token: priceToken })
                .addPortfolioOutput({ portfolio, token: portfolioToken })
                .addReimbursementOutput({
                    reimbursement,
                    token: reimbursementToken
                })
                .addSigner(INITIAL_AGENT_PARAM)
                .addConfigOutput({ config, token: configToken })
                .addMetadataOutput({ metadata, token: metadataToken })
                .addDummyInput({
                    address: Address.dummy(false),
                    id: props?.seedId ?? SEED_ID_PARAM
                })
        }

        it("fund_policy::main #03 (succeeds if an input is spent with the correct seed id)", () => {
            configureContext().use((ctx) => {
                main.eval({
                    $scriptContext: ctx,
                    args: {
                        Other: {
                            redeemer
                        }
                    }
                })
            })
        })

        it("fund_policy::main #04 (throws an error if no input is spent with the correct seed id, no asset group is minted and supply UTxO isn't spent)", () => {
            configureContext({ seedId: TxOutputId.dummy(12345) }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        args: {
                            Other: {
                                redeemer
                            }
                        }
                    })
                })
            })
        })
    })

    describe("minted an asset group", () => {
        const redeemer = new IntData(0)
        const token = makeAssetsToken(0)

        const configureContext = (props?: {
            portfolioAddress?: Address
            portfolioToken?: Assets
        }) => {
            return new ScriptContextBuilder()
                .addPortfolioInput({
                    address: props?.portfolioAddress,
                    token: props?.portfolioToken
                })
                .mint({ assets: token, redeemer })
        }

        it("fund_policy::main #05 (succeeds if witnessed by spending the portfolio UTxO)", () => {
            configureContext().use((ctx) => {
                main.eval({
                    $scriptContext: ctx,
                    args: {
                        Other: {
                            redeemer
                        }
                    }
                })
            })
        })

        it("fund_policy::main #06 (throws an error if the portfolio UTxO isn't at the portfolio address)", () => {
            configureContext({ portfolioAddress: Address.dummy(false) }).use(
                (ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            args: {
                                Other: {
                                    redeemer
                                }
                            }
                        })
                    })
                }
            )
        })

        it("fund_policy::main #07 (throws an error if the portfolio UTxO doesn't contain the portfolio token)", () => {
            configureContext({ portfolioToken: makeDvpTokens(1) }).use(
                (ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            args: {
                                Other: {
                                    redeemer
                                }
                            }
                        })
                    })
                }
            )
        })
    })

    describe("burn vouchers or reimbursement tokens", () => {
        const redeemer = new IntData(0)

        const configureContext = (props?: {
            assets?: Assets
            assetClass?: AssetClass
        }) => {
            const assetClass = props?.assetClass ?? AssetClasses.voucher_ref(0)
            const assets =
                props?.assets ?? Assets.fromAssetClasses([[assetClass, -1]])

            return new ScriptContextBuilder().mint({ assets, redeemer })
        }

        const defaultTestArgs = {
            args: {
                Other: { redeemer }
            }
        }

        it("fund_policy::main #08 (succeeds when burning voucher ref)", () => {
            configureContext().use((ctx) => {
                main.eval({
                    $scriptContext: ctx,
                    ...defaultTestArgs
                })
            })
        })

        it("fund_policy::main #09 (throws an error when burning voucher user token)", () => {
            configureContext({ assetClass: AssetClasses.voucher_nft(10) }).use(
                (ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        })
                    })
                }
            )
        })

        it("fund_policy::main #10 (succeeds when burning reimbursement token)", () => {
            configureContext({
                assetClass: AssetClasses.reimbursement(10)
            }).use((ctx) => {
                main.eval({
                    $scriptContext: ctx,
                    ...defaultTestArgs
                })
            })
        })

        it("fund_policy::main #11 (succeeds when burning reimbursement token and several voucher ref tokens)", () => {
            configureContext({
                assets: makeReimbursementToken(10, -1).add(
                    makeVoucherRefToken(10, -1)
                        .add(makeVoucherRefToken(11, -1))
                        .add(makeVoucherRefToken(12, -1))
                )
            }).use((ctx) => {
                main.eval({
                    $scriptContext: ctx,
                    ...defaultTestArgs
                })
            })
        })

        it("fund_policy::main #12 (throws an error when minting reimbursement token with the initial cycle id)", () => {
            configureContext({
                assets: makeReimbursementToken(1, 1)
            }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })
                }, /UTxO with SEED_ID not spent/)
            })
        })
    })

    describe("remaining mint/burn", () => {
        const redeemer = new IntData(0)

        const configureContext = (props?: {
            token?: Assets
            supplyAddress?: Address
            supplyToken?: Assets
        }) => {
            const voucherId = 10
            const token =
                props?.token ??
                makeDvpTokens(1000)
                    .add(makeVoucherUserToken(voucherId))
                    .add(makeVoucherRefToken(voucherId))
            return new ScriptContextBuilder()
                .mint({ assets: token, redeemer })
                .addSupplyInput({
                    address: props?.supplyAddress,
                    token: props?.supplyToken
                })
        }

        const defaultTestArgs = {
            args: {
                Other: { redeemer }
            }
        }

        it("fund_policy::main #12 (succeeds if the supply UTxO is spent)", () => {
            configureContext().use((ctx) => {
                main.eval({
                    $scriptContext: ctx,
                    ...defaultTestArgs
                })
            })
        })

        it("fund_policy::main #13 (succeeds if a reimbursement token is minted and no DVP tokens are minted and the supply UTxO is spent)", () => {
            configureContext({ token: makeReimbursementToken(10) }).use(
                (ctx) => {
                    main.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })
                }
            )
        })

        it("fund_policy::main #14 (throws an error if trying to mint a voucher pair without minting DVP tokens)", () => {
            configureContext({ token: makeVoucherPair(10) }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })
                })
            })
        })

        it("fund_policy::main #15 (succeeds when minting a voucher pair together with a reimbursement token (will fail in supply_validator instead))", () => {
            configureContext({
                token: makeVoucherPair(10).add(makeReimbursementToken(10))
            }).use((ctx) => {
                main.eval({
                    $scriptContext: ctx,
                    ...defaultTestArgs
                })
            })
        })

        it("fund_policy::main #16 (throws an error if the supply UTxO doesn't contain the supply token)", () => {
            configureContext({ supplyToken: makeConfigToken() }).use((ctx) => {
                throws(() => {
                    main.eval({
                        $scriptContext: ctx,
                        ...defaultTestArgs
                    })
                })
            })
        })

        it("fund_policy::main #17 (throws an error if the supply UTxO isn't at the supply_validator address)", () => {
            configureContext({ supplyAddress: Address.dummy(false) }).use(
                (ctx) => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            ...defaultTestArgs
                        })
                    })
                }
            )
        })
    })
})

describe("fund_policy metrics", () => {
    const program = contract.fund_policy.$hash.context.program

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
