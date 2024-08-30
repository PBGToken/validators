import { ContractContextBuilder } from "@helios-lang/contract-utils"
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
        isMainnet: false
    })

export default context
