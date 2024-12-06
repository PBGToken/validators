import { type PermissiveType, type StrictType } from "@helios-lang/contract-utils"
import contract from "pbg-token-validators-test-context"

export const castMetadata = contract.MetadataModule.Metadata
export type MetadataType = PermissiveType<typeof castMetadata>
type MetadataStrictType = StrictType<typeof castMetadata>

export function makeMetadata(props?: {
    name?: string
    description?: string
    decimals?: number
    ticker?: string
    url?: string
    logo?: string
}): MetadataStrictType {
    return {
        Cip68: {
            metadata: {
                name: props?.name ?? "test_dvp",
                description: props?.description ?? "for test only",
                decimals: BigInt(props?.decimals ?? 6),
                ticker: props?.ticker ?? "tDVP",
                url: props?.url ?? "https://www.example.com",
                logo: props?.logo ?? "https://www.example.com/logo.png"
            },
            version: 1n,
            extra: {
                Unused: {}
            }
        }
    }
}
