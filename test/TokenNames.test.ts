import { deepEqual, strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { bytesToHex, decodeUtf8, encodeUtf8, hexToBytes } from "@helios-lang/codec-utils"
import context from "pbg-token-validators-test-context"

describe("TokenNames constants", () => {
    it("metadata", () => {
        const res = context.TokenNames.metadata.eval({})

        strictEqual(bytesToHex(res), "000643b0")
    })

    it("dvp_token", () => {
        const res = context.TokenNames.dvp_token.eval({})

        strictEqual(bytesToHex(res), "0014df10")
    })

    it("assets_prefix", () => {
        const res = context.TokenNames.assets_prefix.eval({})

        // Note the final space
        strictEqual(decodeUtf8(res), "assets ")
    })

    it("config", () => {
        const res = context.TokenNames.config.eval({})

        strictEqual(decodeUtf8(res), "config")
    })

    it("portfolio", () => {
        const res = context.TokenNames.portfolio.eval({})

        strictEqual(decodeUtf8(res), "portfolio")
    })

    it("price", () => {
        const res = context.TokenNames.price.eval({})

        strictEqual(decodeUtf8(res), "price")
    })

    it("reimbursement_prefix", () => {
        const res = context.TokenNames.reimbursement_prefix.eval({})

        // Note the final space
        strictEqual(decodeUtf8(res), "reimbursement ") 
    })

    it("supply", () => {
        const res = context.TokenNames.supply.eval({})

        strictEqual(decodeUtf8(res), "supply") 
    })

    it("voucher_infix", () => {
        const res = context.TokenNames.voucher_infix.eval({})

        strictEqual(decodeUtf8(res), "voucher ") 
    })

    it("voucher_ref_prefix", () => {
        const res = context.TokenNames.voucher_ref_prefix.eval({})

        deepEqual(res, hexToBytes("000643b0").concat(encodeUtf8("voucher "))) 
    })

    it("voucher_ref_prefix isn't valid utf-8", () => {
        const res = context.TokenNames.voucher_ref_prefix.eval({})

        throws(() => {
            decodeUtf8(res)
        })
    })

    it("voucher_nft_prefix", () => {
        const res = context.TokenNames.voucher_nft_prefix.eval({})

        deepEqual(res, hexToBytes("000de140").concat(encodeUtf8("voucher ")))
    })

    it("voucher_nft_prefix isn't valid utf-8", () => {
        const res = context.TokenNames.voucher_nft_prefix.eval({})

        throws(() => {
            decodeUtf8(res)
        })
    })
})
    
describe("TokenNames::assets", () => {
    it("-1", () => {
        const res =context.TokenNames.assets.eval({
            group_id: -1
        })

        strictEqual(decodeUtf8(res), "assets -1")
    })

    it("0", () => {
        const res =context.TokenNames.assets.eval({
            group_id: 0
        })

        strictEqual(decodeUtf8(res), "assets 0")
    })

    it("1", () => {
        const res =context.TokenNames.assets.eval({
            group_id: 1
        })

        strictEqual(decodeUtf8(res), "assets 1")
    })

    it("10", () => {
        const res =context.TokenNames.assets.eval({
            group_id: 10
        })

        strictEqual(decodeUtf8(res), "assets 10")
    })
})
   
describe("TokenNames::parse_series", () => {
    it("\"assets -1\"", () => {
        const res = context.TokenNames.parse_series.eval({
            prefix: encodeUtf8("assets "),
            token_name: encodeUtf8("assets -1")
        })

        strictEqual(res, -1n)
    })

    it("\"assets 0\"", () => {
        const res = context.TokenNames.parse_series.eval({
            prefix: encodeUtf8("assets "),
            token_name: encodeUtf8("assets 0")
        })

        strictEqual(res, 0n)
    })

    it("\"assets 1\"", () => {
        const res = context.TokenNames.parse_series.eval({
            prefix: encodeUtf8("assets "),
            token_name: encodeUtf8("assets 1")
        })

        strictEqual(res, 1n)
    })

    it("\"assets 10\"", () => {
        const res = context.TokenNames.parse_series.eval({
            prefix: encodeUtf8("assets "),
            token_name: encodeUtf8("assets 10")
        })

        strictEqual(res, 10n)
    })

    it("\"assets 9999\"", () => {
        const res = context.TokenNames.parse_series.eval({
            prefix: encodeUtf8("assets "),
            token_name: encodeUtf8("assets 9999")
        })

        strictEqual(res, 9999n)
    })

    it("different prefix", () => {
        const res = context.TokenNames.parse_series.eval({
            prefix: encodeUtf8("voucher "),
            token_name: encodeUtf8("assets 10")
        })

        strictEqual(res, null)
    })

    it("prefix missing separator", () => {
        throws(() => {
            context.TokenNames.parse_series.eval({
                prefix: encodeUtf8("assets"),
                token_name: encodeUtf8("assets 10")
            })
        })
    })

    it("id with trailing space", () => {
        throws(() => {
            context.TokenNames.parse_series.eval({
                prefix: encodeUtf8("assets"),
                token_name: encodeUtf8("assets 10 ")
            })
        })
    })

    it("id with leading 0s", () => {
        throws(() => {
            context.TokenNames.parse_series.eval({
                prefix: encodeUtf8("assets"),
                token_name: encodeUtf8("assets 010")
            })
        })
    })

    it("id with trailing non-digit", () => {
        throws(() => {
            context.TokenNames.parse_series.eval({
                prefix: encodeUtf8("assets"),
                token_name: encodeUtf8("assets 100a")
            })
        })
    })
})

describe("TokenNames::parse_assets", () => {
    it("\"assets -1\"", () => {
        const res = context.TokenNames.parse_assets.eval({
            token_name: encodeUtf8("assets -1")
        })

        strictEqual(res, -1n)
    })

    it("\"assets 0\"", () => {
        const res = context.TokenNames.parse_assets.eval({
            token_name: encodeUtf8("assets 0")
        })

        strictEqual(res, 0n)
    })

    it("\"assets 1\"", () => {
        const res = context.TokenNames.parse_assets.eval({
            token_name: encodeUtf8("assets 1")
        })

        strictEqual(res, 1n)
    })

    it("\"assets 10\"", () => {
        const res = context.TokenNames.parse_assets.eval({
            token_name: encodeUtf8("assets 10")
        })

        strictEqual(res, 10n)
    })

    it("\"assets 9999\"", () => {
        const res = context.TokenNames.parse_assets.eval({
            token_name: encodeUtf8("assets 9999")
        })

        strictEqual(res, 9999n)
    })

    it("different prefix", () => {
        const res = context.TokenNames.parse_assets.eval({
            token_name: encodeUtf8("voucher 10")
        })

        strictEqual(res, null)
    })

    it("id with leading space", () => {
        throws(() => {
            context.TokenNames.parse_assets.eval({
                token_name: encodeUtf8("assets  10")
            })
        })
    })

    it("id with trailing space", () => {
        throws(() => {
            context.TokenNames.parse_assets.eval({
                token_name: encodeUtf8("assets 10 ")
            })
        })
    })

    it("id with leading 0s", () => {
        throws(() => {
            context.TokenNames.parse_assets.eval({
                token_name: encodeUtf8("assets 010")
            })
        })
    })

    it("id with trailing non-digit", () => {
        throws(() => {
            context.TokenNames.parse_assets.eval({
                token_name: encodeUtf8("assets 100a")
            })
        })
    })
})

describe("TokenNames::has_assets_prefix", () => {
    it("true for \"assets 1\"", () => {
        const res = context.TokenNames.has_assets_prefix.eval({
            token_name: encodeUtf8("assets 1")
        })
    
        strictEqual(res, true)
    })

    it("false for \"voucher 1\"", () => {
        const res = context.TokenNames.has_assets_prefix.eval({
            token_name: encodeUtf8("voucher 1")
        })
    
        strictEqual(res, false)
    })
})

describe("TokenNames::parse_reimbursement", () => {
    it("\"reimbursement -1\"", () => {
        const res = context.TokenNames.parse_reimbursement.eval({
            token_name: encodeUtf8("reimbursement -1")
        })

        strictEqual(res, -1n)
    })

    it("\"reimbursement 0\"", () => {
        const res = context.TokenNames.parse_reimbursement.eval({
            token_name: encodeUtf8("reimbursement 0")
        })

        strictEqual(res, 0n)
    })

    it("\"reimbursement 1\"", () => {
        const res = context.TokenNames.parse_reimbursement.eval({
            token_name: encodeUtf8("reimbursement 1")
        })

        strictEqual(res, 1n)
    })

    it("\"reimbursement 10\"", () => {
        const res = context.TokenNames.parse_reimbursement.eval({
            token_name: encodeUtf8("reimbursement 10")
        })

        strictEqual(res, 10n)
    })

    it("\"reimbursement 9999\"", () => {
        const res = context.TokenNames.parse_reimbursement.eval({
            token_name: encodeUtf8("reimbursement 9999")
        })

        strictEqual(res, 9999n)
    })

    it("different prefix", () => {
        const res = context.TokenNames.parse_reimbursement.eval({
            token_name: encodeUtf8("voucher 10")
        })

        strictEqual(res, null)
    })

    it("id with leading space", () => {
        throws(() => {
            context.TokenNames.parse_reimbursement.eval({
                token_name: encodeUtf8("reimbursement  10")
            })
        })
    })

    it("id with trailing space", () => {
        throws(() => {
            context.TokenNames.parse_reimbursement.eval({
                token_name: encodeUtf8("reimbursement 10 ")
            })
        })
    })

    it("id with leading 0s", () => {
        throws(() => {
            context.TokenNames.parse_reimbursement.eval({
                token_name: encodeUtf8("reimbursement 010")
            })
        })
    })

    it("id with trailing non-digit", () => {
        throws(() => {
            context.TokenNames.parse_reimbursement.eval({
                token_name: encodeUtf8("reimbursement 100a")
            })
        })
    })
})


describe("TokenNames::reimbursement", () => {
    it("-1", () => {
        const res =context.TokenNames.reimbursement.eval({
            id: -1
        })

        strictEqual(decodeUtf8(res), "reimbursement -1")
    })

    it("0", () => {
        const res =context.TokenNames.reimbursement.eval({
            id: 0
        })

        strictEqual(decodeUtf8(res), "reimbursement 0")
    })

    it("1", () => {
        const res =context.TokenNames.reimbursement.eval({
            id: 1
        })

        strictEqual(decodeUtf8(res), "reimbursement 1")
    })

    it("10", () => {
        const res =context.TokenNames.reimbursement.eval({
            id: 10
        })

        strictEqual(decodeUtf8(res), "reimbursement 10")
    })

    it("9999", () => {
        const res =context.TokenNames.reimbursement.eval({
            id: 9999
        })

        strictEqual(decodeUtf8(res), "reimbursement 9999")
    })
})

describe("TokenNames::parse_voucher_ref", () => {
    it("\"voucher -1\"", () => {
        const res = context.TokenNames.parse_voucher_ref.eval({
            token_name: hexToBytes("000643b0").concat(encodeUtf8("voucher -1"))
        })

        strictEqual(res, -1n)
    })

    it("\"voucher 0\"", () => {
        const res = context.TokenNames.parse_voucher_ref.eval({
            token_name: hexToBytes("000643b0").concat(encodeUtf8("voucher 0"))
        })

        strictEqual(res, 0n)
    })

    it("\"voucher 1\"", () => {
        const res = context.TokenNames.parse_voucher_ref.eval({
            token_name: hexToBytes("000643b0").concat(encodeUtf8("voucher 1"))
        })

        strictEqual(res, 1n)
    })

    it("\"voucher 10\"", () => {
        const res = context.TokenNames.parse_voucher_ref.eval({
            token_name: hexToBytes("000643b0").concat(encodeUtf8("voucher 10"))
        })

        strictEqual(res, 10n)
    })

    it("\"voucher 9999\"", () => {
        const res = context.TokenNames.parse_voucher_ref.eval({
            token_name: hexToBytes("000643b0").concat(encodeUtf8("voucher 9999"))
        })

        strictEqual(res, 9999n)
    })

    it("missing cip67 prefix", () => {
        const res = context.TokenNames.parse_voucher_ref.eval({
            token_name: encodeUtf8("voucher -1")
        })

        strictEqual(res, null)
    })

    it("id with leading space", () => {
        throws(() => {
            context.TokenNames.parse_voucher_ref.eval({
                token_name: hexToBytes("000643b0").concat(encodeUtf8("voucher  10"))
            })
        })
    })

    it("id with trailing space", () => {
        throws(() => {
            context.TokenNames.parse_voucher_ref.eval({
                token_name: hexToBytes("000643b0").concat(encodeUtf8("voucher 10 "))
            })
        })
    })

    it("id with leading 0s", () => {
        throws(() => {
            context.TokenNames.parse_voucher_ref.eval({
                token_name: hexToBytes("000643b0").concat(encodeUtf8("voucher 010"))
            })
        })
    })

    it("id with trailing non-digit", () => {
        throws(() => {
            context.TokenNames.parse_voucher_ref.eval({
                token_name: hexToBytes("000643b0").concat(encodeUtf8("voucher 100a"))
            })
        })
    })
})


describe("TokenNames::parse_voucher_nft", () => {
    it("\"voucher -1\"", () => {
        const res = context.TokenNames.parse_voucher_nft.eval({
            token_name: hexToBytes("000de140").concat(encodeUtf8("voucher -1"))
        })

        strictEqual(res, -1n)
    })

    it("\"voucher 0\"", () => {
        const res = context.TokenNames.parse_voucher_nft.eval({
            token_name: hexToBytes("000de140").concat(encodeUtf8("voucher 0"))
        })

        strictEqual(res, 0n)
    })

    it("\"voucher 1\"", () => {
        const res = context.TokenNames.parse_voucher_nft.eval({
            token_name: hexToBytes("000de140").concat(encodeUtf8("voucher 1"))
        })

        strictEqual(res, 1n)
    })

    it("\"voucher 10\"", () => {
        const res = context.TokenNames.parse_voucher_nft.eval({
            token_name: hexToBytes("000de140").concat(encodeUtf8("voucher 10"))
        })

        strictEqual(res, 10n)
    })

    it("\"voucher 9999\"", () => {
        const res = context.TokenNames.parse_voucher_nft.eval({
            token_name: hexToBytes("000de140").concat(encodeUtf8("voucher 9999"))
        })

        strictEqual(res, 9999n)
    })

    it("missing cip67 prefix", () => {
        const res = context.TokenNames.parse_voucher_nft.eval({
            token_name: encodeUtf8("voucher -1")
        })

        strictEqual(res, null)
    })

    it("id with leading space", () => {
        throws(() => {
            context.TokenNames.parse_voucher_nft.eval({
                token_name: hexToBytes("000de140").concat(encodeUtf8("voucher  10"))
            })
        })
    })

    it("id with trailing space", () => {
        throws(() => {
            context.TokenNames.parse_voucher_nft.eval({
                token_name: hexToBytes("000de140").concat(encodeUtf8("voucher 10 "))
            })
        })
    })

    it("id with leading 0s", () => {
        throws(() => {
            context.TokenNames.parse_voucher_nft.eval({
                token_name: hexToBytes("000de140").concat(encodeUtf8("voucher 010"))
            })
        })
    })

    it("id with trailing non-digit", () => {
        throws(() => {
            context.TokenNames.parse_voucher_nft.eval({
                token_name: hexToBytes("000de140").concat(encodeUtf8("voucher 100a"))
            })
        })
    })
})

describe("TokenNames::has_voucher_ref_prefix", () => {
    it("false for \"voucher 1\"", () => {
        const res = context.TokenNames.has_voucher_ref_prefix.eval({token_name: encodeUtf8("voucher 1")})

        strictEqual(res, false)
    })

    it("false for \"(222)voucher 1\"", () => {
        const res = context.TokenNames.has_voucher_ref_prefix.eval({token_name: hexToBytes("000de140").concat(encodeUtf8("voucher 1"))})

        strictEqual(res, false)
    })

    it("true for \"(100)voucher 1\"", () => {
        const res = context.TokenNames.has_voucher_ref_prefix.eval({token_name: hexToBytes("000643b0").concat(encodeUtf8("voucher 1"))})

        strictEqual(res, true)
    })
})

describe("TokenNames::has_voucher_nft_prefix", () => {
    it("false for \"voucher 1\"", () => {
        const res = context.TokenNames.has_voucher_nft_prefix.eval({token_name: encodeUtf8("voucher 1")})

        strictEqual(res, false)
    })

    it("true for \"(222)voucher 1\"", () => {
        const res = context.TokenNames.has_voucher_nft_prefix.eval({token_name: hexToBytes("000de140").concat(encodeUtf8("voucher 1"))})

        strictEqual(res, true)
    })

    it("false for \"(100)voucher 1\"", () => {
        const res = context.TokenNames.has_voucher_nft_prefix.eval({token_name: hexToBytes("000643b0").concat(encodeUtf8("voucher 1"))})

        strictEqual(res, false)
    })
})

describe("TokenNames::voucher_ref", () => {
    it("-1", () => {
        const res =context.TokenNames.voucher_ref.eval({
            id: -1
        })

        deepEqual(res, hexToBytes("000643b0").concat(encodeUtf8("voucher -1")))
    })

    it("0", () => {
        const res =context.TokenNames.voucher_ref.eval({
            id: 0
        })

        deepEqual(res, hexToBytes("000643b0").concat(encodeUtf8("voucher 0")))
    })

    it("1", () => {
        const res =context.TokenNames.voucher_ref.eval({
            id: 1
        })

        deepEqual(res, hexToBytes("000643b0").concat(encodeUtf8("voucher 1")))
    })

    it("10", () => {
        const res =context.TokenNames.voucher_ref.eval({
            id: 10
        })

        deepEqual(res, hexToBytes("000643b0").concat(encodeUtf8("voucher 10")))
    })

    it("9999", () => {
        const res =context.TokenNames.voucher_ref.eval({
            id: 9999
        })

        deepEqual(res, hexToBytes("000643b0").concat(encodeUtf8("voucher 9999")))
    })  
})

describe("TokenNames::voucher_nft", () => {
    it("-1", () => {
        const res =context.TokenNames.voucher_nft.eval({
            id: -1
        })

        deepEqual(res, hexToBytes("000de140").concat(encodeUtf8("voucher -1")))
    })

    it("0", () => {
        const res =context.TokenNames.voucher_nft.eval({
            id: 0
        })

        deepEqual(res, hexToBytes("000de140").concat(encodeUtf8("voucher 0")))
    })

    it("1", () => {
        const res =context.TokenNames.voucher_nft.eval({
            id: 1
        })

        deepEqual(res, hexToBytes("000de140").concat(encodeUtf8("voucher 1")))
    })

    it("10", () => {
        const res =context.TokenNames.voucher_nft.eval({
            id: 10
        })

        deepEqual(res, hexToBytes("000de140").concat(encodeUtf8("voucher 10")))
    })

    it("9999", () => {
        const res =context.TokenNames.voucher_nft.eval({
            id: 9999
        })

        deepEqual(res, hexToBytes("000de140").concat(encodeUtf8("voucher 9999")))
    })  
})