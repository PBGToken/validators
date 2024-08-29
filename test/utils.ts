import { IntLike, encodeUtf8 } from "@helios-lang/codec-utils"
import { PermissiveType } from "@helios-lang/contract-utils"
import { Address, AssetClass, Assets, MintingPolicyHash, PubKeyHash, ScriptContextV2, ScriptPurpose, StakingValidatorHash, TimeLike, TxInput, TxOutput, TxOutputDatum, TxOutputId, TxRedeemer, ValidatorHash, Value } from "@helios-lang/ledger"
import { ByteArrayData, IntData, ListData, UplcData } from "@helios-lang/uplc"
import context from "pbg-token-validators-test-context"

export type ConfigType = PermissiveType<typeof context.ConfigModule.Config>
export type SupplyType = PermissiveType<typeof context.supply_validator.Supply>

export const policy = new MintingPolicyHash(context.fund_policy.$hash.bytes, context.fund_policy.$hash.context)

export const allScripts = [
    "fund_policy",
    "mint_order_validator",
    "burn_order_validator",
    "supply_validator",
    "assets_validator",
    "portfolio_validator",
    "price_validator",
    "reimbursement_validator",
    "voucher_validator",
    "config_validator",
    "metadata_validator",
    "oracle_delegate",
    "benchmark_delegate",
    "governance_delegate"
]

type MakeSupplyValidatorSpendingContextArgs = {
    supply: SupplyType
    config?: ConfigType
    minted?: Assets
}
/**
 * calc_management_fee_dilution() is only used in the supply_validator
 * 
 * The asset pointers aren't needed, so the redeemer can just be an empty list
 * 
 * In the most basic variant of the transaction some ada is spent at the supply_validator address, and sent somewhere else
 * The datum of the spent utxo is of Supply type
 */
export function makeSupplyValidatorSpendingContext(args: MakeSupplyValidatorSpendingContextArgs): UplcData {
    const vh = context.supply_validator.$hash
    const addr = Address.fromHash(false, vh)

    const input = new TxInput(
        TxOutputId.dummy(), 
        new TxOutput(
            addr,
            new Value(2_000_000n, Assets.fromAssetClasses([[new AssetClass(policy, encodeUtf8("supply")), 1n]])),
            TxOutputDatum.Inline(context.supply_validator.Supply.toUplcData(args.supply))
        )
    )

    const inputs: TxInput[] = []

    inputs.push(input)

    const refInputs: TxInput[] = []

    if (args.config) {
        const configAddr = Address.fromHash(false, context.config_validator.$hash)
        
        const assetClass = new AssetClass(policy, encodeUtf8("config"))
        const refInput = new TxInput(
            TxOutputId.dummy(),
            new TxOutput(
                configAddr,
                new Value(2_000_000n, Assets.fromAssetClasses( [[assetClass, 1n]])),
                TxOutputDatum.Inline(context.ConfigModule.Config.toUplcData(args.config))
            )
        )

        refInputs.push(refInput)
    }

    const output = new TxOutput(Address.dummy(false), new Value(2_000_000n))

    const purpose = ScriptPurpose.Spending(TxRedeemer.Spending(0, new ListData([])), TxOutputId.dummy())

    const ctx = new ScriptContextV2({
        inputs: inputs,
        refInputs: refInputs,
        minted: args.minted,
        outputs: [output]
    }, purpose)

    return ctx.toUplcData() 
}

export function makeSwapSpendingContext(): UplcData {
    const inputs: TxInput[] = []
    const addr = Address.fromHash(false, new ValidatorHash(context.fund_policy.$hash.bytes, context.fund_policy.$hash.context))
    const datum = new ByteArrayData([])

    inputs.push(new TxInput(
        TxOutputId.dummy(),
        new TxOutput(
            addr,
            new Value(2_000_000),
            TxOutputDatum.Inline(datum)
        )
    ))

    const outputs: TxOutput[] = []

    outputs.push(new TxOutput(
        addr,
        new Value(2_000_000),
        TxOutputDatum.Inline(datum)
    ))

    const ctx = new ScriptContextV2({
        inputs,
        outputs
    }, ScriptPurpose.Spending(TxRedeemer.Spending(0, new IntData(0)), TxOutputId.dummy()))

    return ctx.toUplcData()
}

type MakeConfigArgs = {
    relManagementFee?: number
    successFee?: {
        c0?: number
        steps?: PermissiveType<typeof context.SuccessFeeModule.SuccessFeeStep>[]
    }
}

export function makeConfig(args: MakeConfigArgs): ConfigType {
    return {
        agent: PubKeyHash.dummy(),
        fees: {
            mint_fee: {
                relative: 0,
                minimum: 0
            },
            burn_fee: {
                relative: 0,
                minimum: 0
            },
            management_fee: {
                relative: args.relManagementFee ?? 0.0001,
                period: 24*60*60*1000
            },
            success_fee: {
                fee: {
                    c0: args?.successFee?.c0 ?? 0,
                    steps: args?.successFee?.steps ?? []
                },
                benchmark: StakingValidatorHash.dummy()
            }
        },
        token: {
            max_price_age: 0,
            max_supply: 0
        },
        oracle: StakingValidatorHash.dummy(),
        governance: {
            update_delay: 0,
            delegate: StakingValidatorHash.dummy()
        },
        state: {
            Idle: {}
        }
    }
}

export const DUMMY_CONFIG: ConfigType = makeConfig({})
export const DUMMY_SUPPLY: SupplyType = makeSupply({})

type MakeSupplyArgs = {
    nTokens?: IntLike
    startPrice?: [IntLike, IntLike]
    successFee?: {
        start_time?: TimeLike
        period?: IntLike
        periodId?: IntLike
    }
}

export function makeSupply(args: MakeSupplyArgs): SupplyType {
    return {
        tick: 0,
        n_tokens: args.nTokens ?? 1_000_000_000,
        n_vouchers: 0,
        last_voucher_id: 0,
        n_lovelace: 100_000_000_000,
        management_fee_timestamp: 0,
        success_fee: {
            period_id: args?.successFee?.periodId ?? 0,
            start_time: args?.successFee?.start_time ?? 0,
            period: args?.successFee?.period ?? 1000*60*60*24*365,
            start_price: args.startPrice ?? [100, 1]
        } 
    }
}