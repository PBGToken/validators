import { IntLike } from "@helios-lang/codec-utils"
import { generateBytes, rand } from "@helios-lang/crypto"
import {
    Address,
    Assets,
    PubKeyHash,
    ScriptContextV2,
    ScriptPurpose,
    StakingAddress,
    StakingValidatorHash,
    TimeRange,
    TxInfo,
    TxInput,
    TxOutput,
    TxOutputDatum,
    TxOutputId,
    TxRedeemer,
    Value
} from "@helios-lang/ledger"
import { None, expectSome } from "@helios-lang/type-utils"
import { ByteArrayData, IntData, UplcData } from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"
import { Addresses, policy } from "../constants"
import {
    AssetGroupAction,
    AssetPtrType,
    AssetType,
    BurnOrderRedeemerType,
    BurnOrderType,
    ConfigType,
    MetadataType,
    MintOrderRedeemerType,
    MintOrderType,
    PortfolioActionType,
    PortfolioType,
    PriceType,
    RatioType,
    SupplyType,
    VoucherType,
    castAssetGroup,
    castAssetGroupAction,
    castAssetPtrs,
    castBurnOrder,
    castBurnOrderRedeemer,
    castConfig,
    castMetadata,
    castMintOrder,
    castMintOrderRedeemer,
    castPortfolio,
    castPortfolioAction,
    castPrice,
    castRatio,
    castSupply,
    castVoucher,
    makeBurnOrder,
    makeConfig,
    makeMetadata,
    makeMintOrder,
    makePortfolio,
    makePrice,
    makeSupply,
    makeVoucher
} from "../data"
import {
    makeAssetsToken,
    makeConfigToken,
    makeDvpTokens,
    makeMetadataToken,
    makePortfolioToken,
    makePriceToken,
    makeSupplyToken,
    makeVoucherRefToken
} from "../tokens"

export class ScriptContextBuilder {
    private dummyIdCount: number
    tx: TxInfo
    purpose: Option<ScriptPurpose>

    constructor() {
        this.dummyIdCount = 0
        this.tx = {
            inputs: [],
            outputs: []
        }

        this.purpose = None
    }

    /**
     * The TxOutputId of each input and refInput must be unique (builtin functions like get_current_input() rely on that)
     */
    private newInputId(): TxOutputId {
        return TxOutputId.dummy(this.dummyIdCount++)
    }

