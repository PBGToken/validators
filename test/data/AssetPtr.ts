import { Cast, PermissiveType, StrictType } from "@helios-lang/contract-utils"
import contract from "pbg-token-validators-test-context"

export const castAssetPtr = contract.AssetPtrModule.AssetPtr
export type AssetPtrType = PermissiveType<typeof castAssetPtr>
type AssetPtrStrictType = StrictType<typeof castAssetPtr>

export const castAssetPtrs = new Cast<AssetPtrStrictType[], AssetPtrType[]>(
    {
        kind: "list",
        itemType: castAssetPtr.schema
    },
    {
        isMainnet: false
    }
)
