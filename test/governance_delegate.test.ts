import { describe, it } from "node:test"
import contract, {
    GOV_KEY_1,
    GOV_KEY_2,
    GOV_KEY_3
} from "pbg-token-validators-test-context"
import { ScriptContextBuilder } from "./tx"
import { PubKeyHash } from "@helios-lang/ledger"
import { IntData } from "@helios-lang/uplc"
import { throws } from "node:assert"

const { main } = contract.governance_delegate

describe("governance_delegate::main", () => {
    const redeemer = new IntData(0)
    const configureContext = (props?: {
        govKey2?: PubKeyHash
        govKey3?: PubKeyHash
    }) => {
        return new ScriptContextBuilder()
            .addSigner(GOV_KEY_1)
            .addSigner(props?.govKey2 ?? GOV_KEY_2)
            .addSigner(props?.govKey3 ?? GOV_KEY_3)
    }

    it("succeeds if signed by all gov keys", () => {
        configureContext().use((ctx) => {
            main.eval({ $scriptContext: ctx, _: redeemer })
        })
    })

    it("succeeds if signed by majority", () => {
        configureContext({ govKey3: PubKeyHash.dummy() }).use((ctx) => {
            main.eval({ $scriptContext: ctx, _: redeemer })
        })
    })

    it("throws an error if only signed by one key", () => {
        configureContext({
            govKey2: PubKeyHash.dummy(),
            govKey3: PubKeyHash.dummy()
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
