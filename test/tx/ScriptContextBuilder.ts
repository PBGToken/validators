import {
    Address,
    Assets,
    ScriptContextV2,
    ScriptPurpose,
    TxInfo,
    TxInput,
    TxOutput,
    TxOutputDatum,
    TxOutputId,
    TxRedeemer,
    Value
} from "@helios-lang/ledger"
import { None } from "@helios-lang/type-utils"
import { ByteArrayData, UplcData } from "@helios-lang/uplc"
import { Addresses } from "../constants"
import {
    AssetPtrType,
    AssetType,
    ConfigType,
    PortfolioActionType,
    PortfolioType,
    PriceType,
    SupplyType,
    castAssetGroup,
    castAssetPtrs,
    castConfig,
    castPortfolio,
    castPortfolioAction,
    castPrice,
    castSupply,
    makeConfig,
    makePortfolio,
    makePrice,
    makeSupply
} from "../data"
import {
    makeAssetsToken,
    makeConfigToken,
    makePortfolioToken,
    makePriceToken,
    makeSupplyToken
} from "../tokens"

export class ScriptContextBuilder {
    tx: TxInfo
    purpose: Option<ScriptPurpose>

    constructor() {
        this.tx = {
            inputs: [],
            outputs: []
        }

        this.purpose = None
    }

    addAssetGroupInput(props?: {
        id?: number
        assets?: AssetType[]
    }): ScriptContextBuilder {
        const assets = props?.assets ?? []
        const value = new Value(2_000_000, makeAssetsToken(props?.id ?? 0))

        this.tx.inputs.push(
            new TxInput(
                TxOutputId.dummy(),
                new TxOutput(
                    Addresses.assetsValidator,
                    value,
                    TxOutputDatum.Inline(castAssetGroup.toUplcData({ assets }))
                )
            )
        )

        return this
    }

    addAssetGroupOutput(props?: {
        id?: number
        assets?: AssetType[]
    }): ScriptContextBuilder {
        const assets = props?.assets ?? []
        const value = new Value(2_000_000, makeAssetsToken(props?.id ?? 0))

        this.tx.outputs.push(
            new TxOutput(
                Addresses.assetsValidator,
                value,
                TxOutputDatum.Inline(castAssetGroup.toUplcData({ assets }))
            )
        )

        return this
    }

    addAssetGroupThread(props?: {
        id?: number
        inputAssets?: AssetType[]
        outputAssets: AssetType[]
    }): ScriptContextBuilder {
        this.addAssetGroupInput({
            id: props?.id,
            assets: props?.inputAssets
        }).addAssetGroupOutput({ id: props?.id, assets: props?.outputAssets })

        return this
    }

    addConfigRef(props?: { config?: ConfigType }): ScriptContextBuilder {
        const config = props?.config ?? makeConfig()
        const value = new Value(2_000_000n, makeConfigToken())

        this.addRefInput(
            new TxInput(
                TxOutputId.dummy(),
                new TxOutput(
                    Addresses.configValidator,
                    value,
                    TxOutputDatum.Inline(castConfig.toUplcData(config))
                )
            )
        )

        return this
    }

    addDummyInput(props?: {
        redeemer?: UplcData
        value?: Value
    }): ScriptContextBuilder {
        const value = props?.value ?? new Value(2_000_000)

        if (props?.redeemer) {
            this.purpose = ScriptPurpose.Spending(
                TxRedeemer.Spending(this.tx.inputs.length, props.redeemer),
                TxOutputId.dummy()
            )
        }

        this.tx.inputs.push(
            new TxInput(
                TxOutputId.dummy(),
                new TxOutput(Address.dummy(false), value)
            )
        )

        return this
    }

    addDummyInputs(n: number): ScriptContextBuilder {
        for (let i = 0; i < n; i++) {
            this.tx.inputs.push(
                new TxInput(
                    TxOutputId.dummy(),
                    new TxOutput(Address.dummy(false), new Value(2_000_000))
                )
            )
        }

        return this
    }

    addDummyOutputs(n: number): ScriptContextBuilder {
        for (let i = 0; i < n; i++) {
            this.tx.outputs.push(
                new TxOutput(Address.dummy(false), new Value(2_000_000))
            )
        }

        return this
    }

