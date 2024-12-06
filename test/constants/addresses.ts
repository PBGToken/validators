import { makeShelleyAddress, makeValidatorHash } from "@helios-lang/ledger"
import contract from "pbg-token-validators-test-context"

export const assetsValidator = makeShelleyAddress(
    false,
    contract.assets_validator.$hash
)

export const burnOrderValidator = makeShelleyAddress(
    false,
    contract.burn_order_validator.$hash
)

export const configValidator = makeShelleyAddress(
    false,
    contract.config_validator.$hash
)

export const metadataValidator = makeShelleyAddress(
    false,
    contract.metadata_validator.$hash
)

export const mintOrderValidator = makeShelleyAddress(
    false,
    contract.mint_order_validator.$hash
)

export const portfolioValidator = makeShelleyAddress(
    false,
    contract.portfolio_validator.$hash
)

export const priceValidator = makeShelleyAddress(
    false,
    contract.price_validator.$hash
)

export const reimbursementValidator = makeShelleyAddress(
    false,
    contract.reimbursement_validator.$hash
)

export const supplyValidator = makeShelleyAddress(
    false,
    contract.supply_validator.$hash
)

export const vault = makeShelleyAddress(
    false,
    makeValidatorHash(
        contract.fund_policy.$hash.bytes,
        contract.fund_policy.$hash.context
    )
)

export const voucherValidator = makeShelleyAddress(
    false,
    contract.voucher_validator.$hash
)
