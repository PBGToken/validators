import { makeCast, type PermissiveType, type StrictType } from "@helios-lang/contract-utils"
import contract from "pbg-token-validators-test-context"

export const castAssetPtr = contract.AssetPtrModule.AssetPtr
export type AssetPtrType = PermissiveType<typeof castAssetPtr>
type AssetPtrStrictType = StrictType<typeof castAssetPtr>

export const castAssetPtrs = makeCast<AssetPtrStrictType[], AssetPtrType[]>(
    {
        kind: "list",
        itemType: castAssetPtr.schema
    },
    {
        isMainnet: false
    }
)

export function makeAssetPtr(props?: {
    groupIndex?: number
    assetClassIndex?: number
}): AssetPtrStrictType {
    return {
        group_index: BigInt(props?.groupIndex ?? 0),
        asset_class_index: BigInt(props?.assetClassIndex ?? 0)
    }
}
