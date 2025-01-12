import { strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { IntLike } from "@helios-lang/codec-utils"
import {
    makeDummyAddress,
    type PubKeyHash,
    makeDummyPubKeyHash
} from "@helios-lang/ledger"
import { makeIntData } from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"
import { MAX_SCRIPT_SIZE } from "./constants"
import { makeConfig, makeVoucher, VoucherType, wrapVoucher } from "./data"
import { makeVoucherPair, makeVoucherUserToken } from "./tokens"
import { ScriptContextBuilder } from "./tx"

const { main } = contract.voucher_validator

describe("voucher_validator::main", () => {
    const periodId = 1
    const configureVoucher = (props?: { periodId?: number }) => {
        return makeVoucher({
            periodId: props?.periodId ?? periodId,
            address: makeDummyAddress(false, 0),
            datum: makeIntData(0),
            tokens: 1000
        })
    }

    const configureContext = (props?: {
        signingAgent?: PubKeyHash | null
        nVoucherPairsBurned?: IntLike
        nVoucherUserTokensBurned?: IntLike
        burnedVoucherId?: IntLike
        spentReimbursementPeriodId?: IntLike
        voucher?: VoucherType
    }) => {
        const voucher = props?.voucher ?? configureVoucher()
        const voucherId = 1
        const scb = new ScriptContextBuilder().addVoucherInput({
            id: voucherId,
            voucher,
            redeemer: makeIntData(0)
        })

        const agent = props?.signingAgent ?? makeDummyPubKeyHash()
        const config = makeConfig({ agent })
        scb.addConfigRef({ config })

        if (props?.signingAgent !== null) {
            scb.addSigner(agent)
        }

        if (props?.nVoucherPairsBurned) {
            scb.mint({
                assets: makeVoucherPair(
                    props?.burnedVoucherId ?? voucherId,
                    -props.nVoucherPairsBurned
                )
            })
        } else if (props?.nVoucherUserTokensBurned) {
            scb.mint({
                assets: makeVoucherUserToken(
                    props?.burnedVoucherId ?? voucherId,
                    -props.nVoucherUserTokensBurned
                )
            })
        }

        if (props?.spentReimbursementPeriodId) {
            scb.addReimbursementInput({ id: props.spentReimbursementPeriodId })
        }

        return scb
    }

    const defaulTestArgs = {
        $datum: wrapVoucher(configureVoucher()),
        _: makeIntData(0)
    }

    it("succeeds if signed by the agent and the voucher pair is burned", () => {
        configureContext({ nVoucherPairsBurned: 1 }).use((ctx) => {
            strictEqual(
                main.eval({
                    ...defaulTestArgs,
                    $scriptContext: ctx
                }),
                undefined
            )
        })
    })

    it("throws an error if a voucher pair is burned but the tx isn't signed by the agent", () => {
        configureContext({ nVoucherPairsBurned: 1, signingAgent: null }).use(
            (ctx) => {
                throws(() => {
                    main.eval({
                        ...defaulTestArgs,
                        $scriptContext: ctx
                    })
                }, /not signed by agent/)
            }
        )
    })

    it("throws an error if only the voucher user token is burned", () => {
        configureContext({ nVoucherUserTokensBurned: 1 }).use((ctx) => {
            throws(() => {
                main.eval({
                    ...defaulTestArgs,
                    $scriptContext: ctx
                })
            }, /voucher ref token not burned/)
        })
    })

    it("throws an error if the burned voucher id doesn't correspond to the spent voucher id", () => {
        configureContext({ burnedVoucherId: 2 }).use((ctx) => {
            throws(() => {
                main.eval({
                    ...defaulTestArgs,
                    $scriptContext: ctx
                })
            }, /not witnessed by reimbursement validator/)
        })
    })

    it("succeeds if the user token isn't burned but the tx is witnessed by the reimbursement UTxO of the same period is spent", () => {
        configureContext({ spentReimbursementPeriodId: 1 }).use((ctx) => {
            strictEqual(
                main.eval({
                    ...defaulTestArgs,
                    $scriptContext: ctx
                }),
                undefined
            )
        })
    })

    it("throws an error if the spent reimbursement UTxO is from another period", () => {
        configureContext({ spentReimbursementPeriodId: 2 }).use((ctx) => {
            throws(() => {
                main.eval({
                    ...defaulTestArgs,
                    $scriptContext: ctx
                })
            }, /not witnessed by reimbursement validator/)
        })
    })
})

describe("voucher_validator metrics", () => {
    const program = contract.voucher_validator.$hash.context.program

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
