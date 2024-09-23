import { IntLike } from "@helios-lang/codec-utils"
import { PermissiveType, StrictType } from "@helios-lang/contract-utils"
import { AssetClass, TimeLike, toTime } from "@helios-lang/ledger"
import { strictEqual } from "node:assert"
import contract from "pbg-token-validators-test-context"

export const castAsset = contract.AssetModule.Asset
export type AssetType = PermissiveType<typeof castAsset>
type AssetStrictType = StrictType<typeof castAsset>

export function makeAsset(props?: {
    assetClass?: AssetClass
    count?: IntLike
    price?: [IntLike, IntLike]
    priceTimestamp?: TimeLike
}): AssetStrictType {
    return {
        asset_class: props?.assetClass ?? AssetClass.dummy(),
        count: BigInt(props?.count ?? 0n),
        price: props?.price
            ? [BigInt(props?.price[0]), BigInt(props?.price[1])]
            : [0n, 1n],
        price_timestamp: toTime(props?.priceTimestamp ?? 0)
    }
}

/**
 * Converts to UplcData internally
 * Throws an error if unequal
 */
export function equalsAsset(actual: AssetType, expected: AssetType) {
    const actualData = castAsset.toUplcData(actual)
    const expectedData = castAsset.toUplcData(expected)

    strictEqual(actualData.toSchemaJson(), expectedData.toSchemaJson())
}
