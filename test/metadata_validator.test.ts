import { describe, it } from "node:test"
import contract from "pbg-token-validators-test-context"
import { ScriptContextBuilder } from "./tx"
import {
    ConfigChangeProposal,
    ConfigType,
    castMetadata,
    makeConfig,
    makeMetadata
} from "./data"
import { IntData } from "@helios-lang/uplc"
import { blake2b } from "@helios-lang/crypto"
import { throws } from "node:assert"
import { dummyBytes } from "@helios-lang/codec-utils"
import { PubKeyHash } from "@helios-lang/ledger"

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