    addAssetGroupInput(props?: {
        address?: Address
        assets?: AssetType[]
        id?: IntLike
        redeemer?: AssetGroupAction
        token?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.assetsValidator
        const assets = props?.assets ?? []
        const token = props?.token ?? makeAssetsToken(Number(props?.id ?? 0))
        const value = new Value(2_000_000, token)
        const id = this.newInputId()

        if (props?.redeemer) {
            this.purpose = ScriptPurpose.Spending(
                TxRedeemer.Spending(
                    this.tx.inputs.length,
                    castAssetGroupAction.toUplcData(props.redeemer)
                ),
                id
            )
        }

        this.tx.inputs.push(
            new TxInput(
                id,
                new TxOutput(
                    address,
                    value,
                    TxOutputDatum.Inline(castAssetGroup.toUplcData({ assets }))
                )
            )
        )

        return this
    }

    addAssetGroupRef(props?: {
        address?: Address
        assets?: AssetType[]
        id?: IntLike
        token?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.assetsValidator
        const assets = props?.assets ?? []
        const token = props?.token ?? makeAssetsToken(Number(props?.id ?? 0))
        const value = new Value(2_000_000, token)
        const id = this.newInputId()

        this.addRefInput(
            new TxInput(
                id,
                new TxOutput(
                    address,
                    value,
                    TxOutputDatum.Inline(castAssetGroup.toUplcData({ assets }))
                )
            )
        )

        return this
    }

    addAssetGroupOutput(props?: {
        address?: Address
        assets?: AssetType[]
        id?: IntLike
        token?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.assetsValidator
        const assets = props?.assets ?? []
        const token = props?.token ?? makeAssetsToken(Number(props?.id ?? 0))
        const value = new Value(2_000_000, token)

        this.tx.outputs.push(
            new TxOutput(
                address,
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
        redeemer?: AssetGroupAction
    }): ScriptContextBuilder {
        this.addAssetGroupInput({
            assets: props?.inputAssets,
            id: props?.id,
            redeemer: props?.redeemer
        }).addAssetGroupOutput({ id: props?.id, assets: props?.outputAssets })

        return this
    }

    addBurnOrderInput(props?: {
        address?: Address
        datum?: BurnOrderType
        redeemer?: BurnOrderRedeemerType
        value?: Value
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.burnOrderValidator
        const datum = props?.datum ?? makeBurnOrder()
        const value = props?.value ?? new Value(2_000_000)
        const id = this.newInputId()

        if (props?.redeemer) {
            this.purpose = ScriptPurpose.Spending(
                TxRedeemer.Spending(
                    this.tx.inputs.length,
                    castBurnOrderRedeemer.toUplcData(props.redeemer)
                ),
                id
            )
        }

        this.tx.inputs.push(
            new TxInput(
                id,
                new TxOutput(
                    address,
                    value,
                    TxOutputDatum.Inline(castBurnOrder.toUplcData(datum))
                )
            )
        )

        return this
    }

    addBurnOrderReturn(props?: {
        address?: Address
        datum?: UplcData
        value?: Value
    }): ScriptContextBuilder {
        const address = props?.address ?? Address.dummy(false)
        const datum = props?.datum ?? new IntData(0)
        const value = props?.value ?? new Value(2_000_000)

        return this.addOutput(
            new TxOutput(address, value, TxOutputDatum.Inline(datum))
        )
    }

    addConfigInput(props?: {
        address?: Address
        config?: ConfigType
        redeemer?: UplcData
        token?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.configValidator
        const config = props?.config ?? makeConfig()
        const token = props?.token ?? makeConfigToken()
        const id = this.newInputId()

        if (props?.redeemer) {
            this.purpose = ScriptPurpose.Spending(
                TxRedeemer.Spending(this.tx.inputs.length, props.redeemer),
                id
            )
        }

        this.tx.inputs.push(
            new TxInput(
                id,
                new TxOutput(
                    address,
                    new Value(2_000_000, token),
                    TxOutputDatum.Inline(castConfig.toUplcData(config))
                )
            )
        )

        return this
    }

    addConfigOutput(props?: {
        address?: Address
        config?: ConfigType
        token?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.configValidator
        const config = props?.config ?? makeConfig()
        const token = props?.token ?? makeConfigToken()

        return this.addOutput(
            new TxOutput(
                address,
                new Value(2_000_000, token),
                TxOutputDatum.Inline(castConfig.toUplcData(config))
            )
        )
    }

    addConfigRef(props?: {
        address?: Address
        config?: ConfigType
        token?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.configValidator
        const config = props?.config ?? makeConfig()
        const token = props?.token ?? makeConfigToken()
        const id = this.newInputId()
        const value = new Value(2_000_000n, token)

        this.addRefInput(
            new TxInput(
                id,
                new TxOutput(
                    address,
                    value,
                    TxOutputDatum.Inline(castConfig.toUplcData(config))
                )
            )
        )

        return this
    }

    addConfigThread(props?: {
        config?: ConfigType
        redeemer?: UplcData
    }): ScriptContextBuilder {
        return this.addConfigInput({
            config: props?.config,
            redeemer: props?.redeemer
        }).addConfigOutput({
            config: props?.config
        })
    }

    addDummyInput(props?: {
        address?: Address
        redeemer?: UplcData
        value?: Value
    }): ScriptContextBuilder {
        const address = props?.address ?? Address.dummy(false)
        const id = this.newInputId()
        const value = props?.value ?? new Value(2_000_000)

        if (props?.redeemer) {
            this.purpose = ScriptPurpose.Spending(
                TxRedeemer.Spending(this.tx.inputs.length, props.redeemer),
                id
            )
        }

        this.tx.inputs.push(new TxInput(id, new TxOutput(address, value)))

        return this
    }

    addDummyInputs(n: number): ScriptContextBuilder {
        for (let i = 0; i < n; i++) {
            this.addDummyInput()
        }

        return this
    }

    addDummyOutput(props?: { address?: Address }): ScriptContextBuilder {
        const address = props?.address ?? Address.dummy(false)

        this.tx.outputs.push(new TxOutput(address, new Value(2_000_000)))

        return this
    }

    addDummyOutputs(n: number): ScriptContextBuilder {
        for (let i = 0; i < n; i++) {
            this.addDummyOutput()
        }

        return this
    }

    addDummyRef(props?: {
        address?: Address
        value?: Value
    }): ScriptContextBuilder {
        const address = props?.address ?? Address.dummy(false)
        const id = this.newInputId()
        const value = props?.value ?? new Value(2_000_000)

        this.addRefInput(new TxInput(id, new TxOutput(address, value)))

        return this
    }

    addDummyRefs(n: number): ScriptContextBuilder {
        for (let i = 0; i < n; i++) {
            this.addDummyRef()
        }

        return this
    }

    addMetadataInput(props?: {
        address?: Address
        metadata?: MetadataType
        redeemer?: UplcData
        token?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.metadataValidator
        const metadata = props?.metadata ?? makeMetadata()
        const token = props?.token ?? makeMetadataToken()
        const id = this.newInputId()

        if (props?.redeemer) {
            this.purpose = ScriptPurpose.Spending(
                TxRedeemer.Spending(this.tx.inputs.length, props.redeemer),
                id
            )
        }

        this.tx.inputs.push(
            new TxInput(
                id,
                new TxOutput(
                    address,
                    new Value(2_000_000, token),
                    TxOutputDatum.Inline(castMetadata.toUplcData(metadata))
                )
            )
        )

        return this
    }

    addMetadataOutput(props?: {
        address?: Address
        metadata?: MetadataType
        token?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.metadataValidator
        const metadata = props?.metadata ?? makeMetadata()
        const token = props?.token ?? makeMetadataToken()

        return this.addOutput(
            new TxOutput(
                address,
                new Value(2_000_000, token),
                TxOutputDatum.Inline(castMetadata.toUplcData(metadata))
            )
        )
    }

    addMetadataThread(props?: {
        metadata?: MetadataType
        redeemer?: UplcData
    }): ScriptContextBuilder {
        return this.addMetadataInput({
            metadata: props?.metadata,
            redeemer: props?.redeemer
        }).addMetadataOutput({
            metadata: props?.metadata
        })
    }

    addMintOrderInput(props?: {
        address?: Address
        datum?: MintOrderType
        redeemer?: MintOrderRedeemerType
        value?: Value
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.mintOrderValidator
        const datum = props?.datum ?? makeMintOrder()
        const value = props?.value ?? new Value(2_000_000)
        const id = this.newInputId()

        if (props?.redeemer) {
            this.purpose = ScriptPurpose.Spending(
                TxRedeemer.Spending(
                    this.tx.inputs.length,
                    castMintOrderRedeemer.toUplcData(props.redeemer)
                ),
                id
            )
        }

        this.tx.inputs.push(
            new TxInput(
                id,
                new TxOutput(
                    address,
                    value,
                    TxOutputDatum.Inline(castMintOrder.toUplcData(datum))
                )
            )
        )

        return this
    }

    addMintOrderReturn(props?: {
        address?: Address
        datum?: UplcData
        value?: Value
        tokens?: IntLike
    }): ScriptContextBuilder {
        const address = props?.address ?? Address.dummy(false)
        const datum = props?.datum ?? new IntData(0)
        const value =
            props?.value ??
            new Value(2_000_000, makeDvpTokens(Number(props?.tokens ?? 0)))

        return this.addOutput(
            new TxOutput(address, value, TxOutputDatum.Inline(datum))
        )
    }

    addOutput(output: TxOutput): ScriptContextBuilder {
        this.tx.outputs.push(output)

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
        const id = this.newInputId()

        if (props?.redeemer) {
            this.purpose = ScriptPurpose.Spending(
                TxRedeemer.Spending(
                    this.tx.inputs.length,
                    castPortfolioAction.toUplcData(props.redeemer)
                ),
                id
            )
        }

        this.tx.inputs.push(
            new TxInput(
                id,
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

    addPortfolioRef(props?: {
        address?: Address
        portfolio?: PortfolioType
        token?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.portfolioValidator
        const id = this.newInputId()
        const portfolio = props?.portfolio ?? makePortfolio()
        const token = props?.token ?? makePortfolioToken()

        this.addRefInput(
            new TxInput(
                id,
                new TxOutput(
                    address,
                    new Value(2_000_000, token),
                    TxOutputDatum.Inline(castPortfolio.toUplcData(portfolio))
                )
            )
        )

        return this
    }

    addPortfolioThread(props?: {
        portfolio?: PortfolioType
        redeemer?: PortfolioActionType
    }): ScriptContextBuilder {
        return this.addPortfolioInput({
            portfolio: props?.portfolio,
            redeemer: props?.redeemer
        }).addPortfolioOutput({ portfolio: props?.portfolio })
    }

    addPriceInput(props?: {
        address?: Address
        price?: PriceType
        redeemer?: UplcData
        token?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.priceValidator
        const price = props?.price ?? makePrice()
        const token = props?.token ?? makePriceToken()
        const id = this.newInputId()

        if (props?.redeemer) {
            this.purpose = ScriptPurpose.Spending(
                TxRedeemer.Spending(this.tx.inputs.length, props.redeemer),
                id
            )
        }

        this.tx.inputs.push(
            new TxInput(
                id,
                new TxOutput(
                    address,
                    new Value(2_000_000, token),
                    TxOutputDatum.Inline(castPrice.toUplcData(price))
                )
            )
        )

        return this
    }

    addPriceOutput(props?: {
        address?: Address
        price?: PriceType
        token?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.priceValidator
        const price = props?.price ?? makePrice()
        const token = props?.token ?? makePriceToken()

        this.tx.outputs.push(
            new TxOutput(
                address,
                new Value(2_000_000, token),
                TxOutputDatum.Inline(castPrice.toUplcData(price))
            )
        )

        return this
    }

    addPriceRef(props?: {
        address?: Address
        price?: PriceType
        token?: Assets
    }): ScriptContextBuilder {
        const id = this.newInputId()
        const address = props?.address ?? Addresses.priceValidator
        const price = props?.price ?? makePrice()
        const token = props?.token ?? makePriceToken()

        return this.addRefInput(
            new TxInput(
                id,
                new TxOutput(
                    address,
                    new Value(2_000_000, token),
                    TxOutputDatum.Inline(castPrice.toUplcData(price))
                )
            )
        )
    }

    addPriceThread(props?: {
        price?: PriceType
        redeemer?: UplcData
    }): ScriptContextBuilder {
        return this.addPriceInput({
            price: props?.price,
            redeemer: new IntData(0)
        }).addPriceOutput({ price: props?.price })
    }

    addRefInput(input: TxInput): ScriptContextBuilder {
        if (this.tx.refInputs) {
            this.tx.refInputs.push(input)
        } else {
            this.tx.refInputs = [input]
        }

        return this
    }

    addSigner(pkh: PubKeyHash): ScriptContextBuilder {
        if (this.tx.signers) {
            this.tx.signers.push(pkh)
        } else {
            this.tx.signers = [pkh]
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
        const id = this.newInputId()
        const supply = props?.supply ?? makeSupply()
        const supplyToken = props?.tokens ?? makeSupplyToken()
        const value = new Value(2_000_000n, supplyToken)

        if (props?.redeemer) {
            this.purpose = ScriptPurpose.Spending(
                TxRedeemer.Spending(
                    this.tx.inputs.length,
                    castAssetPtrs.toUplcData(props.redeemer)
                ),
                id
            )
        }

        this.tx.inputs.push(
            new TxInput(
                id,
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
        const id = this.newInputId()
        const supply = props?.supply ?? makeSupply()
        const token = props?.token ?? makeSupplyToken()

        this.addRefInput(
            new TxInput(
                id,
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
        inputSupply?: SupplyType
        outputSupply?: SupplyType
        token?: Assets
        inputToken?: Assets
        outputToken?: Assets
    }): ScriptContextBuilder {
        this.addSupplyInput({
            address: props?.inputAddress,
            redeemer: props?.redeemer,
            supply: props?.inputSupply ?? props?.supply,
            tokens: props?.inputToken ?? props?.token
        }).addSupplyOutput({
            address: props?.outputAddress,
            supply: props?.outputSupply ?? props?.supply,
            token: props?.outputToken ?? props?.token
        })

        return this
    }

    addVoucherInput(props?: {
        address?: Address
        id?: number
        redeemer?: UplcData
        token?: Assets
        voucher?: VoucherType
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.voucherValidator
        const token = props?.token ?? makeVoucherRefToken(props?.id ?? 0)
        const voucher = props?.voucher ?? makeVoucher()
        const id = this.newInputId()

        if (props?.redeemer) {
            this.purpose = ScriptPurpose.Spending(
                TxRedeemer.Spending(this.tx.inputs.length, props.redeemer),
                id
            )
        }

        this.tx.inputs.push(
            new TxInput(
                id,
                new TxOutput(
                    address,
                    new Value(2_000_000, token),
                    TxOutputDatum.Inline(castVoucher.toUplcData(voucher))
                )
            )
        )

        return this
    }

    addVoucherOutput(props?: {
        address?: Address
        id?: number
        token?: Assets
        voucher?: VoucherType
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.voucherValidator
        const token = props?.token ?? makeVoucherRefToken(props?.id ?? 0)
        const voucher = props?.voucher ?? makeVoucher()

        return this.addOutput(
            new TxOutput(
                address,
                new Value(2_000_000, token),
                TxOutputDatum.Inline(castVoucher.toUplcData(voucher))
            )
        )
    }

    mint(props?: { assets?: Assets }): ScriptContextBuilder {
        const prev = this.tx.minted ?? new Assets()

        if (props?.assets) {
            this.tx.minted = prev.add(props.assets)
        }

        return this
    }

    observeBenchmark(props?: {
        hash?: StakingValidatorHash
        redeemer?: RatioType
    }): ScriptContextBuilder {
        const hash = props?.hash ?? contract.benchmark_delegate.$hash
        const redeemer = props?.redeemer ?? [1n, 1n]

        return this.reward({ hash, redeemer: castRatio.toUplcData(redeemer) })
    }

    observeOracle(props?: {
        hash?: StakingValidatorHash
        redeemer?: UplcData
    }): ScriptContextBuilder {
        const hash = props?.hash ?? contract.oracle_delegate.$hash
        const redeemer = props?.redeemer ?? new IntData(0)

        return this.reward({ hash, redeemer })
    }

    observeDummy(props?: {
        hash?: StakingValidatorHash
    }): ScriptContextBuilder {
        const hash = props?.hash ?? StakingValidatorHash.dummy()
        const redeemer = new IntData(0)

        return this.reward({ hash, redeemer })
    }

    observeGovernance(props?: {
        hash?: StakingValidatorHash
        redeemer?: UplcData
    }): ScriptContextBuilder {
        const hash = props?.hash ?? contract.governance_delegate.$hash
        const redeemer = props?.redeemer ?? new IntData(0)

        return this.reward({ hash, redeemer })
    }

    redeemDummyTokenWithDvpPolicy(props?: { qty?: number }) {
        const tokenName = generateBytes(rand(0), 32)
        const qty = props?.qty ?? 1n
        const value = new Value(2_000_000, [[policy, [[tokenName, qty]]]])

        return this.addDummyInput({ redeemer: new IntData(0), value: value })
    }

    reward(props: {
        hash: StakingValidatorHash
        redeemer: UplcData
    }): ScriptContextBuilder {
        const r = this.tx.redeemers ?? []
        const w = this.tx.withdrawals ?? []

        r.push(TxRedeemer.Rewarding(w.length, props.redeemer))

        w.push([StakingAddress.fromHash(false, props.hash), 0])

        this.tx.redeemers = r
        this.tx.withdrawals = w

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
        const id = this.newInputId()
        const value = props?.value ?? new Value(2_000_000)

        if (props?.redeemer) {
            this.purpose = ScriptPurpose.Spending(
                TxRedeemer.Spending(this.tx.inputs.length, props.redeemer),
                id
            )
        }

        this.tx.inputs.push(
            new TxInput(
                id,
                new TxOutput(
                    Addresses.vault,
                    value,
                    TxOutputDatum.Inline(datum)
                )
            )
        )

        return this
    }

    setTimeRange(args?: {
        start?: number
        end?: number
    }): ScriptContextBuilder {
        this.tx.validityTimerange = new TimeRange(
            args?.start ?? Number.NEGATIVE_INFINITY,
            args?.end ?? Number.POSITIVE_INFINITY
        )

        return this
    }

    build(): UplcData {
        if (!this.purpose) {
            this.addDummyInput({ redeemer: new IntData(0) })
        }

        const purpose = expectSome(this.purpose)
        const ctx = new ScriptContextV2(this.tx, purpose)

        return ctx.toUplcData()
    }

    copy(): ScriptContextBuilder {
        const cpy = new ScriptContextBuilder()
        cpy.dummyIdCount = this.dummyIdCount
        cpy.purpose = this.purpose
        cpy.tx = {
            inputs: this.tx.inputs.slice(),
            refInputs: this.tx.refInputs?.slice(),
            outputs: this.tx.outputs.slice(),
            fee: this.tx.fee,
            minted: this.tx.minted
                ? new Assets(this.tx.minted.assets.slice())
                : undefined,
            dcerts: this.tx.dcerts?.slice(),
            withdrawals: this.tx.withdrawals?.slice(),
            validityTimerange: this.tx.validityTimerange,
            signers: this.tx.signers?.slice(),
            redeemers: this.tx.redeemers?.slice(),
            datums: this.tx.datums?.slice(),
            id: this.tx.id
        }

        return cpy
    }

    /**
     * TODO: call the callback with many permutations of inputs, outputs,  ref inputs with some dummy entries
     * @param callback
     */
    use(callback: (ctx: UplcData, self: TxInfo) => void): ScriptContextBuilder {
        const data = this.build()

        callback(data, this.tx)

        return this
    }
}
