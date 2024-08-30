import { PermissiveType, StrictType } from "@helios-lang/contract-utils"
import { AssetClass } from "@helios-lang/ledger"
import contract from "pbg-token-validators-test-context"

export const castAsset = contract.AssetModule.Asset
export type AssetType = PermissiveType<typeof castAsset>
type AssetStrictType = StrictType<typeof castAsset>

type MakeAssetProps = {}

export function makeAsset(props: MakeAssetProps): AssetStrictType {
    return {
        asset_class: AssetClass.dummy(),
        count: 0n,
        count_tick: 0n,
        price: [0n, 0n],
        price_timestamp: 0
    }
}
