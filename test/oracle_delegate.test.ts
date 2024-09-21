import { describe, it } from "node:test"
import contract, {
    ORACLE_KEY_1,
    ORACLE_KEY_2,
    ORACLE_KEY_3
} from "pbg-token-validators-test-context"
import { ScriptContextBuilder } from "./tx"
import { PubKeyHash } from "@helios-lang/ledger"
import { IntData } from "@helios-lang/uplc"
import { throws } from "node:assert"

const { main } = contract.oracle_delegate

describe("oracle_delegate::main", () => {
    const redeemer = new IntData(0)
    const configureContext = (props?: {
        oracleKey2?: PubKeyHash
        oracleKey3?: PubKeyHash
    }) => {
        return new ScriptContextBuilder()
            .addSigner(ORACLE_KEY_1)
            .addSigner(props?.oracleKey2 ?? ORACLE_KEY_2)
            .addSigner(props?.oracleKey3 ?? ORACLE_KEY_3)
    }

    it("succeeds if signed by all gov keys", () => {
        configureContext().use((ctx) => {
            main.eval({ $scriptContext: ctx, _: redeemer })
        })
    })

    it("succeeds if signed by majority", () => {
        configureContext({ oracleKey3: PubKeyHash.dummy() }).use((ctx) => {
            main.eval({ $scriptContext: ctx, _: redeemer })
        })
    })

    it("throws an error if only signed by one key", () => {
        configureContext({
            oracleKey2: PubKeyHash.dummy(),
            oracleKey3: PubKeyHash.dummy()
        }).use((ctx) => {
            throws(() => {
                main.eval({ $scriptContext: ctx, _: redeemer })
            })
        })
    })

    it("throws an error if not signed by any keys", () => {
        new ScriptContextBuilder().use((ctx) => {
            throws(() => {
                main.eval({ $scriptContext: ctx, _: redeemer })
            })
        })
    })
})
