import { deepEqual, strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import contract from "pbg-token-validators-test-context"
import { Addresses, scripts } from "./constants"
import { spendPrice, spendSupply, spendVault } from "./tx"
import { makeConfigToken, makeSupplyToken } from "./tokens"
import { makeConfig, makePrice, makeSupply } from "./data"
import { Address } from "@helios-lang/ledger"
const {
    "Supply::find_input": find_input,
    "Supply::find_output": find_output,
    "Supply::find_ref": find_ref,
    "Supply::find_thread": find_thread,
    "Supply::calc_management_fee_dilution": calc_management_fee_dilution,
    "Supply::calc_success_fee_dilution": calc_success_fee_dilution,
    "Supply::is_successful": is_successful,
    "Supply::period_end": period_end,
    "Supply::period_id": period_id,
    witnessed_by_supply
} = contract.SupplyModule

describe("Supply::find_input", () => {
    const supply = makeSupply({})

    it("ok if supply UTxO is spent", () => {
        const ctx = spendSupply({
            supply
        })

        scripts.forEach((currentScript) => {
            deepEqual(
                find_input.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctx
                }),
                supply
            )
        })
    })

    it("nok if nothing is spent from supply address", () => {
        const ctx = spendVault({})

        scripts.forEach((currentScript) => {
            throws(() => {
                find_input.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctx
                })
            })
        })
    })

    it("ok if not exactly 1 token spent", () => {
        const ctx = spendSupply({
            supply,
            supplyToken: makeSupplyToken(2)
        })

        scripts.forEach((currentScript) => {
            deepEqual(
                find_input.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctx
                }),
                supply
            )
        })
    })

    it("nok if less than 1 token spent", () => {
        const ctx = spendSupply({
            supply,
            supplyToken: makeSupplyToken(-1)
        })

        scripts.forEach((currentScript) => {
            throws(() => {
                find_input.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctx
                })
            })
        })
    })

    it("nok if other policy is spent", () => {
        const ctx = spendSupply({
            supply,
            supplyToken: makeConfigToken()
        })

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

describe("Supply::find_output", () => {
    const supply = makeSupply({})

    it("ok if supply token returned", () => {
        const ctx = spendSupply({
            supply
        })

        scripts.forEach((currentScript) => {
            deepEqual(
                find_output.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctx
                }),
                supply
            )
        })
    })

    it("nok if supply token not returned", () => {
        const ctx = spendSupply({
            supply,
            returnAddr: Address.dummy(false)
        })

        scripts.forEach((currentScript) => {
            throws(() => {
                find_output.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctx
                })
            })
        })
    })

    it("nok if not exactly 1 returned", () => {
        const ctx = spendSupply({
            supply,
            supplyToken: makeSupplyToken(2)
        })

        scripts.forEach((currentScript) => {
            throws(() => {
                find_output.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctx
                })
            })
        })
    })

    it("nok if wrong token returned", () => {
        const ctx = spendSupply({
            supply,
            supplyToken: makeConfigToken(2)
        })

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

describe("Supply::find_ref", () => {
    const supply = makeSupply({})

    it("fails if not referenced", () => {
        const ctx = spendSupply({
            supply
        })

        scripts.forEach((currentScript) => {
            throws(() => {
                find_ref.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctx
                })
            })
        })
    })

    it("ok if referenced", () => {
        const price = makePrice()

        const ctx = spendPrice({
            price,
            supply
        })

        scripts.forEach((currentScript) => {
            deepEqual(
                find_ref.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctx
                }),
                supply
            )
        })
    })

    it("ok if referenced but at wrong address", () => {
        const price = makePrice()

        const ctx = spendPrice({
            price,
            supply,
            supplyAddr: Address.dummy(false)
        })

        scripts.forEach((currentScript) => {
            deepEqual(
                find_ref.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctx
                }),
                supply
            )
        })
    })

    it("fails if referenced but less than 1 token", () => {
        const price = makePrice()

        const ctx = spendPrice({
            price,
            supply,
            supplyToken: makeSupplyToken(0)
        })

        scripts.forEach((currentScript) => {
            throws(() => {
                find_ref.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctx
                })
            })
        })
    })
})

describe("Supply::find_thread", () => {
    const supply = makeSupply({})

    it("returns same supply twice", () => {
        const ctx = spendSupply({
            supply
        })

        scripts.forEach((currentScript) => {
            deepEqual(
                find_thread.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctx
                }),
                [supply, supply]
            )
        })
    })

    it("fails if more than 1 token", () => {
        const ctx = spendSupply({
            supply,
            supplyToken: makeSupplyToken(2)
        })

        scripts.forEach((currentScript) => {
            throws(() => {
                find_thread.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctx
                })
            })
        })
    })
})

