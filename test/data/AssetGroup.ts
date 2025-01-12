import {
    type PermissiveType,
    type StrictType
} from "@helios-lang/contract-utils"
import contract from "pbg-token-validators-test-context"
import { AssetType } from "./Asset"

export const castAssetGroup = contract.AssetGroupModule.AssetGroup
export type AssetGroupType = PermissiveType<typeof castAssetGroup>
type AssetGroupStrictType = StrictType<typeof castAssetGroup>
export const castAssetGroupAction = contract.assets_validator.Action
export type AssetGroupAction = PermissiveType<typeof castAssetGroupAction>

type MakeAssetGroupProps = {
    assets: AssetType[]
}

export function makeAssetGroup(
    props: MakeAssetGroupProps
): AssetGroupStrictType {
    // use case to/from UplcData to convert Permissive type input to Strict type
    return castAssetGroup.fromUplcData(
        castAssetGroup.toUplcData({
            assets: props.assets
        })
    )
}
