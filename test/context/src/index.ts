import { ContractContextBuilder } from "@helios-lang/contract-utils"
import { PubKeyHash, TxOutputId } from "@helios-lang/ledger"
import { IntData, ListData } from "@helios-lang/uplc"
import {
    assets_validator,
    benchmark_delegate,
    burn_order_validator,
    config_validator,
    fund_policy,
    governance_delegate,
    metadata_validator,
    mint_order_validator,
    oracle_delegate,
    portfolio_validator,
    price_validator,
    reimbursement_validator,
    supply_validator,
    voucher_validator
} from "pbg-token-validators"

export const SEED_ID = TxOutputId.dummy(999999) // something very large in order not to conflict with auto-generated ids in ScriptContextBuilder
export const INITIAL_AGENT = PubKeyHash.dummy()
export const GOV_KEY_1 = PubKeyHash.dummy(456)
export const GOV_KEY_2 = PubKeyHash.dummy(457)
export const GOV_KEY_3 = PubKeyHash.dummy(458)
export const ORACLE_KEY_1 = PubKeyHash.dummy(459)
export const ORACLE_KEY_2 = PubKeyHash.dummy(460)
export const ORACLE_KEY_3 = PubKeyHash.dummy(461)

const context = ContractContextBuilder.new()
    .with(assets_validator)
    .with(benchmark_delegate)
    .with(burn_order_validator)
    .with(config_validator)
    .with(fund_policy)
    .with(governance_delegate)
    .with(metadata_validator)
    .with(mint_order_validator)
    .with(oracle_delegate)
    .with(portfolio_validator)
    .with(price_validator)
    .with(reimbursement_validator)
    .with(supply_validator)
    .with(voucher_validator)
    .build({
        isMainnet: false,
        debug: true, // if `true`: significantly blows up the size of the bundle
        parameters: {
            "fund_policy::SEED_ID": SEED_ID.toUplcData(),
            "fund_policy::INITIAL_AGENT": INITIAL_AGENT.toUplcData(),
            "fund_policy::INITIAL_CYCLE_PERIOD": new IntData(14*24*3600*1000),
            "governance_delegate::GOV_KEYS": new ListData([
                GOV_KEY_1.toUplcData(),
                GOV_KEY_2.toUplcData(),
                GOV_KEY_3.toUplcData()
            ]),
            "oracle_delegate::ORACLE_KEYS": new ListData([
                ORACLE_KEY_1.toUplcData(),
                ORACLE_KEY_2.toUplcData(),
                ORACLE_KEY_3.toUplcData()
            ])
        }
    })

export default context

export {}
