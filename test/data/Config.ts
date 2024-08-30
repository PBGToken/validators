import { PermissiveType } from "@helios-lang/contract-utils"
import {
    PubKeyHash,
    StakingValidatorHash,
    TxInfo,
    TxInput,
    TxOutput,
    TxOutputDatum,
    TxOutputId,
    Value
} from "@helios-lang/ledger"
import contract from "pbg-token-validators-test-context"
import { Addresses } from "../constants"
import { makeConfigToken } from "../tokens"

export const castConfig = contract.ConfigModule.Config

export type ConfigType = PermissiveType<typeof castConfig>

type MakeConfigProps = {
    relManagementFee?: number
    successFee?: {
        c0?: number
        steps?: PermissiveType<
            typeof contract.SuccessFeeModule.SuccessFeeStep
        >[]
    }
}

export function makeConfig(props?: MakeConfigProps): ConfigType {
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
                relative: props?.relManagementFee ?? 0.0001,
                period: 24 * 60 * 60 * 1000
            },
            success_fee: {
                fee: {
                    c0: props?.successFee?.c0 ?? 0,
                    steps: props?.successFee?.steps ?? []
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

/**
 * Mutates txInfo
 */
export function refConfig(txInfo: TxInfo, config: ConfigType) {
    const refInput = new TxInput(
        TxOutputId.dummy(),
        new TxOutput(
            Addresses.configValidator,
            new Value(2_000_000n, makeConfigToken()),
            TxOutputDatum.Inline(castConfig.toUplcData(config))
        )
    )

    if (txInfo.refInputs) {
        txInfo.refInputs.push(refInput)
    } else {
        txInfo.refInputs = [refInput]
    }
}
