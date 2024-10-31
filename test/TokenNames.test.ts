import { deepEqual, strictEqual, throws } from "node:assert"
import { describe, it } from "node:test"
import { decodeUtf8, encodeUtf8 } from "@helios-lang/codec-utils"
import contract from "pbg-token-validators-test-context"
import {
    cip68_100_prefix,
    cip68_222_prefix,
    cip68_333_prefix,
    PREFIX
} from "./constants"

const {
    assets,
    assets_prefix,
    config,
    dvp_token,
    has_assets_prefix,
    has_voucher_nft_prefix,
    has_voucher_ref_prefix,
    metadata,
    parse_assets,
    parse_reimbursement,
    parse_series,
    parse_voucher_nft,
    parse_voucher_ref,
    portfolio,
    price,
    reimbursement,
    reimbursement_prefix,
    supply,
    voucher_infix,
    voucher_nft,
    voucher_nft_prefix,
    voucher_ref,
    voucher_ref_prefix
} = contract.TokenNames

describe("TokenNames constants", () => {
    it("metadata", () => {
        deepEqual(
            metadata.eval({}),
            cip68_100_prefix.concat(encodeUtf8(PREFIX))
        )
    })

    it("dvp_token", () => {
        deepEqual(
            dvp_token.eval({}),
            cip68_333_prefix.concat(encodeUtf8(PREFIX))
        )
    })

    it("assets_prefix", () => {
        // Note the final space
        deepEqual(assets_prefix.eval({}), encodeUtf8(`${PREFIX} assets `))
    })

    it("config", () => {
        deepEqual(config.eval({}), encodeUtf8(`${PREFIX} config`))
    })

    it("portfolio", () => {
        deepEqual(portfolio.eval({}), encodeUtf8(`${PREFIX} portfolio`))
    })

    it("price", () => {
        deepEqual(price.eval({}), encodeUtf8(`${PREFIX} price`))
    })

    it("reimbursement_prefix", () => {
        // Note the final space
        deepEqual(
            reimbursement_prefix.eval({}),
            encodeUtf8(`${PREFIX} reimbursement `)
        )
    })

    it("supply", () => {
        deepEqual(supply.eval({}), encodeUtf8(`${PREFIX} supply`))
    })

    it("voucher_infix", () => {
        deepEqual(voucher_infix.eval({}), encodeUtf8(`${PREFIX} voucher `))
    })

    it("voucher_ref_prefix", () => {
        deepEqual(
            voucher_ref_prefix.eval({}),
            cip68_100_prefix.concat(encodeUtf8(`${PREFIX} voucher `))
        )
    })

    it("voucher_ref_prefix isn't valid utf-8", () => {
        const p = voucher_ref_prefix.eval({})

        throws(() => {
            decodeUtf8(p)
        }, /The encoded data was not valid for encoding utf-8/)
    })

    it("voucher_nft_prefix", () => {
        deepEqual(
            voucher_nft_prefix.eval({}),
            cip68_222_prefix.concat(encodeUtf8(`${PREFIX} voucher `))
        )
    })

    it("voucher_nft_prefix isn't valid utf-8", () => {
        const p = voucher_nft_prefix.eval({})

        throws(() => {
            decodeUtf8(p)
        })
    })
})

describe("TokenNames::assets", () => {
    it("-1", () => {
        deepEqual(
            assets.eval({
                group_id: -1
            }),
            encodeUtf8(`${PREFIX} assets -1`)
        )
    })

    it("0", () => {
        deepEqual(
            assets.eval({
                group_id: 0
            }),
            encodeUtf8(`${PREFIX} assets 0`)
        )
    })

    it("1", () => {
        deepEqual(
            assets.eval({
                group_id: 1
            }),
            encodeUtf8(`${PREFIX} assets 1`)
        )
    })

    it("10", () => {
        deepEqual(
            assets.eval({
                group_id: 10
            }),
            encodeUtf8(`${PREFIX} assets 10`)
        )
    })
})

