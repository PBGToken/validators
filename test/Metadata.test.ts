import { describe, it } from "node:test"
import contract from "pbg-token-validators-test-context"
import { ScriptContextBuilder } from "./tx"
import { IntData } from "@helios-lang/uplc"
import { makeMetadata } from "./data"
import { indirectPolicyScripts, scripts } from "./constants"
import { deepEqual, throws } from "node:assert"
import { makeConfigToken, makeMetadataToken } from "./tokens"
import { Address } from "@helios-lang/ledger"

const {
    "Metadata::find_input": find_input,
    "Metadata::find_output": find_output,
    "Metadata::find_thread": find_thread
} = contract.MetadataModule

describe("MetadataModule::Metadata::find_input", () => {
    const metadata = makeMetadata()

    describe("for the validators that don't have direct access to the policy", () => {
        it("throws an error if the metadata UTxO is the current input and contains more than 1 metadata token", () => {
            new ScriptContextBuilder()
                .addMetadataInput({
                    metadata,
                    token: makeMetadataToken(2),
                    redeemer: new IntData(0)
                })
                .use((ctx) => {
                    indirectPolicyScripts.forEach((currentScript) => {
                        throws(() => {
                            find_input.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                        })
                    })
                })
        })
    })

    describe("for all validators", () => {
        it("returns the metadata if the metadata UTxO is the current input", () => {
            new ScriptContextBuilder()
                .addMetadataInput({
                    metadata,
                    redeemer: new IntData(0)
                })
                .use((ctx) => {
                    scripts.forEach((currentScript) => {
                        const actual = find_input.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })
                        deepEqual(actual, metadata)
                    })
                })
        })

        it("returns the metadata if the metadata UTxO contains more than 1 metadata token but isn't the current input ", () => {
            new ScriptContextBuilder()
                .addMetadataInput({
                    metadata,
                    token: makeMetadataToken(2)
                })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    scripts.forEach((currentScript) => {
                        const actual = find_input.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })
                        deepEqual(actual, metadata)
                    })
                })
        })

        it("throws an error if the metadata UTxO doesn't contain the metadata token", () => {
            new ScriptContextBuilder()
                .addMetadataInput({
                    metadata,
                    token: makeConfigToken(),
                    redeemer: new IntData(0)
                })
                .use((ctx) => {
                    scripts.forEach((currentScript) => {
                        throws(() => {
                            find_input.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                        })
                    })
                })
        })

        it("throws an error if the metadata UTxO isn't at the metadata_validator address", () => {
            new ScriptContextBuilder()
                .addMetadataInput({
                    metadata,
                    address: Address.dummy(false),
                    redeemer: new IntData(0)
                })
                .use((ctx) => {
                    scripts.forEach((currentScript) => {
                        throws(() => {
                            find_input.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                        })
                    })
                })
        })
    })
})

describe("MetadataModule::Metadata::find_output", () => {
    const metadata = makeMetadata()

    describe("for all validators", () => {
        it("returns the metadata if the metadata UTxO is returned to the metadata_validator address with the metadata token", () => {
            new ScriptContextBuilder()
                .addMetadataOutput({
                    metadata
                })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    scripts.forEach((currentScript) => {
                        const actual = find_output.eval({
                            $currentScript: currentScript,
                            $scriptContext: ctx
                        })
                        deepEqual(actual, metadata)
                    })
                })
        })

        it("throws an error if the output metadata UTxO contains more than 1 metadata token", () => {
            new ScriptContextBuilder()
                .addMetadataOutput({
                    metadata,
                    token: makeMetadataToken(2)
                })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    scripts.forEach((currentScript) => {
                        throws(() => {
                            find_output.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                        })
                    })
                })
        })

        it("throws an error if the output metadata UTxO doesn't contain the metadata token", () => {
            new ScriptContextBuilder()
                .addMetadataOutput({
                    metadata,
                    token: makeConfigToken()
                })
                .redeemDummyTokenWithDvpPolicy()
                .use((ctx) => {
                    scripts.forEach((currentScript) => {
                        throws(() => {
                            find_output.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                        })
                    })
                })
        })

        it("throws an error if the metadata UTxO is sent to the wrong address", () => {
            new ScriptContextBuilder()
                .addMetadataOutput({
                    metadata,
                    address: Address.dummy(false)
                })
                .use((ctx) => {
                    scripts.forEach((currentScript) => {
                        throws(() => {
                            find_output.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            })
                        })
                    })
                })
        })
    })
})

describe("MetadataModule::Metadata::find_thread", () => {
    const metadata = makeMetadata()

    describe("for all validators", () => {
        it("returns the metadata twice if the metadata UTxO remains unchanged when spent and returned", () => {
            new ScriptContextBuilder()
                .addMetadataThread({
                    metadata,
                    redeemer: new IntData(0)
                })
                .use((ctx) => {
                    scripts.forEach((currentScript) => {
                        deepEqual(
                            find_thread.eval({
                                $currentScript: currentScript,
                                $scriptContext: ctx
                            }),
                            [metadata, metadata]
                        )
                    })
                })
        })
    })
})
