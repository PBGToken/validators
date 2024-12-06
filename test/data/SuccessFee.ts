import { type PermissiveType } from "@helios-lang/contract-utils"
import contract from "pbg-token-validators-test-context"

export const castSuccessFee = contract.SuccessFeeModule.SuccessFee
export type SuccessFeeType = PermissiveType<typeof castSuccessFee>

export function makeSuccessFee(props?: {
    c0?: number
    steps?: { c: number; sigma: number }[]
}): SuccessFeeType {
    const c0 = props?.c0 ?? 0.0
    const steps = props?.steps ?? [{ sigma: 1.05, c: 0.3 }]

    return {
        c0,
        steps
    }
}