describe("TokenNames::parse_series", () => {
    it('"assets -1"', () => {
        strictEqual(
            parse_series.eval({
                prefix: encodeUtf8(`${PREFIX} assets `),
                token_name: encodeUtf8(`${PREFIX} assets -1`)
            }),
            -1n
        )
    })

    it('"assets 0"', () => {
        strictEqual(
            parse_series.eval({
                prefix: encodeUtf8(`${PREFIX} assets `),
                token_name: encodeUtf8(`${PREFIX} assets 0`)
            }),
            0n
        )
    })

    it('"assets 1"', () => {
        strictEqual(
            parse_series.eval({
                prefix: encodeUtf8(`${PREFIX} assets `),
                token_name: encodeUtf8(`${PREFIX} assets 1`)
            }),
            1n
        )
    })

    it('"assets 10"', () => {
        strictEqual(
            parse_series.eval({
                prefix: encodeUtf8(`${PREFIX} assets `),
                token_name: encodeUtf8(`${PREFIX} assets 10`)
            }),
            10n
        )
    })

    it('"assets 9999"', () => {
        strictEqual(
            parse_series.eval({
                prefix: encodeUtf8(`${PREFIX} assets `),
                token_name: encodeUtf8(`${PREFIX} assets 9999`)
            }),
            9999n
        )
    })

    it("different prefix", () => {
        strictEqual(
            parse_series.eval({
                prefix: encodeUtf8(`${PREFIX} voucher `),
                token_name: encodeUtf8(`${PREFIX} assets 10`)
            }),
            null
        )
    })

    it("prefix missing separator", () => {
        throws(() => {
            parse_series.eval({
                prefix: encodeUtf8(`${PREFIX} assets`),
                token_name: encodeUtf8(`${PREFIX} assets 10`)
            })
        }, /not a digit/)
    })

    it("id with trailing space", () => {
        throws(() => {
            parse_series.eval({
                prefix: encodeUtf8(`${PREFIX} assets`),
                token_name: encodeUtf8(`${PREFIX} assets 10 `)
            })
        }, /not a digit/)
    })

    it("id with leading 0s", () => {
        throws(() => {
            parse_series.eval({
                prefix: encodeUtf8(`${PREFIX} assets `),
                token_name: encodeUtf8(`${PREFIX} assets 010`)
            })
        }, /zero padded integer can't be parsed/)
    })

    it("id with trailing non-digit", () => {
        throws(() => {
            parse_series.eval({
                prefix: encodeUtf8(`${PREFIX} assets`),
                token_name: encodeUtf8(`${PREFIX} assets 100a`)
            })
        }, /not a digit/)
    })
})

describe("TokenNames::parse_assets", () => {
    it('"assets -1"', () => {
        strictEqual(
            parse_assets.eval({
                token_name: encodeUtf8(`${PREFIX} assets -1`)
            }),
            -1n
        )
    })

    it('"assets 0"', () => {
        strictEqual(
            parse_assets.eval({
                token_name: encodeUtf8(`${PREFIX} assets 0`)
            }),
            0n
        )
    })

    it('"assets 1"', () => {
        strictEqual(
            parse_assets.eval({
                token_name: encodeUtf8(`${PREFIX} assets 1`)
            }),
            1n
        )
    })

    it('"assets 10"', () => {
        strictEqual(
            parse_assets.eval({
                token_name: encodeUtf8(`${PREFIX} assets 10`)
            }),
            10n
        )
    })

    it('"assets 9999"', () => {
        strictEqual(
            parse_assets.eval({
                token_name: encodeUtf8(`${PREFIX} assets 9999`)
            }),
            9999n
        )
    })

    it("different prefix", () => {
        strictEqual(
            parse_assets.eval({
                token_name: encodeUtf8(`${PREFIX} voucher 10`)
            }),
            null
        )
    })

    it("id with leading space", () => {
        throws(() => {
            parse_assets.eval({
                token_name: encodeUtf8(`${PREFIX} assets  10`)
            })
        }, /not a digit/)
    })

    it("id with trailing space", () => {
        throws(() => {
            parse_assets.eval({
                token_name: encodeUtf8(`${PREFIX} assets 10 `)
            })
        }, /not a digit/)
    })

    it("id with leading 0s", () => {
        throws(() => {
            parse_assets.eval({
                token_name: encodeUtf8(`${PREFIX} assets 010`)
            })
        }, /zero padded integer can't be parsed/)
    })

    it("id with trailing non-digit", () => {
        throws(() => {
            parse_assets.eval({
                token_name: encodeUtf8(`${PREFIX} assets 100a`)
            })
        }, /not a digit/)
    })

    it("returns null with missing prefix", () => {
        strictEqual(
            parse_assets.eval({
                token_name: encodeUtf8(`assets 1`)
            }),
            null
        )
    })

    it("returns null with wrong prefix", () => {
        strictEqual(
            parse_assets.eval({
                token_name: encodeUtf8(`bPBG assets 1`)
            }),
            null
        )
    })
})

describe("TokenNames::has_assets_prefix", () => {
    it('true for "assets 1"', () => {
        strictEqual(
            has_assets_prefix.eval({
                token_name: encodeUtf8(`${PREFIX} assets 1`)
            }),
            true
        )
    })

    it('false for "voucher 1"', () => {
        strictEqual(
            has_assets_prefix.eval({
                token_name: encodeUtf8(`${PREFIX} voucher 1`)
            }),
            false
        )
    })
})

describe("TokenNames::parse_reimbursement", () => {
    it('"reimbursement -1"', () => {
        strictEqual(
            parse_reimbursement.eval({
                token_name: encodeUtf8(`${PREFIX} reimbursement -1`)
            }),
            -1n
        )
    })

    it('"reimbursement 0"', () => {
        strictEqual(
            parse_reimbursement.eval({
                token_name: encodeUtf8(`${PREFIX} reimbursement 0`)
            }),
            0n
        )
    })

    it('"reimbursement 1"', () => {
        strictEqual(
            parse_reimbursement.eval({
                token_name: encodeUtf8(`${PREFIX} reimbursement 1`)
            }),
            1n
        )
    })

    it('"reimbursement 10"', () => {
        strictEqual(
            parse_reimbursement.eval({
                token_name: encodeUtf8(`${PREFIX} reimbursement 10`)
            }),
            10n
        )
    })

    it('"reimbursement 9999"', () => {
        strictEqual(
            parse_reimbursement.eval({
                token_name: encodeUtf8(`${PREFIX} reimbursement 9999`)
            }),
            9999n
        )
    })

    it("different prefix", () => {
        strictEqual(
            parse_reimbursement.eval({
                token_name: encodeUtf8(`${PREFIX} voucher 10`)
            }),
            null
        )
    })

    it("id with leading space", () => {
        throws(() => {
            parse_reimbursement.eval({
                token_name: encodeUtf8(`${PREFIX} reimbursement  10`)
            })
        }, /not a digit/)
    })

    it("id with trailing space", () => {
        throws(() => {
            parse_reimbursement.eval({
                token_name: encodeUtf8(`${PREFIX} reimbursement 10 `)
            })
        }, /not a digit/)
    })

    it("id with leading 0s", () => {
        throws(() => {
            parse_reimbursement.eval({
                token_name: encodeUtf8(`${PREFIX} reimbursement 010`)
            })
        }, /zero padded integer can't be parsed/)
    })

    it("id with trailing non-digit", () => {
        throws(() => {
            parse_reimbursement.eval({
                token_name: encodeUtf8(`${PREFIX} reimbursement 100a`)
            })
        }, /not a digit/)
    })
})

describe("TokenNames::reimbursement", () => {
    it("-1", () => {
        deepEqual(
            reimbursement.eval({
                id: -1
            }),
            encodeUtf8(`${PREFIX} reimbursement -1`)
        )
    })

    it("0", () => {
        deepEqual(
            reimbursement.eval({
                id: 0
            }),
            encodeUtf8(`${PREFIX} reimbursement 0`)
        )
    })

    it("1", () => {
        deepEqual(
            reimbursement.eval({
                id: 1
            }),
            encodeUtf8(`${PREFIX} reimbursement 1`)
        )
    })

    it("10", () => {
        deepEqual(
            reimbursement.eval({
                id: 10
            }),
            encodeUtf8(`${PREFIX} reimbursement 10`)
        )
    })

    it("9999", () => {
        deepEqual(
            reimbursement.eval({
                id: 9999
            }),
            encodeUtf8(`${PREFIX} reimbursement 9999`)
        )
    })
})

describe("TokenNames::parse_voucher_ref", () => {
    it('"voucher -1"', () => {
        strictEqual(
            parse_voucher_ref.eval({
                token_name: cip68_100_prefix.concat(
                    encodeUtf8(`${PREFIX} voucher -1`)
                )
            }),
            -1n
        )
    })

    it('"voucher 0"', () => {
        strictEqual(
            parse_voucher_ref.eval({
                token_name: cip68_100_prefix.concat(
                    encodeUtf8(`${PREFIX} voucher 0`)
                )
            }),
            0n
        )
    })

    it('"voucher 1"', () => {
        strictEqual(
            parse_voucher_ref.eval({
                token_name: cip68_100_prefix.concat(
                    encodeUtf8(`${PREFIX} voucher 1`)
                )
            }),
            1n
        )
    })

    it('"voucher 10"', () => {
        strictEqual(
            parse_voucher_ref.eval({
                token_name: cip68_100_prefix.concat(
                    encodeUtf8(`${PREFIX} voucher 10`)
                )
            }),
            10n
        )
    })

    it('"voucher 9999"', () => {
        strictEqual(
            parse_voucher_ref.eval({
                token_name: cip68_100_prefix.concat(
                    encodeUtf8(`${PREFIX} voucher 9999`)
                )
            }),
            9999n
        )
    })

    it("missing cip67 prefix", () => {
        strictEqual(
            parse_voucher_ref.eval({
                token_name: encodeUtf8(`${PREFIX} voucher -1`)
            }),
            null
        )
    })

    it("id with leading space", () => {
        throws(() => {
            parse_voucher_ref.eval({
                token_name: cip68_100_prefix.concat(
                    encodeUtf8(`${PREFIX} voucher  10`)
                )
            })
        }, /not a digit/)
    })

    it("id with trailing space", () => {
        throws(() => {
            parse_voucher_ref.eval({
                token_name: cip68_100_prefix.concat(
                    encodeUtf8(`${PREFIX} voucher 10 `)
                )
            })
        }, /not a digit/)
    })

    it("id with leading 0s", () => {
        throws(() => {
            parse_voucher_ref.eval({
                token_name: cip68_100_prefix.concat(
                    encodeUtf8(`${PREFIX} voucher 010`)
                )
            })
        }, /zero padded integer can't be parsed/)
    })

    it("id with trailing non-digit", () => {
        throws(() => {
            parse_voucher_ref.eval({
                token_name: cip68_100_prefix.concat(
                    encodeUtf8(`${PREFIX} voucher 100a`)
                )
            })
        }, /not a digit/)
    })
})

describe("TokenNames::parse_voucher_nft", () => {
    it('"voucher -1"', () => {
        strictEqual(
            parse_voucher_nft.eval({
                token_name: cip68_222_prefix.concat(
                    encodeUtf8(`${PREFIX} voucher -1`)
                )
            }),
            -1n
        )
    })

    it('"voucher 0"', () => {
        strictEqual(
            parse_voucher_nft.eval({
                token_name: cip68_222_prefix.concat(
                    encodeUtf8(`${PREFIX} voucher 0`)
                )
            }),
            0n
        )
    })

    it('"voucher 1"', () => {
        strictEqual(
            parse_voucher_nft.eval({
                token_name: cip68_222_prefix.concat(
                    encodeUtf8(`${PREFIX} voucher 1`)
                )
            }),
            1n
        )
    })

    it('"voucher 10"', () => {
        strictEqual(
            parse_voucher_nft.eval({
                token_name: cip68_222_prefix.concat(
                    encodeUtf8(`${PREFIX} voucher 10`)
                )
            }),
            10n
        )
    })

    it('"voucher 9999"', () => {
        strictEqual(
            parse_voucher_nft.eval({
                token_name: cip68_222_prefix.concat(
                    encodeUtf8(`${PREFIX} voucher 9999`)
                )
            }),
            9999n
        )
    })

    it("missing cip67 prefix", () => {
        strictEqual(
            parse_voucher_nft.eval({
                token_name: encodeUtf8(`${PREFIX} voucher -1`)
            }),
            null
        )
    })

    it("id with leading space", () => {
        throws(() => {
            parse_voucher_nft.eval({
                token_name: cip68_222_prefix.concat(
                    encodeUtf8(`${PREFIX} voucher  10`)
                )
            })
        }, /not a digit/)
    })

    it("id with trailing space", () => {
        throws(() => {
            parse_voucher_nft.eval({
                token_name: cip68_222_prefix.concat(
                    encodeUtf8(`${PREFIX} voucher 10 `)
                )
            })
        }, /not a digit/)
    })

    it("id with leading 0s", () => {
        throws(() => {
            parse_voucher_nft.eval({
                token_name: cip68_222_prefix.concat(
                    encodeUtf8(`${PREFIX} voucher 010`)
                )
            })
        }, /zero padded integer can't be parsed/)
    })

    it("id with trailing non-digit", () => {
        throws(() => {
            parse_voucher_nft.eval({
                token_name: cip68_222_prefix.concat(
                    encodeUtf8(`${PREFIX} voucher 100a`)
                )
            })
        }, /not a digit/)
    })
})

describe("TokenNames::has_voucher_ref_prefix", () => {
    it('false for "voucher 1"', () => {
        strictEqual(
            has_voucher_ref_prefix.eval({
                token_name: encodeUtf8(`${PREFIX} voucher 1`)
            }),
            false
        )
    })

    it('false for "(222)voucher 1"', () => {
        strictEqual(
            has_voucher_ref_prefix.eval({
                token_name: cip68_222_prefix.concat(
                    encodeUtf8(`${PREFIX} voucher 1`)
                )
            }),
            false
        )
    })

    it('true for "(100)voucher 1"', () => {
        strictEqual(
            has_voucher_ref_prefix.eval({
                token_name: cip68_100_prefix.concat(
                    encodeUtf8(`${PREFIX} voucher 1`)
                )
            }),
            true
        )
    })
})

describe("TokenNames::has_voucher_nft_prefix", () => {
    it('false for "voucher 1"', () => {
        strictEqual(
            has_voucher_nft_prefix.eval({
                token_name: encodeUtf8(`${PREFIX} voucher 1`)
            }),
            false
        )
    })

    it('true for "(222)voucher 1"', () => {
        strictEqual(
            has_voucher_nft_prefix.eval({
                token_name: cip68_222_prefix.concat(
                    encodeUtf8(`${PREFIX} voucher 1`)
                )
            }),
            true
        )
    })

    it('false for "(100)voucher 1"', () => {
        strictEqual(
            has_voucher_nft_prefix.eval({
                token_name: cip68_100_prefix.concat(
                    encodeUtf8(`${PREFIX} voucher 1`)
                )
            }),
            false
        )
    })
})

describe("TokenNames::voucher_ref", () => {
    it("-1", () => {
        deepEqual(
            voucher_ref.eval({
                id: -1
            }),
            cip68_100_prefix.concat(encodeUtf8(`${PREFIX} voucher -1`))
        )
    })

    it("0", () => {
        deepEqual(
            voucher_ref.eval({
                id: 0
            }),
            cip68_100_prefix.concat(encodeUtf8(`${PREFIX} voucher 0`))
        )
    })

    it("1", () => {
        deepEqual(
            voucher_ref.eval({
                id: 1
            }),
            cip68_100_prefix.concat(encodeUtf8(`${PREFIX} voucher 1`))
        )
    })

    it("10", () => {
        deepEqual(
            voucher_ref.eval({
                id: 10
            }),
            cip68_100_prefix.concat(encodeUtf8(`${PREFIX} voucher 10`))
        )
    })

    it("9999", () => {
        deepEqual(
            voucher_ref.eval({
                id: 9999
            }),
            cip68_100_prefix.concat(encodeUtf8(`${PREFIX} voucher 9999`))
        )
    })
})

describe("TokenNames::voucher_nft", () => {
    it("-1", () => {
        deepEqual(
            voucher_nft.eval({
                id: -1
            }),
            cip68_222_prefix.concat(encodeUtf8(`${PREFIX} voucher -1`))
        )
    })

    it("0", () => {
        deepEqual(
            voucher_nft.eval({
                id: 0
            }),
            cip68_222_prefix.concat(encodeUtf8(`${PREFIX} voucher 0`))
        )
    })

    it("1", () => {
        deepEqual(
            voucher_nft.eval({
                id: 1
            }),
            cip68_222_prefix.concat(encodeUtf8(`${PREFIX} voucher 1`))
        )
    })

    it("10", () => {
        deepEqual(
            voucher_nft.eval({
                id: 10
            }),
            cip68_222_prefix.concat(encodeUtf8(`${PREFIX} voucher 10`))
        )
    })

    it("9999", () => {
        deepEqual(
            voucher_nft.eval({
                id: 9999
            }),
            cip68_222_prefix.concat(encodeUtf8(`${PREFIX} voucher 9999`))
        )
    })
})
