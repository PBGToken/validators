import { strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { PubKeyHash } from "@helios-lang/ledger"
import { IntData } from "@helios-lang/uplc"
import contract, {
    ORACLE_KEY_1,
    ORACLE_KEY_2,
    ORACLE_KEY_3
} from "pbg-token-validators-test-context"
import { MAX_SCRIPT_SIZE } from "./constants"
import { ScriptContextBuilder } from "./tx"

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

    it("oracle_delegate::main #01 (succeeds if signed by all gov keys)", () => {
        configureContext().use((ctx) => {
            main.eval({ $scriptContext: ctx, _: redeemer })
        })
    })

    it("oracle_delegate::main #02 (succeeds if signed by majority)", () => {
        configureContext({ oracleKey3: PubKeyHash.dummy() }).use((ctx) => {
            main.eval({ $scriptContext: ctx, _: redeemer })
        })
    })

    it("oracle_delegate::main #03 (throws an error if only signed by one key)", () => {
        configureContext({
            oracleKey2: PubKeyHash.dummy(),
            oracleKey3: PubKeyHash.dummy()
        }).use((ctx) => {
            throws(() => {
                main.eval({ $scriptContext: ctx, _: redeemer })
            })
        })
    })

    it("oracle_delegate::main #04 (throws an error if not signed by any keys)", () => {
        new ScriptContextBuilder().use((ctx) => {
            throws(() => {
                main.eval({ $scriptContext: ctx, _: redeemer })
            })
        })
    })
})

describe("oracle_delegate metrics", () => {
    const program = contract.oracle_delegate.$hash.context.program
    
    const n = program.toCbor().length

    it(`program doesn't exceed ${MAX_SCRIPT_SIZE} bytes (${n})`, () => {    
        if (n > MAX_SCRIPT_SIZE) {
            throw new Error("program too large")
        }
    })

    const ir = program.ir

    if (ir) {
        it("ir doesn't contain trace", () => {
            strictEqual(!!/__core__trace/.exec(ir), false)
        })
    }  
})