import { strictEqual } from "node:assert"
import { type IntLike } from "@helios-lang/codec-utils"
import {
    type PermissiveType,
    type StrictType
} from "@helios-lang/contract-utils"
import contract from "pbg-token-validators-test-context"

export const castPortfolio = contract.PortfolioModule.Portfolio
export type PortfolioType = PermissiveType<typeof castPortfolio>
type PortfolioStrictType = StrictType<typeof castPortfolio>

export const castPortfolioAction = contract.portfolio_validator.Action
export type PortfolioActionType = PermissiveType<typeof castPortfolioAction>

export const castPortfolioReduction =
    contract.PortfolioModule.PortfolioReduction
export type PortfolioReductionType = PermissiveType<
    typeof castPortfolioReduction
>

export const castPortfolioReductionMode =
    contract.PortfolioModule.PortfolioReductionMode
export type PortfolioReductionModeType = PermissiveType<
    typeof castPortfolioReductionMode
>

export function makePortfolio(props?: {
    nGroups?: IntLike
    state?: PortfolioReductionType
}): PortfolioStrictType {
    return {
        n_groups: BigInt(props?.nGroups ?? 0n),
        reduction: castPortfolioReduction.fromUplcData(
            castPortfolioReduction.toUplcData(props?.state ?? { Idle: {} })
        )
    }
}

export function equalsPortfolioReductionMode(
    actual: PortfolioReductionModeType,
    expected: PortfolioReductionModeType
) {
    const actualData = castPortfolioReductionMode.toUplcData(actual)
    const expectedData = castPortfolioReductionMode.toUplcData(expected)

    strictEqual(actualData.toSchemaJson(), expectedData.toSchemaJson())
}
