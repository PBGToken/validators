import { strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { IntLike } from "@helios-lang/codec-utils"
import { Address, PubKeyHash } from "@helios-lang/ledger"
import { IntData } from "@helios-lang/uplc"
import contract from "pbg-token-validators-test-context"
import { MAX_SCRIPT_SIZE } from "./constants"
import { makeConfig, makeVoucher } from "./data"
import { makeVoucherPair, makeVoucherUserToken } from "./tokens"
import { ScriptContextBuilder } from "./tx"

const { main } = contract.voucher_validator

describe("voucher_validator::main", () => {
    const periodId = 1
    const voucher = makeVoucher({
        periodId: periodId,
        address: Address.dummy(false, 0),
        datum: new IntData(0),
        tokens: 1000
    })

    const configureContext = (props?: {
        signingAgent?: PubKeyHash | null
        nVoucherPairsBurned?: IntLike
        nVoucherUserTokensBurned?: IntLike
        burnedVoucherId?: IntLike
        spentReimbursementPeriodId?: IntLike
    }) => {
        const voucherId = 1
        const scb = new ScriptContextBuilder().addVoucherInput({
            id: voucherId,
            voucher,
            redeemer: new IntData(0)
        })

        const agent = props?.signingAgent ?? PubKeyHash.dummy()
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

    it("succeeds if signed by the agent and the voucher pair is burned", () => {
        configureContext({ nVoucherPairsBurned: 1 }).use((ctx) => {
            main.eval({
                $scriptContext: ctx,
                $datum: voucher,
                _: new IntData(0)
            })
        })
    })

    it("throws an error if a voucher pair is burned but the tx isn't signed by the agent", () => {
        configureContext({ signingAgent: null }).use((ctx) => {
            throws(() => {
                main.eval({
                    $scriptContext: ctx,
                    $datum: voucher,
                    _: new IntData(0)
                })
            })
        })
    })

    it("throws an error if only the voucher user token is burned", () => {
        configureContext({ nVoucherUserTokensBurned: 1 }).use((ctx) => {
            throws(() => {
                main.eval({
                    $scriptContext: ctx,
                    $datum: voucher,
                    _: new IntData(0)
                })
            })
        })
    })

    it("throws an error if the burned voucher id doesn't correspond to the spent voucher id", () => {
        configureContext({ burnedVoucherId: 2 }).use((ctx) => {
            throws(() => {
                main.eval({
                    $scriptContext: ctx,
                    $datum: voucher,
                    _: new IntData(0)
                })
            })
        })
    })

    it("succeeds if the user token isn't burned but the tx is witnessed by the reimbursement UTxO of the same period is spent", () => {
        configureContext({ spentReimbursementPeriodId: 1 }).use((ctx) => {
            main.eval({
                $scriptContext: ctx,
                $datum: voucher,
                _: new IntData(0)
            })
        })
    })

    it("throws an error if the spent reimbursement UTxO is from another period", () => {
        configureContext({ spentReimbursementPeriodId: 2 }).use((ctx) => {
            throws(() => {
                main.eval({
                    $scriptContext: ctx,
                    $datum: voucher,
                    _: new IntData(0)
                })
            })
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