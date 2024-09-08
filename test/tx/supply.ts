import { Address, Assets } from "@helios-lang/ledger"
import { UplcData } from "@helios-lang/uplc"
import { ConfigType, SupplyType } from "../data"
import { ScriptContextBuilder } from "./ScriptContextBuilder"

type SpendSupplyArgs = {
    supply: SupplyType
    config?: ConfigType
    minted?: Assets
    supplyToken?: Assets
    returnAddr?: Address
}

/**
 * calc_management_fee_dilution() is only used in the supply_validator
 *
 * The asset pointers aren't needed, so the redeemer can just be an empty list
 *
 * In the most basic variant of the transaction some ada is spent at the supply_validator address, and sent somewhere else
 * The datum of the spent utxo is of Supply type
 */
export function spendSupply(args: SpendSupplyArgs): UplcData {
    return new ScriptContextBuilder()
        .addSupplyThread({
            outputAddress: args?.returnAddr,
            redeemer: [],
            inputSupply: args?.supply,
            outputSupply: args?.supply,
            token: args?.supplyToken
        })
        .addConfigRef({
            config: args.config
        })
        .mint({ assets: args.minted })
        .build()
}
