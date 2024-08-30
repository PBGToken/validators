import {
    AssetClass,
    ScriptContextV2,
    ScriptPurpose,
    TxInfo,
    TxInput,
    TxOutput,
    TxOutputDatum,
    TxOutputId,
    TxRedeemer,
    Value
} from "@helios-lang/ledger"
import { ByteArrayData, IntData, UplcData } from "@helios-lang/uplc"
import { vault } from "../constants/addresses"
import { AssetType, ConfigType, castAssetGroup, refConfig } from "../data"

const datumData = new ByteArrayData([])
const redeemerData = new IntData(0)

type SpendVaultProps = {
    config?: ConfigType
    inputValue?: Value | Value[]
    outputValue?: Value | Value[]
    inputDatum?: UplcData
    outputDatum?: UplcData
}

export function spendVault(props: SpendVaultProps): UplcData {
    const txInfo: TxInfo = {
        inputs: [],
        outputs: []
    }

    let totalInputValue = new Value()
    let totalOutputValue = new Value()

    if (props.inputValue && Array.isArray(props.inputValue)) {
        props.inputValue.forEach((inputValue) => {
            totalInputValue = totalInputValue.add(inputValue)
            txInfo.inputs.push(
                new TxInput(
                    TxOutputId.dummy(),
                    new TxOutput(
                        vault,
                        inputValue,
                        TxOutputDatum.Inline(props.inputDatum ?? datumData)
                    )
                )
            )
        })
    } else {
        const inputValue = props.inputValue ?? new Value(2_000_000)
        totalInputValue = totalInputValue.add(inputValue)

        txInfo.inputs.push(
            new TxInput(
                TxOutputId.dummy(),
                new TxOutput(
                    vault,
                    inputValue,
                    TxOutputDatum.Inline(props.inputDatum ?? datumData)
                )
            )
        )
    }

    if (props.outputValue && Array.isArray(props.outputValue)) {
        props.outputValue.forEach((outputValue) => {
            totalOutputValue = totalOutputValue.add(outputValue)
            txInfo.outputs.push(
                new TxOutput(
                    vault,
                    outputValue,
                    TxOutputDatum.Inline(props.outputDatum ?? datumData)
                )
            )
        })
    } else {
        const outputValue = props.outputValue ?? new Value(2_000_000)
        totalOutputValue = totalOutputValue.add(outputValue)

        txInfo.outputs.push(
            new TxOutput(
                vault,
                outputValue,
                TxOutputDatum.Inline(props.outputDatum ?? datumData)
            )
        )
    }

    if (props.config) {
        refConfig(txInfo, props.config)
    }

    const purpose = ScriptPurpose.Spending(
        TxRedeemer.Spending(0, redeemerData),
        TxOutputId.dummy()
    )

    const ctx = new ScriptContextV2(
        {
            ...txInfo
        },
        purpose
    )

    return ctx.toUplcData()
}