describe("Supply::calc_management_fee_dilution", () => {
    it("whitepaper example", () => {
        const relFee = 0.0001
        const nTokens = 1_000_000_000

        const supply = makeSupply({ nTokens })

        const ctx = spendSupply({
            supply: supply,
            config: makeConfig({ relManagementFee: relFee })
        })

        strictEqual(
            calc_management_fee_dilution.eval({
                $currentScript: "supply_validator",
                $scriptContext: ctx,
                self: supply
            }),
            100010n
        )
    })

    it("0 if there are no tokens", () => {
        const supply = makeSupply({ nTokens: 0n })

        const ctx = spendSupply({
            supply: supply,
            config: makeConfig({ relManagementFee: 0.0001 })
        })

        strictEqual(
            calc_management_fee_dilution.eval({
                $currentScript: "supply_validator",
                $scriptContext: ctx,
                self: supply
            }),
            0n
        )
    })

    it("0 if the fee is 0", () => {
        const supply = makeSupply({ nTokens: 1_000_000_000n })

        const ctx = spendSupply({
            supply: supply,
            config: makeConfig({ relManagementFee: 0.0 })
        })

        strictEqual(
            calc_management_fee_dilution.eval({
                $currentScript: "supply_validator",
                $scriptContext: ctx,
                self: supply
            }),
            0n
        )
    })
})

describe("Supply::calc_success_fee_dilution", () => {
    it("whitepaper example", () => {
        const config = makeConfig({
            successFee: {
                c0: 0,
                steps: [{ sigma: 1.05, c: 0.3 }]
            }
        })

        const supply = makeSupply({
            startPrice: [100, 1]
        })

        const ctx = spendSupply({ supply, config })

        // in the whitepaper example this number is 98.901099, which is the correcly rounded number
        // but the on-chain math rounds down
        strictEqual(
            calc_success_fee_dilution.eval({
                $currentScript: "supply_validator",
                $scriptContext: ctx,
                self: supply,
                end_price: [150, 1]
            }),
            98_901_098n
        )
    })

    it("0 fee gives 0 dilution", () => {
        const config = makeConfig({
            successFee: {
                c0: 0,
                steps: []
            }
        })

        const supply = makeSupply({
            startPrice: [100, 1]
        })

        const ctx = spendSupply({
            supply,
            config
        })

        strictEqual(
            calc_success_fee_dilution.eval({
                $currentScript: "supply_validator",
                $scriptContext: ctx,
                self: supply,
                end_price: [150, 1]
            }),
            0n
        )
    })

    it("0 success gives 0 dilution", () => {
        const config = makeConfig({
            successFee: {
                c0: 0,
                steps: [{ sigma: 1.05, c: 0.3 }]
            }
        })

        const supply = makeSupply({
            startPrice: [100, 1]
        })

        const ctx = spendSupply({ supply, config })

        strictEqual(
            calc_success_fee_dilution.eval({
                $currentScript: "supply_validator",
                $scriptContext: ctx,
                self: supply,
                end_price: [90, 1]
            }),
            0n
        )
    })
})

describe("Supply::is_successful", () => {
    const self = makeSupply({
        startPrice: [100, 1]
    })

    it("false for equal end price", () => {
        strictEqual(
            is_successful.eval({
                self,
                price_relative_to_benchmark: [100, 1]
            }),
            false
        )
    })

    it("false for smaller end price", () => {
        strictEqual(
            is_successful.eval({
                self,
                price_relative_to_benchmark: [99_999_999, 1000000]
            }),
            false
        )
    })

    it("true for larger end price", () => {
        strictEqual(
            is_successful.eval({
                self: self,
                price_relative_to_benchmark: [100_000_001, 1000000]
            }),
            true
        )
    })
})

describe("Supply::period_end", () => {
    const self = makeSupply({
        successFee: {
            start_time: 0,
            period: 1000
        }
    })

    strictEqual(
        period_end.eval({
            self
        }),
        1000
    )
})

describe("Supply::period_id", () => {
    const self = makeSupply({
        successFee: {
            periodId: 10
        }
    })

    strictEqual(
        period_id.eval({
            self
        }),
        10n
    )
})

describe("witnessed_by_supply", () => {
    const supply = makeSupply({})
    const config = makeConfig({})
    const ctx = spendSupply({ supply, config })
    const altCtx = spendVault({})

    it("true when spending supply utxo", () => {
        scripts.forEach((currentScript) => {
            strictEqual(
                witnessed_by_supply.eval({
                    $currentScript: currentScript,
                    $scriptContext: ctx
                }),
                true
            )
        })
    })

    it(`false when not spending supply utxo`, () => {
        scripts.forEach((currentScript) => {
            strictEqual(
                witnessed_by_supply.eval({
                    $currentScript: currentScript,
                    $scriptContext: altCtx
                }),
                false
            )
        })
    })
})
