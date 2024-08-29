import { describe, it } from "node:test"
import context from "pbg-token-validators-test-context"
import { DUMMY_CONFIG, DUMMY_SUPPLY, allScripts, makeConfig, makeSupply, makeSupplyValidatorSpendingContext, makeSwapSpendingContext } from "./utils";
import { strictEqual } from "node:assert";

const calc_management_fee_dilution = context.SupplyModule["Supply::calc_management_fee_dilution"]

describe("Supply::calc_management_fee_dilution", () => {   
    it("whitepaper example", () => {
        const relFee = 0.0001
        const nTokens = 1_000_000_000
        const expected = 100010n
    
        const supply = makeSupply({nTokens})

        const ctx = makeSupplyValidatorSpendingContext({
            supply: supply, 
            config: makeConfig({relManagementFee: relFee})
        })
    
        const res = calc_management_fee_dilution.eval({
            $currentScript: "supply_validator",
            $scriptContext: ctx,
            self: supply
        })
    
        strictEqual(res, expected)
    })

    it("0 if there are no tokens", () => {
        const supply = makeSupply({nTokens: 0n})
        const ctx = makeSupplyValidatorSpendingContext({
            supply: supply, 
            config: makeConfig({relManagementFee: 0.0001})
        })
    
        const res = calc_management_fee_dilution.eval({
            $currentScript: "supply_validator",
            $scriptContext: ctx,
            self: supply
        })
    
        strictEqual(res, 0n)
    })

    it("0 if the fee is 0", () => {
        const supply = makeSupply({nTokens: 1_000_000_000n})
        const ctx = makeSupplyValidatorSpendingContext({
            supply: supply, 
            config: makeConfig({relManagementFee: 0.0})
        })
    
        const res = calc_management_fee_dilution.eval({
            $currentScript: "supply_validator",
            $scriptContext: ctx,
            self: supply
        })
    
        strictEqual(res, 0n)
    })
})

describe("Supply::calc_success_fee_dilution", () => {
    const calc_success_fee_dilution = context.SupplyModule["Supply::calc_success_fee_dilution"]

    it("whitepaper example", () => {
        const config = makeConfig({
            successFee: {
                c0: 0,
                steps: [
                    {sigma: 1.05, c: 0.3}
                ]
            }
        })
    
        const supply = makeSupply({
            startPrice: [100, 1]
        })
    
        const ctx = makeSupplyValidatorSpendingContext({supply, config})
    
        const res = calc_success_fee_dilution.eval({
            $currentScript: "supply_validator",
            $scriptContext: ctx,
            self: supply,
            end_price: [150, 1]
        })
    
        // in the whitepaper example this number is 98.901099, which is the correcly rounded number
        // but the on-chain math rounds down
        strictEqual(res, 98_901_098n)
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

        const ctx = makeSupplyValidatorSpendingContext({
            supply,
            config
        })

        const res = calc_success_fee_dilution.eval({
            $currentScript: "supply_validator",
            $scriptContext: ctx,
            self: supply,
            end_price: [150, 1]
        })

        strictEqual(res, 0n)
    })

    it("0 success gives 0 dilution", () => {
        const config = makeConfig({
            successFee: {
                c0: 0,
                steps: [
                    {sigma: 1.05, c: 0.3}
                ]
            }
        })
    
        const supply = makeSupply({
            startPrice: [100, 1]
        })
    
        const ctx = makeSupplyValidatorSpendingContext({supply, config})
    
        const res = calc_success_fee_dilution.eval({
            $currentScript: "supply_validator",
            $scriptContext: ctx,
            self: supply,
            end_price: [90, 1]
        })
    
        strictEqual(res, 0n)
    })
})

describe("Supply::is_successful", () => {
    const is_successful = context.SupplyModule["Supply::is_successful"]

    const supply = makeSupply({
        startPrice: [100, 1]
    })

    it("false for equal end price", () => {
        const res = is_successful.eval({
            self: supply,
            price_relative_to_benchmark: [100, 1]
        })
    
        strictEqual(res, false)
    })

    it("false for smaller end price", () => {
        const res = is_successful.eval({
            self: supply,
            price_relative_to_benchmark: [99_999_999, 1000000]
        })
    
        strictEqual(res, false)
    })

    it("true for larger end price", () => {
        const res = is_successful.eval({
            self: supply,
            price_relative_to_benchmark: [100_000_001, 1000000]
        })
    
        strictEqual(res, true)
    })
})

describe("Supply::period_end", () => {
    const supply = makeSupply({
        successFee: {
            start_time: 0,
            period: 1000
        }
    })

    const res = context.SupplyModule["Supply::period_end"].eval({
        self: supply
    })

    strictEqual(res, 1000)
})

describe("Supply::period_id", () => {
    const supply = makeSupply({
        successFee: {
            periodId: 10
        }
    })

    const res = context.SupplyModule["Supply::period_id"].eval({
        self: supply
    })

    strictEqual(res, 10n)
})

describe("witnessed_by_supply", () => {
    const witnessed_by_supply = context.SupplyModule.witnessed_by_supply

    const supply = makeSupply({})
    const config = makeConfig({})
    const scriptContext = makeSupplyValidatorSpendingContext({supply, config})
    const altScriptContext = makeSwapSpendingContext()

    allScripts.forEach(currentScript => {
        it(`true when spending supply utxo in ${currentScript}`, () => {
            const res = witnessed_by_supply.eval({
                $currentScript: currentScript,
                $scriptContext: scriptContext
            })
    
            strictEqual(res, true)
        })

        it(`false when not spending supply utxo in ${currentScript}`, () => {
            const res = witnessed_by_supply.eval({
                $currentScript: currentScript,
                $scriptContext: altScriptContext
            })

            strictEqual(res, false)
        })
    })
})