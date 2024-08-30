import {
    Address,
    Assets,
    ScriptContextV2,
    ScriptPurpose,
    TxInput,
    TxOutput,
    TxOutputDatum,
    TxOutputId,
    TxRedeemer,
    Value
} from "@helios-lang/ledger"
import { IntData } from "@helios-lang/uplc"
import { Addresses } from "../constants"
import {
    PriceType,
    SupplyType,
    castPrice,
    castSupply,
    makePrice
} from "../data"
import { makePriceToken, makeSupplyToken } from "../tokens"
import { ScriptContextBuilder } from "./ScriptContextBuilder"

type SpendPriceProps = {
    price?: PriceType
    supply?: SupplyType
    supplyAddr?: Address
    supplyToken?: Assets
}

export function spendPrice(props: SpendPriceProps) {
    return new ScriptContextBuilder()
        .addPriceInput({ price: props.price, redeemer: new IntData(0) })
        .addSupplyRef(
            {
                supply: props.supply,
                address: props.supplyAddr,
                token: props.supplyToken
            },
            !!props.supply
        )
        .addPriceOutput()
        .build()
}
