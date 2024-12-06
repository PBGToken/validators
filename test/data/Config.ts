import { strictEqual } from "node:assert"
import { type IntLike } from "@helios-lang/codec-utils"
import { type PermissiveType, type StrictType } from "@helios-lang/contract-utils"
import { makeDummyPubKeyHash, type PubKeyHash, type StakingValidatorHash } from "@helios-lang/ledger"
import contract from "pbg-token-validators-test-context"

export const castConfigChangeProposal =
    contract.ConfigModule.ConfigChangeProposal
export type ConfigChangeProposal = PermissiveType<
    typeof castConfigChangeProposal
>

export const castConfigState = contract.ConfigModule.ConfigState
export type ConfigStateType = PermissiveType<typeof castConfigState>

export const castConfig = contract.ConfigModule.Config
export type ConfigType = PermissiveType<typeof castConfig>
type ConfigStrictType = StrictType<typeof castConfig>

export function makeConfig(props?: {
    agent?: PubKeyHash
    benchmark?: StakingValidatorHash
    oracle?: StakingValidatorHash
    governance?: {
        updateDelay?: IntLike
        delegate?: StakingValidatorHash
    }
    token?: {
        maxPriceAge?: IntLike
        maxSupply?: IntLike
    }
    burnFee?: {
        relative?: number
        minimum?: IntLike
    }
    mintFee?: {
        relative?: number
        minimum?: IntLike
    }
    relManagementFee?: number
    managementFeePeriod?: IntLike
    minReimbursement?: IntLike
    successFee?: {
        c0?: number
        steps?: PermissiveType<
            typeof contract.SuccessFeeModule.SuccessFeeStep
        >[]
    }
    state?: ConfigStateType
}): ConfigStrictType {
    const state = castConfigState.fromUplcData(
        castConfigState.toUplcData(props?.state ?? { Idle: {} })
    )

    return {
        agent: props?.agent ?? makeDummyPubKeyHash(99999),
        fees: {
            mint_fee: {
                relative: props?.mintFee?.relative ?? 0,
                minimum: BigInt(props?.mintFee?.minimum ?? 0)
            },
            burn_fee: {
                relative: props?.burnFee?.relative ?? 0,
                minimum: BigInt(props?.burnFee?.minimum ?? 0)
            },
            management_fee: {
                relative: props?.relManagementFee ?? 0.0001,
                period: BigInt(
                    props?.managementFeePeriod ?? 24n * 60n * 60n * 1000n
                )
            },
            success_fee: {
                fee: {
                    c0: props?.successFee?.c0 ?? 0,
                    steps: props?.successFee?.steps ?? []
                },
                benchmark:
                    props?.benchmark ?? contract.benchmark_delegate.$hash,
                min_reimbursement: BigInt(props?.minReimbursement ?? 20_000n)
            }
        },
        token: {
            max_price_age: BigInt(props?.token?.maxPriceAge ?? 0),
            max_supply: BigInt(props?.token?.maxSupply ?? 0)
        },
        oracle: props?.oracle ?? contract.oracle_delegate.$hash,
        governance: {
            update_delay: BigInt(props?.governance?.updateDelay ?? 0),
            delegate:
                props?.governance?.delegate ??
                contract.governance_delegate.$hash
        },
        state
    }
}

/**
 * Comparse the UplcData schema internally
 * Throws an error if not equal
 */
export function equalsConfig(
    actual: ConfigStrictType,
    expected: ConfigStrictType
) {
    const actualData = castConfig.toUplcData(actual)
    const expectedData = castConfig.toUplcData(expected)

    strictEqual(actualData.toSchemaJson(), expectedData.toSchemaJson())
}

/**
 * Compares the UplcData schema internally
 * Throws an error if not equal
 */
export function equalsConfigChangeProposal(
    actual: ConfigChangeProposal,
    expected: ConfigChangeProposal
) {
    const actualData = castConfigChangeProposal.toUplcData(actual)
    const expectedData = castConfigChangeProposal.toUplcData(expected)

    strictEqual(actualData.toSchemaJson(), expectedData.toSchemaJson())
}
