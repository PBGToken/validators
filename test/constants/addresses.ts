import { Address, ValidatorHash } from "@helios-lang/ledger"
import contract from "pbg-token-validators-test-context"

export const assetsValidator = Address.fromHash(
    false,
    contract.assets_validator.$hash
)

export const configValidator = Address.fromHash(
    false,
    contract.config_validator.$hash
)

export const metadataValidator = Address.fromHash(
    false,
    contract.metadata_validator.$hash
)

export const portfolioValidator = Address.fromHash(
    false,
    contract.portfolio_validator.$hash
)

export const priceValidator = Address.fromHash(
    false,
    contract.price_validator.$hash
)

export const reimbursementValidator = Address.fromHash(
    false,
    contract.reimbursement_validator.$hash
)

export const supplyValidator = Address.fromHash(
    false,
    contract.supply_validator.$hash
)

export const vault = Address.fromHash(
    false,
    new ValidatorHash(
        contract.fund_policy.$hash.bytes,
        contract.fund_policy.$hash.context
    )
)

export const voucherValidator = Address.fromHash(
    false,
    contract.voucher_validator.$hash
)
