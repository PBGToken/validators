import { makeContractContextBuilder } from "@helios-lang/contract-utils"
import { makeDummyPubKeyHash, makeDummyTxOutputId } from "@helios-lang/ledger"
import { makeIntData, makeListData } from "@helios-lang/uplc"
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

export const SEED_ID = makeDummyTxOutputId(999999) // something very large in order not to conflict with auto-generated ids in ScriptContextBuilder
export const INITIAL_AGENT = makeDummyPubKeyHash()
export const GOV_KEY_1 = makeDummyPubKeyHash(456)
export const GOV_KEY_2 = makeDummyPubKeyHash(457)
export const GOV_KEY_3 = makeDummyPubKeyHash(458)
export const ORACLE_KEY_1 = makeDummyPubKeyHash(459)
export const ORACLE_KEY_2 = makeDummyPubKeyHash(460)
export const ORACLE_KEY_3 = makeDummyPubKeyHash(461)

const context = makeContractContextBuilder()
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
        debug: false, // if `true`: significantly blows up the size of the bundle
        parameters: {
            "fund_policy::SEED_ID": SEED_ID.toUplcData(),
            "fund_policy::INITIAL_AGENT": INITIAL_AGENT.toUplcData(),
            "fund_policy::INITIAL_CYCLE_PERIOD": makeIntData(
                365 * 24 * 3600 * 1000
            ),
            "governance_delegate::GOV_KEYS": makeListData([
                GOV_KEY_1.toUplcData(),
                GOV_KEY_2.toUplcData(),
                GOV_KEY_3.toUplcData()
            ]),
            "oracle_delegate::ORACLE_KEYS": makeListData([
                ORACLE_KEY_1.toUplcData(),
                ORACLE_KEY_2.toUplcData(),
                ORACLE_KEY_3.toUplcData()
            ])
        }
    })

export default context

export {}
