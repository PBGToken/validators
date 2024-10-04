export const scripts = [
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

export const directPolicyScripts = [
    "fund_policy",
    "mint_order_validator",
    "burn_order_validator",
    "oracle_delegate",
    "benchmark_delegate",
    "governance_delegate"
]

// the reimbursement_validator is a special case and not included in this list
export const indirectPolicyScripts = [
    "supply_validator",
    "assets_validator",
    "portfolio_validator",
    "price_validator",
    "voucher_validator",
    "config_validator",
    "metadata_validator"
]

export const orderValidatorScripts = [
    "mint_order_validator",
    "burn_order_validator"
]