    addPortfolioInput(props?: {
        address?: Address
        portfolio?: PortfolioType
        redeemer?: PortfolioActionType
        token?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.portfolioValidator
        const portfolio = props?.portfolio ?? makePortfolio()
        const token = props?.token ?? makePortfolioToken()

        if (props?.redeemer) {
            this.purpose = ScriptPurpose.Spending(
                TxRedeemer.Spending(
                    this.tx.inputs.length,
                    castPortfolioAction.toUplcData(props.redeemer)
                ),
                TxOutputId.dummy()
            )
        }

        this.tx.inputs.push(
            new TxInput(
                TxOutputId.dummy(),
                new TxOutput(
                    address,
                    new Value(2_000_000, token),
                    TxOutputDatum.Inline(castPortfolio.toUplcData(portfolio))
                )
            )
        )

        return this
    }

    addPortfolioOutput(props?: {
        address?: Address
        portfolio?: PortfolioType
        token?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.portfolioValidator
        const portfolio = props?.portfolio ?? makePortfolio()
        const token = props?.token ?? makePortfolioToken()

        this.tx.outputs.push(
            new TxOutput(
                address,
                new Value(2_000_000, token),
                TxOutputDatum.Inline(castPortfolio.toUplcData(portfolio))
            )
        )

        return this
    }

    addPortfolioRef(props?: {address?: Address, portfolio?: PortfolioType, token?: Assets}): ScriptContextBuilder {
        const address = props?.address ?? Addresses.portfolioValidator
        const portfolio = props?.portfolio ?? makePortfolio()
        const token = props?.token ?? makePortfolioToken()

        this.addRefInput(new TxInput(
            TxOutputId.dummy(),
            new TxOutput(
                address,
                new Value(2_000_000, token),
                TxOutputDatum.Inline(castPortfolio.toUplcData(portfolio))
            )
        ))
        
        return this
    }

    addPriceInput(props?: {
        price?: PriceType
        redeemer?: UplcData
    }): ScriptContextBuilder {
        const price = props?.price ?? makePrice()

        if (props?.redeemer) {
            this.purpose = ScriptPurpose.Spending(
                TxRedeemer.Spending(this.tx.inputs.length, props.redeemer),
                TxOutputId.dummy()
            )
        }

        this.tx.inputs.push(
            new TxInput(
                TxOutputId.dummy(),
                new TxOutput(
                    Addresses.priceValidator,
                    new Value(2_000_000, makePriceToken()),
                    TxOutputDatum.Inline(castPrice.toUplcData(price))
                )
            )
        )

        return this
    }

    addPriceOutput(props?: { price?: PriceType }): ScriptContextBuilder {
        const price = props?.price ?? makePrice()

        this.tx.outputs.push(
            new TxOutput(
                Addresses.priceValidator,
                new Value(2_000_000, makePriceToken()),
                TxOutputDatum.Inline(castPrice.toUplcData(price))
            )
        )

        return this
    }

    addRefInput(input: TxInput): ScriptContextBuilder {
        if (this.tx.refInputs) {
            this.tx.refInputs.push(input)
        } else {
            this.tx.refInputs = [input]
        }

        return this
    }

    addSupplyInput(props?: {
        address?: Address
        redeemer?: AssetPtrType[]
        supply?: SupplyType
        tokens?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.supplyValidator
        const supply = props?.supply ?? makeSupply()
        const supplyToken = props?.tokens ?? makeSupplyToken()
        const value = new Value(2_000_000n, supplyToken)

        if (props?.redeemer) {
            this.purpose = ScriptPurpose.Spending(
                TxRedeemer.Spending(
                    this.tx.inputs.length,
                    castAssetPtrs.toUplcData(props.redeemer)
                ),
                TxOutputId.dummy()
            )
        }

        this.tx.inputs.push(
            new TxInput(
                TxOutputId.dummy(),
                new TxOutput(
                    address,
                    value,
                    TxOutputDatum.Inline(castSupply.toUplcData(supply))
                )
            )
        )

        return this
    }

    addSupplyOutput(props?: {
        address?: Address
        supply?: SupplyType
        token?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.supplyValidator
        const supply = props?.supply ?? makeSupply()
        const supplyToken = props?.token ?? makeSupplyToken()
        const value = new Value(2_000_000n, supplyToken)

        this.tx.outputs.push(
            new TxOutput(
                address,
                value,
                TxOutputDatum.Inline(castSupply.toUplcData(supply))
            )
        )

        return this
    }

    addSupplyRef(
        props?: {
            address?: Address
            supply?: SupplyType
            token?: Assets
        },
        add: boolean = true
    ): ScriptContextBuilder {
        if (!add) {
            return this
        }

        const address = props?.address ?? Addresses.supplyValidator
        const supply = props?.supply ?? makeSupply()
        const token = props?.token ?? makeSupplyToken()

        this.addRefInput(
            new TxInput(
                TxOutputId.dummy(),
                new TxOutput(
                    address,
                    new Value(2_000_000, token),
                    TxOutputDatum.Inline(castSupply.toUplcData(supply))
                )
            )
        )

        return this
    }

    addSupplyThread(props?: {
        inputAddress?: Address
        outputAddress?: Address
        redeemer?: AssetPtrType[]
        supply?: SupplyType
        token?: Assets
    }): ScriptContextBuilder {
        this.addSupplyInput({
            address: props?.inputAddress,
            redeemer: props?.redeemer,
            supply: props?.supply,
            tokens: props?.token
        }).addSupplyOutput({
            address: props?.outputAddress,
            supply: props?.supply,
            token: props?.token
        })

        return this
    }

    mint(props?: { assets?: Assets }): ScriptContextBuilder {
        const prev = this.tx.minted ?? new Assets()

        if (props?.assets) {
            this.tx.minted = prev.add(props.assets)
        }

        return this
    }

    sendToVault(props?: {
        datum?: UplcData
        value?: Value
    }): ScriptContextBuilder {
        const datum = props?.datum ?? new ByteArrayData([])
        const value = props?.value ?? new Value(2_000_000)

        this.tx.outputs.push(
            new TxOutput(Addresses.vault, value, TxOutputDatum.Inline(datum))
        )

        return this
    }

    takeFromVault(props?: {
        datum?: UplcData
        redeemer?: UplcData
        value?: Value
    }): ScriptContextBuilder {
        const datum = props?.datum ?? new ByteArrayData([])
        const value = props?.value ?? new Value(2_000_000)

        if (props?.redeemer) {
            this.purpose = ScriptPurpose.Spending(
                TxRedeemer.Spending(this.tx.inputs.length, props.redeemer),
                TxOutputId.dummy()
            )
        }

        this.tx.inputs.push(
            new TxInput(
                TxOutputId.dummy(),
                new TxOutput(
                    Addresses.vault,
                    value,
                    TxOutputDatum.Inline(datum)
                )
            )
        )

        return this
    }

    build(): UplcData {
        if (this.purpose) {
            const ctx = new ScriptContextV2(this.tx, this.purpose)

            return ctx.toUplcData()
        } else {
            throw new Error("ScriptContextBuilder purpose not yet set")
        }
    }
}
