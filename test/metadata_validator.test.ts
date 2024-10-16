import { strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { dummyBytes } from "@helios-lang/codec-utils"
import { blake2b } from "@helios-lang/crypto"
import { PubKeyHash } from "@helios-lang/ledger"
import { IntData } from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"
import { MAX_SCRIPT_SIZE } from "./constants"
import {
    ConfigChangeProposal,
    ConfigType,
    castMetadata,
    makeConfig,
    makeMetadata
} from "./data"
import { ScriptContextBuilder } from "./tx"

const { main } = contract.metadata_validator

describe("metadata_validator::main", () => {
    const metadata = makeMetadata()
    const redeemer = new IntData(0)
    const actualHash = blake2b(castMetadata.toUplcData(metadata).toCbor())

    const configureContext = (props?: {
        config?: ConfigType
        hash?: number[]
        proposal?: ConfigChangeProposal
    }) => {
        const hash = props?.hash ?? actualHash

        const config =
            props?.config ??
            makeConfig({
                state: {
                    Changing: {
                        proposal_timestamp: 0,
                        proposal: props?.proposal ?? {
                            ChangingMetadata: {
                                metadata_hash: hash
                            }
                        }
                    }
                }
            })
        return new ScriptContextBuilder()
            .addConfigInput({ config })
            .addMetadataInput({ metadata, redeemer })
            .addMetadataOutput({ metadata })
    }

    it("succeeds if the metadata hash corresponds to the new metadata", () => {
        configureContext().use((ctx) => {
            main.eval({ $scriptContext: ctx, $datum: metadata, _: redeemer })
        })
    })

    it("throws an error if the hash doesn't correspond to the new metadata", () => {
        configureContext({ hash: dummyBytes(32, 0) }).use((ctx) => {
            throws(() => {
                main.eval({
                    $scriptContext: ctx,
                    $datum: metadata,
                    _: redeemer
                })
            })
        })
    })

    it("throws an error if not ChangingMetadata state", () => {
        configureContext({
            proposal: {
                ChangingAgent: {
                    agent: new PubKeyHash(actualHash.slice(0, 28))
                }
            }
        }).use((ctx) => {
            throws(() => {
                main.eval({
                    $scriptContext: ctx,
                    $datum: metadata,
                    _: redeemer
                })
            })
        })
    })

    it("throws an error if in Idle state", () => {
        configureContext({ config: makeConfig() }).use((ctx) => {
            throws(() => {
                main.eval({
                    $scriptContext: ctx,
                    $datum: metadata,
                    _: redeemer
                })
            })
        })
    })
})

describe("metadata_validator metrics", () => {
    const program = contract.metadata_validator.$hash.context.program
    
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