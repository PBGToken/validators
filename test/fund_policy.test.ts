import { deepEqual, strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import contract, {
    SEED_ID as SEED_ID_PARAM,
    INITIAL_AGENT as INITIAL_AGENT_PARAM
} from "pbg-token-validators-test-context"
import { RatioType, SuccessFeeType, castMetadata, makeAssetGroup, makeConfig, makeMetadata, makePortfolio, makePrice, makeSuccessFee, makeSupply } from "./data"
import { ScriptContextBuilder } from "./tx"
import {
    makeAssetsToken,
    makeConfigToken,
    makeDvpTokens,
    makeMetadataToken,
    makePortfolioToken,
    makePriceToken,
    makeSupplyToken,
    makeVoucherRefToken,
    makeVoucherUserToken
} from "./tokens"
import { Address, Assets, PubKeyHash, TxOutputId, Value } from "@helios-lang/ledger"
import { ByteArrayData, IntData } from "@helios-lang/uplc"

const {
    SEED_ID,
    INITIAL_AGENT,
    INITIAL_TICK,
    INITIAL_SUCCESS_FEE,
    validate_minted_tokens,
    validate_initial_metadata,
    validate_initial_config,
    validate_initial_portfolio,
    validate_initial_price,
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

function makeInitialMetadata(props?: {logo?: string}) {
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
    const configureContext = (props?: {logo?: string, token?: Assets}) => {
        const metadata = makeInitialMetadata({logo: props?.logo})

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

function makeInitialConfig(props?: {relMintFee?: number, successFee?: SuccessFeeType}) {
    const successFee = props?.successFee ?? makeSuccessFee({
        c0: 0,
        steps: [
            {c: 0.3, sigma: 1.05}
        ]
    })

    return makeConfig({
        agent: INITIAL_AGENT_PARAM,
        mintFee: {
            relative: props?.relMintFee ?? 0.005,
            minimum: 20_000,
        },
        burnFee: {
            relative: 0.005,
            minimum: 20_000
        },
        managementFeePeriod: 24*60*60*1000,
        relManagementFee: 0.00011,
        successFee,
        token: {
            maxSupply: 100_000_000_000,
            maxPriceAge: 24*60*60*1000
        },
        governance: {
            updateDelay: 2*7*24*60*60*1000
        }
    })
}

describe("fund_policy::validate_initial_config", () => {
    const configureContext = (props?: {relMintFee?: number, signingAgent?: PubKeyHash, successFee?: SuccessFeeType, token?: Assets}) => {
        const config = makeInitialConfig({relMintFee: props?.relMintFee, successFee: props?.successFee})
       
        return new ScriptContextBuilder()
            .addSigner(props?.signingAgent ?? INITIAL_AGENT_PARAM)
            .addConfigOutput({config, token: props?.token})
    }

    it("returns true if config data is correct", () => {
        configureContext()
            .use(ctx => {
                strictEqual(validate_initial_config.eval({$scriptContext: ctx}), true)
            })
    })

    it("returns false if the tx isn't signed by the agent", () => {
        configureContext({signingAgent: PubKeyHash.dummy(6)})
            .use(ctx => {
                strictEqual(validate_initial_config.eval({$scriptContext: ctx}), false)
            })
    })

    it("returns false if the success fee parameters are invalid", () => {
        configureContext({successFee: makeSuccessFee({c0: -0.1, steps: []})})
            .use(ctx => {
                strictEqual(validate_initial_config.eval({$scriptContext: ctx}), false)
            })
    })

    it("returns false if the config data is wrong", () => {
        configureContext({relMintFee: 0.004})
            .use(ctx => {
                strictEqual(validate_initial_config.eval({$scriptContext: ctx}), false)
            })
    })

    it("throws an error if the config UTxO doesn't contain the config token", () => {
        configureContext({token: makeDvpTokens(1)})
            .use(ctx => {
                throws(() => {
                    validate_initial_config.eval({$scriptContext: ctx})
                })
            })
    })
})

function makeInitialPortfolio(props?: {nGroups?: number}) {
    return makePortfolio({
        nGroups: props?.nGroups ?? 0,
        state: {
            Idle: {}
        }
    })
}

describe("fund_policy::validate_initial_portfolio", () => {
    const configureContext = (props?: {nGroups?: number, token?: Assets}) => {
        const portfolio = makeInitialPortfolio({nGroups: props?.nGroups})

        return new ScriptContextBuilder()
            .addPortfolioOutput({portfolio, token: props?.token})
    }

    it("returns true if the portfolioe output datum is correct", () => {
        configureContext()
            .use(ctx => {
                strictEqual(validate_initial_portfolio.eval({$scriptContext: ctx}), true)
            })
    })

    it("returns false of the portfolio output datum isn't correct", () => {
        configureContext({nGroups: 1})
            .use(ctx => {
                strictEqual(validate_initial_portfolio.eval({$scriptContext: ctx}), false)
            })
    })

    it("throws an error of the portfolio UTxO doesn't contain the portfolio token", () => {
        configureContext({token: makeDvpTokens(1)})
            .use(ctx => {
                throws(() => {
                    validate_initial_portfolio.eval({$scriptContext: ctx})
                })
            })
    })
})

function makeInitialPrice(props?: {ratio?: RatioType, timestamp?: number}) {
    return makePrice({
        ratio: props?.ratio ?? [100, 1],
        timestamp: props?.timestamp ?? 0
    })
}

describe("func_policy::validate_initial_price", () => {
    const configureContext = (props?: {ratio?: RatioType, timestamp?: number, token?: Assets}) => {
        const price = makeInitialPrice({ratio: props?.ratio, timestamp: props?.timestamp})
            
        return new ScriptContextBuilder()
            .addPriceOutput({price, token: props?.token})
    }

    it("returns true if the price output datum is correct", () => {
        configureContext()
            .use(ctx => {
                strictEqual(validate_initial_price.eval({$scriptContext: ctx}), true)
            })
    })

    it("throws an error if the price UTxO doesn't contain the price token", () => {
        configureContext({token: makeDvpTokens(1)})
            .use(ctx => {
                throws(() => {
                    validate_initial_price.eval({$scriptContext: ctx})
                })
            })
    })

    it("returns false if the price timestamp is wrong", () => {
        configureContext({timestamp: 1})
            .use(ctx => {
                strictEqual(validate_initial_price.eval({$scriptContext: ctx}), false)
            })
    })

    it("returns false if the price ratio is wrong", () => {
        configureContext({ratio: [1000, 10]})
            .use(ctx => {
                strictEqual(validate_initial_price.eval({$scriptContext: ctx}), false)
            })
    })
})

function makeInitialSupply(props?: {initialTick?: number}) {
    return makeSupply({
        tick: props?.initialTick ?? 0,
        nTokens: 0,
        nVouchers: 0,
        lastVoucherId: 0,
        nLovelace: 0,
        managementFeeTimestamp: 0,
        successFee: {
            periodId: 0,
            start_time: 0,
            period: 2*7*24*60*60*1000
        },
        startPrice: [100, 1]
    })
}

describe("fund_policy::validate_initial_supply", () => {
    const configureContext = (props?: {initialTick?: number, token?: Assets}) => {
        const supply =  makeInitialSupply({initialTick: props?.initialTick})

        return new ScriptContextBuilder()
            .addSupplyOutput({supply, token: props?.token})
    }

    it("returns true if the supply output datum is correct", () => {
        configureContext()
            .use(ctx => {
                validate_initial_supply.eval({$scriptContext: ctx})
        })
    })

    it("throws an error if the supply UTxO doesn't contain the supply token", () => {
        configureContext({token: makeDvpTokens(1)})
            .use(ctx => {
                throws(() => {
                    validate_initial_supply.eval({$scriptContext: ctx})
                })
            })
    })

    it("returns false if the initial tick isn't zero", () => {
        configureContext({initialTick: 1})
            .use(ctx => {
                strictEqual(validate_initial_supply.eval({$scriptContext: ctx}), false)
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
    }) => {
        const metadata = makeInitialMetadata({logo: props?.metadataLogo})
        const config = makeInitialConfig({relMintFee: props?.relMintFee})
        const portfolio = makeInitialPortfolio({nGroups: props?.nGroups})
        const price = makeInitialPrice({timestamp: props?.priceTimestamp})
        const supply = makeInitialSupply({initialTick: props?.initialTick})

        const metadataToken = makeMetadataToken(1)
        const configToken = makeConfigToken(1)
        const portfolioToken = makePortfolioToken(1)
        const priceToken = makePriceToken(1)
        const supplyToken = makeSupplyToken(1)

        return new ScriptContextBuilder()
            .mint({ assets: metadataToken })
            .mint({ assets: configToken })
            .mint({ assets: portfolioToken })
            .mint({ assets: priceToken })
            .mint({ assets: supplyToken })
            .addSupplyOutput({supply, token: supplyToken})
            .addPriceOutput({price, token: priceToken})
            .addPortfolioOutput({portfolio, token: portfolioToken })
            .addSigner(INITIAL_AGENT_PARAM)
            .addConfigOutput({config, token: configToken })
            .addMetadataOutput({metadata, token: metadataToken})
    }

    it("returns true if all UTxO are correctly initialized and contain the correct tokens", () => {
        configureContext()
            .use(ctx => {
                strictEqual(validate_initialization.eval({$scriptContext: ctx}), true)
            })
    })

    it("returns false if the metadata contains a mistake", () => {
        configureContext({metadataLogo: "asd"})
            .use(ctx => {
                strictEqual(validate_initialization.eval({$scriptContext: ctx}), false)
            })
    })

    it("returns false if the config data contains a mistake", () => {
        configureContext({relMintFee: 0})
            .use(ctx => {
                strictEqual(validate_initialization.eval({$scriptContext: ctx}), false)
            })
    })

    it("returns false of the portfolio data contains a mistake", () => {
        configureContext({nGroups: -1})
            .use(ctx => {
                strictEqual(validate_initialization.eval({$scriptContext: ctx}), false)
            })
    })

    it("returns false if the price data contains a mistake", () => {
        configureContext({priceTimestamp: -1})
            .use(ctx => {
                strictEqual(validate_initialization.eval({$scriptContext: ctx}), false)
            })
    })

    it("returns false if the supply data contains a mistake", () => {
        configureContext({initialTick: -1})
            .use(ctx => {
                strictEqual(validate_initialization.eval({$scriptContext: ctx}), false)
            })
    })
})

describe("fund_policy::validate_vault_spending", () => {
    const configureContext = (props?: {address?: Address, refer?: boolean, token?: Assets}) => {
        const scb = new ScriptContextBuilder()

        if (props?.refer) {
            scb.addSupplyRef({address: props?.address, token: props?.token})
        } else {
            scb.addSupplyInput({address: props?.address, token: props?.token})
        }
            
        return scb
    }

    it("returns true if the tx is witnessed by spending the supply UTxO", () => {
        configureContext()
            .use(ctx => {
                strictEqual(validate_vault_spending.eval({$scriptContext: ctx}), true)
            })
    })

    it("throws an error if the supply UTxO doesn't contain the supply token", () => {
        configureContext({token: makeDvpTokens(1)})
            .use(ctx => {
                throws(() => {
                    validate_vault_spending.eval({$scriptContext: ctx})
                })
            })
    })

    it("returns false if the supply UTxO isn't at the supply_validator address", () => {
        configureContext({address: Address.dummy(false)})
            .use(ctx => {
                strictEqual(validate_vault_spending.eval({$scriptContext: ctx}), false)
            })
    })

    it("returns false if the supply UTxO is referenced instead of spent", () => {
        configureContext({refer: true})
            .use(ctx => {
                strictEqual(validate_vault_spending.eval({$scriptContext: ctx}), false)
            })
    })
})

describe("fund_policy::validate_mint_or_burn_asset_groups", () => {
    const configureContext = (props?: {address?: Address, refer?: boolean, token?: Assets}) => {
        const scb = new ScriptContextBuilder()

        if (props?.refer) {
            scb.addPortfolioRef({address: props?.address, token: props?.token})
        } else {
            scb.addPortfolioInput({address: props?.address, token: props?.token})
        }

        return scb
    }

    it("returns true if the tx is witnessed by spending the portfolio UTxO", () => {
        configureContext()
            .use(ctx => {
                strictEqual(validate_mint_or_burn_asset_groups.eval({$scriptContext: ctx}), true)
            })
    })

    it("throws an error if the supply UTxO doesn't contain the portfolio token", () => {
        configureContext({token: makeDvpTokens(1)})
            .use(ctx => {
                throws(() => {
                    validate_mint_or_burn_asset_groups.eval({$scriptContext: ctx})
                })
            })
    })

    it("returns false if the portfolio UTxO isn't at the portfolio_validator address", () => {
        configureContext({address: Address.dummy(false)})
            .use(ctx => {
                strictEqual(validate_mint_or_burn_asset_groups.eval({$scriptContext: ctx}), false)
            })
    })

    it("returns false if the portfolio UTxO is referenced instead of spent", () => {
        configureContext({refer: true})
            .use(ctx => {
                strictEqual(validate_mint_or_burn_asset_groups.eval({$scriptContext: ctx}), false)
            })
    })
})

describe("fund_policy::validate_mint_or_burn_dvp_tokens_vouchers_or_reimbursement", () => {
    const configureContext = (props?: {address?: Address, refer?: boolean, token?: Assets}) => {
        const scb = new ScriptContextBuilder()

        if (props?.refer) {
            scb.addSupplyRef({address: props?.address, token: props?.token})
        } else {
            scb.addSupplyInput({address: props?.address, token: props?.token})
        }
            
        return scb
    }

    it("returns true if the tx is witnessed by spending the supply UTxO", () => {
        configureContext()
            .use(ctx => {
                strictEqual(validate_mint_or_burn_dvp_tokens_vouchers_or_reimbursement.eval({$scriptContext: ctx}), true)
            })
    })

    it("throws an error if the supply UTxO doesn't contain the supply token", () => {
        configureContext({token: makeDvpTokens(1)})
            .use(ctx => {
                throws(() => {
                    validate_mint_or_burn_dvp_tokens_vouchers_or_reimbursement.eval({$scriptContext: ctx})
                })
            })
    })

    it("returns false if the supply UTxO isn't at the supply_validator address", () => {
        configureContext({address: Address.dummy(false)})
            .use(ctx => {
                strictEqual(validate_mint_or_burn_dvp_tokens_vouchers_or_reimbursement.eval({$scriptContext: ctx}), false)
            })
    })

    it("returns false if the supply UTxO is referenced instead of spent", () => {
        configureContext({refer: true})
            .use(ctx => {
                strictEqual(validate_mint_or_burn_dvp_tokens_vouchers_or_reimbursement.eval({$scriptContext: ctx}), false)
            })
    })
})

describe("fund_policy::main", () => {
    describe("spending from vault", () => {
        const configureContext = (props?: {address?: Address}) => {
            return new ScriptContextBuilder()
                .addSupplyInput()
                .takeFromVault({address: props?.address, redeemer: new IntData(0), value: new Value(2_000_000)})
        }

        it("succeeds if called for spending and witnessed by supply_validator", () => {
            configureContext()
                .use(ctx => {
                    main.eval({
                        $scriptContext: ctx,
                        $datum: new ByteArrayData([]),
                        args: {Spending: {
                            redeemer: new IntData(0)
                        }}
                    })
                })
        })

        it("throws an error if the currently spent input isn't from a validator address (unable to get own hash)", () => {
            configureContext({address: Address.dummy(false)})
                .use(ctx => {
                    throws(() => {
                        main.eval({
                            $scriptContext: ctx,
                            $datum: new ByteArrayData([]),
                            args: {Spending: {
                                redeemer: new IntData(0)
                            }}
                        })
                    })
                })
        })
    })

    describe("initializing", () => {
        const redeemer = new IntData(0)

        const configureContext = (props?: {seedId?: TxOutputId}) => {    
            const metadata = makeInitialMetadata()
            const config = makeInitialConfig()
            const portfolio = makeInitialPortfolio()
            const price = makeInitialPrice()
            const supply = makeInitialSupply()

            const metadataToken = makeMetadataToken(1)
            const configToken = makeConfigToken(1)
            const portfolioToken = makePortfolioToken(1)
            const priceToken = makePriceToken(1)
            const supplyToken = makeSupplyToken(1)

            return new ScriptContextBuilder()
                .mint({ assets: metadataToken, redeemer })
                .mint({ assets: configToken })
                .mint({ assets: portfolioToken })
                .mint({ assets: priceToken })
                .mint({ assets: supplyToken })
                .addSupplyOutput({supply, token: supplyToken})
                .addPriceOutput({price, token: priceToken})
                .addPortfolioOutput({portfolio, token: portfolioToken })
                .addSigner(INITIAL_AGENT_PARAM)
                .addConfigOutput({config, token: configToken })
                .addMetadataOutput({metadata, token: metadataToken})
                .addDummyInput({address: Address.dummy(false), id: props?.seedId ?? SEED_ID_PARAM})
        }

        it("succeeds if an input is spent with the correct seed id", () => {
            configureContext()
                .use(ctx => {
                    main.eval({$scriptContext: ctx, args: {
                        Other: {
                            redeemer
                        }
                    }})
                })
        })

        it("throws an error if no input is spent with the correct seed id, no asset group is minted and supply UTxO isn't spent", () => {
            configureContext({seedId: TxOutputId.dummy(12345)})
                .use(ctx => {
                    throws(() => {
                        main.eval({$scriptContext: ctx, args: {
                            Other: {
                                redeemer
                            }
                        }})
                    })
                })
        })
    })

    describe("minted an asset group", () => {
        const redeemer = new IntData(0)
        const token = makeAssetsToken(0)

        const configureContext = (props?: {portfolioAddress?: Address, portfolioToken?: Assets}) => {
            return new ScriptContextBuilder()
                .addPortfolioInput({address: props?.portfolioAddress, token: props?.portfolioToken})
                .mint({assets: token, redeemer})
        }

        it("succeeds if witnessed by spending the portfolio UTxO", () => {
            configureContext()
                .use(ctx => {
                    main.eval({$scriptContext: ctx, args: {
                        Other: {
                            redeemer
                        }
                    }})
                })
        })

        it("throws an error if the portfolio UTxO isn't at the portfolio address", () => {
            configureContext({portfolioAddress: Address.dummy(false)})
                .use(ctx => {
                    throws(() => {
                        main.eval({$scriptContext: ctx, args: {
                            Other: {
                                redeemer
                            }
                        }})
                    })
                })
        })

        it("throws an error if the portfolio UTxO doesn't contain the portfolio token", () => {
            configureContext({portfolioToken: makeDvpTokens(1)})
            .use(ctx => {
                throws(() => {
                    main.eval({$scriptContext: ctx, args: {
                        Other: {
                            redeemer
                        }
                    }})
                })
            })
        })  
    })

    describe("remaining mint/burn", () => {
        const redeemer = new IntData(0)

        const configureContext = (props?: {supplyAddress?: Address, supplyToken?: Assets}) => {
            const voucherId = 10
            const token = makeDvpTokens(1000).add(makeVoucherUserToken(voucherId)).add(makeVoucherRefToken(voucherId))
            return new ScriptContextBuilder()
                .mint({assets: token, redeemer})
                .addSupplyInput({address: props?.supplyAddress, token: props?.supplyToken})
        }

        it("succeeds if the supply UTxO is spent", () => {
            configureContext()
                .use(ctx => {
                    main.eval({$scriptContext: ctx, args: {
                        Other: {redeemer}
                    }})
                })
        })

        it("throws an error if the supply UTxO doesn't contain the supply token", () => {
            configureContext({supplyToken: makeConfigToken()})
                .use(ctx => {
                    throws(() => {
                        main.eval({$scriptContext: ctx, args: {
                            Other: {redeemer}
                        }})
                    })
                })
        })

        it("throws an error if the supply UTxO isn't at the supply_validator address", () => {
            configureContext({supplyAddress: Address.dummy(false)})
                .use(ctx => {
                    throws(() => {
                        main.eval({$scriptContext: ctx, args: {
                            Other: {redeemer}
                        }})
                    })
                })
        })
    })
   
})