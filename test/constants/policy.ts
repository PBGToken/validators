import { MintingPolicyHash } from "@helios-lang/ledger"
import contract from "pbg-token-validators-test-context"

export const policy = new MintingPolicyHash(
    contract.fund_policy.$hash.bytes,
    contract.fund_policy.$hash.context
)
