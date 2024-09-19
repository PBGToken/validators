import { describe, it } from "node:test";
import contract from "pbg-token-validators-test-context";
import { ScriptContextBuilder } from "./tx";
import { IntLike } from "@helios-lang/codec-utils";
import { AssetType, PortfolioType, makeAsset, makePortfolio } from "./data";
import { strictEqual } from "node:assert";

const { validate_add_asset_group } = contract.portfolio_validator

describe("portfolio_validator::validate_add_asset_group", () => {
    const configureContext = (props?: {id?: IntLike, assets?: AssetType[], portfolio0?: PortfolioType}) => {
        return new ScriptContextBuilder()
            .addPortfolioInput({redeemer: {AddOrRemoveAssetGroup: {}}, portfolio: props?.portfolio0 ?? makePortfolio()})
            .addAssetGroupOutput({id: props?.id ?? 1, assets: props?.assets ?? []})
    }

    it("returns true if the tx doesn't have an asset group input and the new asset group is empty", () => {
        const portfolio0 = makePortfolio()
        const portfolio1 = makePortfolio({nGroups: 1})

        configureContext()
            .use(ctx => {
                strictEqual(
                    validate_add_asset_group.eval({
                        $scriptContext: ctx, 
                        portfolio0, 
                        portfolio1,
                        added_id: 1
                    })
                    , true)
            })
        
    })

    it("returns false if n_groups in the portfolio output datum isn't correct", () => {
        const portfolio0 = makePortfolio()
        const portfolio1 = makePortfolio({nGroups: 2})

        configureContext()
            .use(ctx => {
                strictEqual(
                    validate_add_asset_group.eval({
                        $scriptContext: ctx, 
                        portfolio0, 
                        portfolio1,
                        added_id: 1
                    })
                    , false)
            })
    })

    it("returns false if n_groups in the portfolio output datum matches the added_id but not the previous n_groups incremented by 1", () => {
        const portfolio0 = makePortfolio()
        const portfolio1 = makePortfolio({nGroups: 2})

        configureContext({id: 2})
            .use(ctx => {
                strictEqual(
                    validate_add_asset_group.eval({
                        $scriptContext: ctx, 
                        portfolio0, 
                        portfolio1,
                        added_id: 2
                    })
                    , false)
            })
    })

    it("returns false if an asset group UTxO is spent", () => {
        const portfolio0 = makePortfolio()
        const portfolio1 = makePortfolio({nGroups: 1})

        configureContext()
            .addAssetGroupInput()
            .use(ctx => {
                strictEqual(
                    validate_add_asset_group.eval({
                        $scriptContext: ctx, 
                        portfolio0, 
                        portfolio1,
                        added_id: 1
                    })
                    , false)
            })
    })

    it("returns false if the new asset group isn't empty", () => {
        const portfolio0 = makePortfolio()
        const portfolio1 = makePortfolio({nGroups: 1})

        configureContext({assets: [makeAsset()]})
            .use(ctx => {
                strictEqual(
                    validate_add_asset_group.eval({
                        $scriptContext: ctx, 
                        portfolio0, 
                        portfolio1,
                        added_id: 1
                    })
                    , false)
            })
    })
})