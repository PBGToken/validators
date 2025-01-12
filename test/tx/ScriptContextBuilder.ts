import { IntLike } from "@helios-lang/codec-utils"
import { generateBytes, rand } from "@helios-lang/crypto"
import {
    type ShelleyAddress,
    type Assets,
    makeDummyTxOutputId,
    makeInlineTxOutputDatum,
    makeSpendingPurpose,
    makeTxInput,
    makeTxOutput,
    makeValue,
    type PubKeyHash,
    type ScriptPurpose,
    type StakingValidatorHash,
    type TxInfo,
    type TxInput,
    type TxOutput,
    type TxOutputId,
    type Value,
    makeDummyAddress,
    makeDummyPubKeyHash,
    makeAssets,
    makeDummyMintingPolicyHash,
    makeMintingPurpose,
    makeRewardingPurpose,
    makeDummyStakingValidatorHash,
    makeTxRewardingRedeemer,
    makeStakingAddress,
    makeTimeRange,
    makeScriptContextV2
} from "@helios-lang/ledger"
import { expectDefined } from "@helios-lang/type-utils"
import {
    ByteArrayData,
    IntData,
    ListData,
    makeByteArrayData,
    makeIntData,
    UplcData
} from "@helios-lang/uplc"
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
    ReimbursementType,
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
    castReimbursement,
    castSupply,
    castVoucher,
    makeBurnOrder,
    makeConfig,
    makeMetadata,
    makeMintOrder,
    makePortfolio,
    makePrice,
    makeExtractingReimbursement,
    makeSupply,
    makeVoucher,
    wrapVoucher,
    castVoucherWrapper
} from "../data"
import {
    makeAssetsToken,
    makeConfigToken,
    makeDvpTokens,
    makeMetadataToken,
    makePortfolioToken,
    makePriceToken,
    makeReimbursementToken,
    makeSupplyToken,
    makeVoucherRefToken
} from "../tokens"

export class ScriptContextBuilder {
    private dummyIdCount: number
    tx: TxInfo
    purpose: ScriptPurpose | undefined

    constructor() {
        this.dummyIdCount = 0
        this.tx = {
            inputs: [],
            outputs: []
        }

        this.purpose = undefined
    }

    /**
     * The TxOutputId of each input and refInput must be unique (builtin functions like get_current_input() rely on that)
     */
    private newInputId(): TxOutputId {
        return makeDummyTxOutputId(this.dummyIdCount++)
    }

