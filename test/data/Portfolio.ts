import { PermissiveType, StrictType } from "@helios-lang/contract-utils"
import contract from "pbg-token-validators-test-context"

export const castPortfolio = contract.PortfolioModule.Portfolio
export type PortfolioType = PermissiveType<typeof castPortfolio>
type PortfolioStrictType = StrictType<typeof castPortfolio>

export const castPortfolioAction = contract.portfolio_validator.Action
export type PortfolioActionType = PermissiveType<typeof castPortfolioAction>

export function makePortfolio(): PortfolioStrictType {
    return {
        n_groups: 0n,
        reduction: { Idle: {} }
    }
}
