import { UplcData } from "@helios-lang/uplc"
import { SupplyType, makeAsset } from "../data"
import { ScriptContextBuilder } from "./ScriptContextBuilder"

type SpendAssetsProps = {
    id: number
    supply?: SupplyType
}

export function spendAssets(props: SpendAssetsProps): UplcData {
    const assets = [makeAsset()]

    return new ScriptContextBuilder()
        .addAssetGroupThread({
            id: props.id,
            inputAssets: assets,
            outputAssets: assets,
            redeemer: {
                Count: { supply_ptr: 0 }
            }
        })
        .addSupplyRef({ supply: props.supply })
        .build()
}