    addAssetGroupInput(props?: {
        address?: ShelleyAddress
        assets?: AssetType[]
        id?: IntLike
        redeemer?: AssetGroupAction
        token?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.assetsValidator
        const assets = props?.assets ?? []
        const token = props?.token ?? makeAssetsToken(props?.id ?? 0)
        const value = makeValue(2_000_000, token)
        const id = this.newInputId()

        if (props?.redeemer) {
            this.purpose = makeSpendingPurpose(id)
        }

        this.tx.inputs.push(
            makeTxInput(
                id,
                makeTxOutput(
                    address,
                    value,
                    makeInlineTxOutputDatum(
                        castAssetGroup.toUplcData({ assets })
                    )
                )
            )
        )

        return this
    }

    addAssetGroupRef(props?: {
        address?: ShelleyAddress
        assets?: AssetType[]
        id?: IntLike
        token?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.assetsValidator
        const assets = props?.assets ?? []
        const token = props?.token ?? makeAssetsToken(Number(props?.id ?? 0))
        const value = makeValue(2_000_000, token)
        const id = this.newInputId()

        this.addRefInput(
            makeTxInput(
                id,
                makeTxOutput(
                    address,
                    value,
                    makeInlineTxOutputDatum(
                        castAssetGroup.toUplcData({ assets })
                    )
                )
            )
        )

        return this
    }

    addAssetGroupOutput(props?: {
        address?: ShelleyAddress
        assets?: AssetType[]
        id?: IntLike
        token?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.assetsValidator
        const assets = props?.assets ?? []
        const token = props?.token ?? makeAssetsToken(props?.id ?? 0)
        const value = makeValue(2_000_000, token)

        const datum = castAssetGroup.toUplcData({ assets })

        this.tx.outputs.push(
            makeTxOutput(address, value, makeInlineTxOutputDatum(datum))
        )

        return this
    }

    addAssetGroupThread(props?: {
        id?: number
        inputToken?: Assets
        inputAssets?: AssetType[]
        outputAssets: AssetType[]
        outputAddress?: ShelleyAddress
        outputToken?: Assets
        redeemer?: AssetGroupAction
    }): ScriptContextBuilder {
        return this.addAssetGroupInput({
            assets: props?.inputAssets,
            id: props?.id,
            token: props?.inputToken,
            redeemer: props?.redeemer
        }).addAssetGroupOutput({
            id: props?.id,
            address: props?.outputAddress,
            assets: props?.outputAssets,
            token: props?.outputToken
        })
    }

    addBurnOrderInput(props?: {
        address?: ShelleyAddress<any>
        datum?: BurnOrderType
        redeemer?: BurnOrderRedeemerType
        value?: Value
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.burnOrderValidator
        const datum = props?.datum ?? makeBurnOrder()
        const value = props?.value ?? makeValue(2_000_000)
        const id = this.newInputId()

        if (props?.redeemer) {
            this.purpose = makeSpendingPurpose(id)
        }

        this.tx.inputs.push(
            makeTxInput(
                id,
                makeTxOutput(
                    address,
                    value,
                    makeInlineTxOutputDatum(castBurnOrder.toUplcData(datum))
                )
            )
        )

        return this
    }

    addBurnOrderReturn(props?: {
        address?: ShelleyAddress<any>
        datum?: UplcData
        value?: Value
    }): ScriptContextBuilder {
        const address = props?.address ?? makeDummyAddress(false)
        const datum = props?.datum ?? makeIntData(0)
        const value = props?.value ?? makeValue(2_000_000)

        return this.addOutput(
            makeTxOutput(address, value, makeInlineTxOutputDatum(datum))
        )
    }

    addConfigInput(props?: {
        address?: ShelleyAddress
        config?: ConfigType
        redeemer?: UplcData
        token?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.configValidator
        const config = props?.config ?? makeConfig()
        const token = props?.token ?? makeConfigToken()
        const id = this.newInputId()

        if (props?.redeemer) {
            this.purpose = makeSpendingPurpose(id)
        }

        this.tx.inputs.push(
            makeTxInput(
                id,
                makeTxOutput(
                    address,
                    makeValue(2_000_000, token),
                    makeInlineTxOutputDatum(castConfig.toUplcData(config))
                )
            )
        )

        return this
    }

    addConfigOutput(props?: {
        address?: ShelleyAddress
        config?: ConfigType
        datum?: UplcData
        token?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.configValidator
        const config = props?.config ?? makeConfig()
        const token = props?.token ?? makeConfigToken()

        return this.addOutput(
            makeTxOutput(
                address,
                makeValue(2_000_000, token),
                makeInlineTxOutputDatum(
                    props?.datum ?? castConfig.toUplcData(config)
                )
            )
        )
    }

    addConfigRef(props?: {
        address?: ShelleyAddress
        config?: ConfigType
        token?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.configValidator
        const config = props?.config ?? makeConfig()
        const token = props?.token ?? makeConfigToken()
        const id = this.newInputId()
        const value = makeValue(2_000_000n, token)

        this.addRefInput(
            makeTxInput(
                id,
                makeTxOutput(
                    address,
                    value,
                    makeInlineTxOutputDatum(castConfig.toUplcData(config))
                )
            )
        )

        return this
    }

    addConfigThread(props?: {
        config?: ConfigType
        inputConfig?: ConfigType
        outputConfig?: ConfigType
        redeemer?: UplcData
    }): ScriptContextBuilder {
        return this.addConfigInput({
            config: props?.inputConfig ?? props?.config,
            redeemer: props?.redeemer
        }).addConfigOutput({
            config: props?.outputConfig ?? props?.config
        })
    }

    addDummyInput(props?: {
        address?: ShelleyAddress
        id?: TxOutputId
        redeemer?: UplcData
        value?: Value
    }): ScriptContextBuilder {
        const address = props?.address ?? makeDummyAddress(false)
        const id = props?.id ?? this.newInputId()
        const value = props?.value ?? makeValue(2_000_000)

        if (props?.redeemer) {
            this.purpose = makeSpendingPurpose(id)
        }

        this.tx.inputs.push(makeTxInput(id, makeTxOutput(address, value)))

        return this
    }

    addDummyInputs(n: number): ScriptContextBuilder {
        for (let i = 0; i < n; i++) {
            this.addDummyInput()
        }

        return this
    }

    addDummyOutput(props?: {
        address?: ShelleyAddress
        value?: Value
    }): ScriptContextBuilder {
        const address = props?.address ?? makeDummyAddress(false)

        this.tx.outputs.push(
            makeTxOutput(address, props?.value ?? makeValue(2_000_000))
        )

        return this
    }

    addDummyOutputs(n: number): ScriptContextBuilder {
        for (let i = 0; i < n; i++) {
            this.addDummyOutput()
        }

        return this
    }

    addDummyRef(props?: {
        address?: ShelleyAddress
        value?: Value
    }): ScriptContextBuilder {
        const address = props?.address ?? makeDummyAddress(false)
        const id = this.newInputId()
        const value = props?.value ?? makeValue(2_000_000)

        this.addRefInput(makeTxInput(id, makeTxOutput(address, value)))

        return this
    }

    addDummyRefs(n: number): ScriptContextBuilder {
        for (let i = 0; i < n; i++) {
            this.addDummyRef()
        }

        return this
    }

    addDummySigners(n: number): ScriptContextBuilder {
        for (let i = 0; i < n; i++) {
            this.addSigner(makeDummyPubKeyHash(1000000 + i))
        }

        return this
    }

    addMetadataInput(props?: {
        address?: ShelleyAddress
        metadata?: MetadataType
        redeemer?: UplcData
        token?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.metadataValidator
        const metadata = props?.metadata ?? makeMetadata()
        const token = props?.token ?? makeMetadataToken()
        const id = this.newInputId()

        if (props?.redeemer) {
            this.purpose = makeSpendingPurpose(id)
        }

        this.tx.inputs.push(
            makeTxInput(
                id,
                makeTxOutput(
                    address,
                    makeValue(2_000_000, token),
                    makeInlineTxOutputDatum(castMetadata.toUplcData(metadata))
                )
            )
        )

        return this
    }

    addMetadataOutput(props?: {
        address?: ShelleyAddress
        metadata?: MetadataType
        token?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.metadataValidator
        const metadata = props?.metadata ?? makeMetadata()
        const token = props?.token ?? makeMetadataToken()

        return this.addOutput(
            makeTxOutput(
                address,
                makeValue(2_000_000, token),
                makeInlineTxOutputDatum(castMetadata.toUplcData(metadata))
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
        address?: ShelleyAddress
        datum?: MintOrderType
        redeemer?: MintOrderRedeemerType
        value?: Value
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.mintOrderValidator
        const datum = props?.datum ?? makeMintOrder()
        const value = props?.value ?? makeValue(2_000_000)
        const id = this.newInputId()

        if (props?.redeemer) {
            this.purpose = makeSpendingPurpose(id)
        }

        this.tx.inputs.push(
            makeTxInput(
                id,
                makeTxOutput(
                    address,
                    value,
                    makeInlineTxOutputDatum(castMintOrder.toUplcData(datum))
                )
            )
        )

        return this
    }

    addMintOrderReturn(props?: {
        address?: ShelleyAddress<any>
        datum?: UplcData
        value?: Value
        tokens?: IntLike
    }): ScriptContextBuilder {
        const address = props?.address ?? makeDummyAddress(false)
        const datum = props?.datum ?? makeIntData(0)
        const value =
            props?.value ??
            makeValue(2_000_000, makeDvpTokens(Number(props?.tokens ?? 0)))

        return this.addOutput(
            makeTxOutput(address, value, makeInlineTxOutputDatum(datum))
        )
    }

    addOutput(
        props:
            | TxOutput<any>
            | { address?: ShelleyAddress; datum?: UplcData; value?: Value }
    ): ScriptContextBuilder {
        // TODO: TxOutput.kind
        if ("correctLovelace" in props) {
            this.tx.outputs.push(props)
        } else {
            this.tx.outputs.push(
                makeTxOutput(
                    props.address ?? makeDummyAddress(false, 0),
                    props.value ?? makeValue(0),
                    props.datum
                        ? makeInlineTxOutputDatum(props.datum)
                        : undefined
                )
            )
        }

        return this
    }

    addPortfolioInput(props?: {
        address?: ShelleyAddress
        portfolio?: PortfolioType
        redeemer?: PortfolioActionType
        token?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.portfolioValidator
        const portfolio = props?.portfolio ?? makePortfolio()
        const token = props?.token ?? makePortfolioToken()
        const id = this.newInputId()

        if (props?.redeemer) {
            this.purpose = makeSpendingPurpose(id)
        }

        this.tx.inputs.push(
            makeTxInput(
                id,
                makeTxOutput(
                    address,
                    makeValue(2_000_000, token),
                    makeInlineTxOutputDatum(castPortfolio.toUplcData(portfolio))
                )
            )
        )

        return this
    }

    addPortfolioOutput(props?: {
        address?: ShelleyAddress
        datum?: UplcData
        portfolio?: PortfolioType
        token?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.portfolioValidator
        const portfolio = props?.portfolio ?? makePortfolio()
        const token = props?.token ?? makePortfolioToken()

        this.tx.outputs.push(
            makeTxOutput(
                address,
                makeValue(2_000_000, token),
                makeInlineTxOutputDatum(
                    props?.datum ?? castPortfolio.toUplcData(portfolio)
                )
            )
        )

        return this
    }

    addPortfolioRef(props?: {
        address?: ShelleyAddress
        portfolio?: PortfolioType
        token?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.portfolioValidator
        const id = this.newInputId()
        const portfolio = props?.portfolio ?? makePortfolio()
        const token = props?.token ?? makePortfolioToken()

        this.addRefInput(
            makeTxInput(
                id,
                makeTxOutput(
                    address,
                    makeValue(2_000_000, token),
                    makeInlineTxOutputDatum(castPortfolio.toUplcData(portfolio))
                )
            )
        )

        return this
    }

    addPortfolioThread(props?: {
        portfolio?: PortfolioType
        inputPortfolio?: PortfolioType
        outputPortfolio?: PortfolioType
        redeemer?: PortfolioActionType
    }): ScriptContextBuilder {
        return this.addPortfolioInput({
            portfolio: props?.inputPortfolio ?? props?.portfolio,
            redeemer: props?.redeemer
        }).addPortfolioOutput({
            portfolio: props?.outputPortfolio ?? props?.portfolio
        })
    }

    addPriceInput(props?: {
        address?: ShelleyAddress
        price?: PriceType
        redeemer?: UplcData
        token?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.priceValidator
        const price = props?.price ?? makePrice()
        const token = props?.token ?? makePriceToken()
        const id = this.newInputId()

        if (props?.redeemer) {
            this.purpose = makeSpendingPurpose(id)
        }

        this.tx.inputs.push(
            makeTxInput(
                id,
                makeTxOutput(
                    address,
                    makeValue(2_000_000, token),
                    makeInlineTxOutputDatum(castPrice.toUplcData(price))
                )
            )
        )

        return this
    }

    addPriceOutput(props?: {
        address?: ShelleyAddress
        datum?: UplcData
        price?: PriceType
        token?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.priceValidator
        const price = props?.price ?? makePrice()
        const token = props?.token ?? makePriceToken()

        this.tx.outputs.push(
            makeTxOutput(
                address,
                makeValue(2_000_000, token),
                makeInlineTxOutputDatum(
                    props?.datum ?? castPrice.toUplcData(price)
                )
            )
        )

        return this
    }

    addPriceRef(props?: {
        address?: ShelleyAddress
        price?: PriceType
        token?: Assets
    }): ScriptContextBuilder {
        const id = this.newInputId()
        const address = props?.address ?? Addresses.priceValidator
        const price = props?.price ?? makePrice()
        const token = props?.token ?? makePriceToken()

        return this.addRefInput(
            makeTxInput(
                id,
                makeTxOutput(
                    address,
                    makeValue(2_000_000, token),
                    makeInlineTxOutputDatum(castPrice.toUplcData(price))
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
            redeemer: makeIntData(0)
        }).addPriceOutput({ price: props?.price })
    }

    addReimbursementInput(props?: {
        address?: ShelleyAddress
        datum?: ReimbursementType
        reimbursement?: ReimbursementType
        id?: IntLike
        nDvpTokens?: IntLike
        extraTokens?: Assets
        redeemer?: UplcData
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.reimbursementValidator
        const datum =
            props?.datum ??
            props?.reimbursement ??
            makeExtractingReimbursement()
        let tokens = makeReimbursementToken(props?.id ?? 0).add(
            makeDvpTokens(props?.nDvpTokens ?? 1000n)
        )

        if (props?.extraTokens) {
            tokens = tokens.add(props.extraTokens)
        }

        const id = this.newInputId()

        if (props?.redeemer) {
            this.purpose = makeSpendingPurpose(id)
        }

        this.tx.inputs.push(
            makeTxInput(
                id,
                makeTxOutput(
                    address,
                    makeValue(2_000_000, tokens),
                    makeInlineTxOutputDatum(castReimbursement.toUplcData(datum))
                )
            )
        )

        return this
    }

    addReimbursementOutput(props?: {
        address?: ShelleyAddress
        datum?: UplcData | ReimbursementType
        reimbursement?: ReimbursementType
        id?: IntLike
        nDvpTokens?: IntLike
        token?: Assets
        extraTokens?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.reimbursementValidator
        const datum =
            props?.datum ??
            props?.reimbursement ??
            makeExtractingReimbursement()
        let token =
            props?.token ??
            makeReimbursementToken(props?.id ?? 0).add(
                makeDvpTokens(props?.nDvpTokens ?? 1000n)
            )

        if (props?.extraTokens) {
            token = token.add(props?.extraTokens)
        }

        return this.addOutput(
            makeTxOutput(
                address,
                makeValue(2_000_000, token),
                makeInlineTxOutputDatum(
                    "kind" in datum
                        ? datum
                        : castReimbursement.toUplcData(datum)
                )
            )
        )
    }

    addReimbursementThread(props?: {
        datum?: ReimbursementType
        id?: IntLike
        nDvpTokens?: IntLike
        extraInputTokens?: Assets
        redeemer?: UplcData
    }): ScriptContextBuilder {
        return this.addReimbursementInput({
            datum: props?.datum,
            id: props?.id,
            nDvpTokens: props?.nDvpTokens,
            extraTokens: props?.extraInputTokens,
            redeemer: props?.redeemer
        }).addReimbursementOutput({
            datum: props?.datum,
            id: props?.id,
            nDvpTokens: props?.nDvpTokens
        })
    }

    addRefInput(input: TxInput): ScriptContextBuilder {
        if (this.tx.refInputs) {
            this.tx.refInputs.push(input)
        } else {
            this.tx.refInputs = [input]
        }

        return this
    }

    addSigner(pkh: PubKeyHash | null): ScriptContextBuilder {
        if (pkh !== null) {
            if (this.tx.signers) {
                this.tx.signers.push(pkh)
            } else {
                this.tx.signers = [pkh]
            }
        }

        return this
    }

    addSupplyInput(props?: {
        address?: ShelleyAddress
        redeemer?: AssetPtrType[]
        supply?: SupplyType
        token?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.supplyValidator
        const id = this.newInputId()
        const supply = props?.supply ?? makeSupply()
        const supplyToken = props?.token ?? makeSupplyToken()
        const value = makeValue(2_000_000n, supplyToken)

        if (props?.redeemer) {
            this.purpose = makeSpendingPurpose(id)
        }

        this.tx.inputs.push(
            makeTxInput(
                id,
                makeTxOutput(
                    address,
                    value,
                    makeInlineTxOutputDatum(castSupply.toUplcData(supply))
                )
            )
        )

        return this
    }

    addSupplyOutput(props?: {
        address?: ShelleyAddress
        supply?: UplcData | SupplyType
        token?: Assets
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.supplyValidator
        const supply = props?.supply ?? makeSupply()
        const supplyToken = props?.token ?? makeSupplyToken()
        const value = makeValue(2_000_000n, supplyToken)

        this.tx.outputs.push(
            makeTxOutput(
                address,
                value,
                makeInlineTxOutputDatum(
                    "kind" in supply ? supply : castSupply.toUplcData(supply)
                )
            )
        )

        return this
    }

    addSupplyRef(
        props?: {
            address?: ShelleyAddress
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
            makeTxInput(
                id,
                makeTxOutput(
                    address,
                    makeValue(2_000_000, token),
                    makeInlineTxOutputDatum(castSupply.toUplcData(supply))
                )
            )
        )

        return this
    }

    addSupplyThread(props?: {
        inputAddress?: ShelleyAddress
        outputAddress?: ShelleyAddress
        redeemer?: AssetPtrType[]
        supply?: SupplyType
        inputSupply?: SupplyType
        outputSupply?: UplcData | SupplyType
        token?: Assets
        inputToken?: Assets
        outputToken?: Assets
    }): ScriptContextBuilder {
        this.addSupplyInput({
            address: props?.inputAddress,
            redeemer: props?.redeemer,
            supply: props?.inputSupply ?? props?.supply,
            token: props?.inputToken ?? props?.token
        }).addSupplyOutput({
            address: props?.outputAddress,
            supply: props?.outputSupply ?? props?.supply,
            token: props?.outputToken ?? props?.token
        })

        return this
    }

    addVoucherInput(props?: {
        address?: ShelleyAddress
        id?: IntLike
        redeemer?: UplcData
        token?: Assets
        voucher?: VoucherType
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.voucherValidator
        const token = props?.token ?? makeVoucherRefToken(props?.id ?? 0)
        const voucher = props?.voucher ?? makeVoucher()
        const id = this.newInputId()

        if (props?.redeemer) {
            this.purpose = makeSpendingPurpose(id)
        }

        const datum = wrapVoucher(voucher)

        this.tx.inputs.push(
            makeTxInput(
                id,
                makeTxOutput(
                    address,
                    makeValue(2_000_000, token),
                    makeInlineTxOutputDatum(
                        castVoucherWrapper.toUplcData(datum)
                    )
                )
            )
        )

        return this
    }

    addVoucherOutput(props?: {
        address?: ShelleyAddress
        datum?: UplcData
        id?: IntLike
        token?: Assets
        voucher?: VoucherType
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.voucherValidator
        const token = props?.token ?? makeVoucherRefToken(props?.id ?? 0)
        const voucher = props?.voucher ?? makeVoucher()

        const datum = wrapVoucher(voucher)

        return this.addOutput(
            makeTxOutput(
                address,
                makeValue(2_000_000, token),
                makeInlineTxOutputDatum(
                    props?.datum ?? castVoucherWrapper.toUplcData(datum)
                )
            )
        )
    }

    mint(props?: {
        assets?: Assets | null
        redeemer?: UplcData
    }): ScriptContextBuilder {
        if (props?.assets === null) {
            return this
        }

        const prev = this.tx.minted ?? makeAssets()

        if (props?.redeemer) {
            const mph =
                props?.assets?.assets?.[0]?.[0] ?? makeDummyMintingPolicyHash()

            this.purpose = makeMintingPurpose(mph)
        }

        if (props?.assets) {
            this.tx.minted = prev.add(props.assets)
        }

        return this
    }

    observeBenchmark(props?: {
        hash?: StakingValidatorHash
        redeemer?: RatioType
        isMainPurpose?: boolean
    }): ScriptContextBuilder {
        const hash = props?.hash ?? contract.benchmark_delegate.$hash
        const redeemer = props?.redeemer ?? [1n, 1n]

        this.reward({ hash, redeemer: castRatio.toUplcData(redeemer) })

        if (props?.isMainPurpose) {
            this.purpose = makeRewardingPurpose(hash)
        }

        return this
    }

    observeOracle(props?: {
        hash?: StakingValidatorHash
        redeemer?: UplcData
    }): ScriptContextBuilder {
        const hash = props?.hash ?? contract.oracle_delegate.$hash
        const redeemer = props?.redeemer ?? makeIntData(0)

        return this.reward({ hash, redeemer })
    }

    observeDummy(props?: {
        hash?: StakingValidatorHash
    }): ScriptContextBuilder {
        const hash = props?.hash ?? makeDummyStakingValidatorHash()
        const redeemer = makeIntData(0)

        return this.reward({ hash, redeemer })
    }

    observeGovernance(props?: {
        hash?: StakingValidatorHash | null
        redeemer?: UplcData
    }): ScriptContextBuilder {
        if (props?.hash === null) {
            return this
        }

        const hash = props?.hash ?? contract.governance_delegate.$hash
        const redeemer = props?.redeemer ?? makeIntData(0)

        return this.reward({ hash, redeemer })
    }

    redeemDummyTokenWithDvpPolicy(props?: { qty?: number }) {
        const tokenName = generateBytes(rand(0), 32)
        const qty = props?.qty ?? 1n
        const value = makeValue(2_000_000, [[policy, [[tokenName, qty]]]])

        return this.addDummyInput({ redeemer: makeIntData(0), value: value })
    }

    reward(props: {
        hash: StakingValidatorHash
        redeemer: UplcData
    }): ScriptContextBuilder {
        const r = this.tx.redeemers ?? []
        const w = this.tx.withdrawals ?? []

        r.push(makeTxRewardingRedeemer(w.length, props.redeemer))

        w.push([makeStakingAddress(false, props.hash), 0])

        this.tx.redeemers = r
        this.tx.withdrawals = w

        return this
    }

    sendToVault(props?: {
        datum?: UplcData
        value?: Value
    }): ScriptContextBuilder {
        const datum = props?.datum ?? makeByteArrayData([])
        const value = props?.value ?? makeValue(2_000_000)

        this.tx.outputs.push(
            makeTxOutput(Addresses.vault, value, makeInlineTxOutputDatum(datum))
        )

        return this
    }

    takeFromVault(props?: {
        address?: ShelleyAddress
        datum?: UplcData
        redeemer?: UplcData
        value?: Value
    }): ScriptContextBuilder {
        const address = props?.address ?? Addresses.vault
        const datum = props?.datum ?? makeByteArrayData([])
        const value = props?.value ?? makeValue(2_000_000)
        const id = this.newInputId()

        if (props?.redeemer) {
            this.purpose = makeSpendingPurpose(id)
        }

        this.tx.inputs.push(
            makeTxInput(
                id,
                makeTxOutput(address, value, makeInlineTxOutputDatum(datum))
            )
        )

        return this
    }

    setTimeRange(args?: {
        start?: number
        end?: number
    }): ScriptContextBuilder {
        this.tx.validityTimerange = makeTimeRange(
            args?.start ?? Number.NEGATIVE_INFINITY,
            args?.end ?? Number.POSITIVE_INFINITY
        )

        return this
    }

    build(): UplcData {
        if (!this.purpose) {
            this.addDummyInput({ redeemer: makeIntData(0) })
        }

        const purpose = expectDefined(this.purpose)
        const ctx = makeScriptContextV2(this.tx, purpose)

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
                ? makeAssets(this.tx.minted.assets.slice())
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

export function withScripts<P>(
    conf: (props?: P) => ScriptContextBuilder,
    scripts: string[]
): (props?: P) => {
    use(
        callback: (currentScript: string, ctx: UplcData, txInfo: TxInfo) => void
    ): void
} {
    return (props) => {
        const scb = conf(props)

        return {
            use: (callback) => {
                scb.use((ctx, txInfo) => {
                    scripts.forEach((currentScript) => {
                        callback(currentScript, ctx, txInfo)
                    })
                })
            }
        }
    }
}
