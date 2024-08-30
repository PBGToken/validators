import {
    ScriptContextV2,
    ScriptPurpose,
    TxInput,
    TxOutput,
    TxOutputDatum,
    TxOutputId,
    TxRedeemer,
    Value
} from "@helios-lang/ledger"
import contract from "pbg-token-validators-test-context"
import {
    SupplyType,
    castAssetGroup,
    castSupply,
    makeAsset,
    makeAssetGroup,
    makeSupply
} from "../data"
import { Addresses } from "../constants"
import { makeAssetsToken, makeSupplyToken } from "../tokens"

type SpendAssetsProps = {
    id: number
    supply?: SupplyType
}

export function spendAssets(props: SpendAssetsProps) {
    const assetGroup = makeAssetGroup({
        assets: [makeAsset({})]
    })

    const value = new Value(2_000_000, makeAssetsToken(props.id))
    const datumData = castAssetGroup.toUplcData(assetGroup)

    const input = new TxInput(
        TxOutputId.dummy(),
        new TxOutput(
            Addresses.assetsValidator,
            value,
            TxOutputDatum.Inline(datumData)
        )
    )

    const refInputs: TxInput[] = []

    refInputs.push(
        new TxInput(
            TxOutputId.dummy(),
            new TxOutput(
                Addresses.supplyValidator,
                new Value(2_000_000, makeSupplyToken(0)),
                TxOutputDatum.Inline(
                    castSupply.toUplcData(props.supply ?? makeSupply({}))
                )
            )
        )
    )

    const output = new TxOutput(
        Addresses.assetsValidator,
        value,
        TxOutputDatum.Inline(datumData)
    )

    const purpose = ScriptPurpose.Spending(
        TxRedeemer.Spending(
            0,
            contract.assets_validator.Action.toUplcData({
                Count: { supply_ptr: 0 }
            })
        ),
        TxOutputId.dummy()
    )

    const ctx = new ScriptContextV2(
        {
            inputs: [input],
            outputs: [output]
        },
        purpose
    )

    return ctx.toUplcData()
}
