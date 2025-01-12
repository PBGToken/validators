import * as fs from "node:fs"
import { encodeUtf8 } from "@helios-lang/codec-utils"
import "@helios-lang/contract-utils/set-fs-build-cache"
import { makeContractContextBuilder, writeContractContextArtifacts } from "@helios-lang/contract-utils"
import { makePubKeyHash, makeTxId, makeTxOutputId } from "@helios-lang/ledger"
import {
    makeByteArrayData,
    makeIntData,
    makeListData
} from "@helios-lang/uplc"
import {
    assets_validator,
    benchmark_delegate,
    burn_order_validator,
    config_validator,
    fund_policy,
    governance_delegate,
    metadata_validator,
    mint_order_validator,
    oracle_delegate,
    portfolio_validator,
    price_validator,
    reimbursement_validator,
    supply_validator,
    voucher_validator
} from "pbg-token-validators"
import { generateBytes, mulberry32 } from "@helios-lang/crypto"
import { makeRootPrivateKey } from "@helios-lang/tx-utils"

/**
 * @import { PubKeyHash } from "@helios-lang/ledger"
 * @import { UplcData } from "@helios-lang/uplc"
 */

/**
 * @type {PubKeyHash[]}
 */
const INITIAL_ONLINE_GOV_KEYS = [
    makePubKeyHash("883c5cd1fdbf9d2b2fbd30982e9fb974cf07201bd55e6871e4294f83"),
    makePubKeyHash("e1d9857af3bf0c8e8b67583e3dfe2d5d5d177ea027f81da2f9577723"),
    makePubKeyHash("9e06855dfa440f490a3d50da2bc2fac5b1d0c1d09f2d8847097adeac")
]

/**
 * @type {PubKeyHash[]}
 */
const INITIAL_ONLINE_ORACLE_KEYS = [
    makePubKeyHash("80edfa909a3d40a54fca4c3ee852c7ba2a79391738911dc363580dc2"),
    makePubKeyHash("ab25d3b9476a3e3343a2f353b08b40913c573de7d286ef37ac4013e0"),
    makePubKeyHash("7bd1ebc8230f961193fb772204542e85425af4f7a8f36acb5543da08")
]

const INITIAL_ONLINE_GOV_KEYS_DATA = makeListData(
    INITIAL_ONLINE_GOV_KEYS.map((k) => k.toUplcData())
)

const INITIAL_ONLINE_ORACLE_KEYS_DATA = makeListData(
    INITIAL_ONLINE_ORACLE_KEYS.map((k) => k.toUplcData())
)

const INITIAL_ONLINE_SUCCESS_FEE = makeListData([
    makeIntData(0),
    makeListData([makeListData([makeIntData(1_025_000), makeIntData(300_000)])])
])


const EMULATOR_AGENT_ROOT_KEY = makeRootPrivateKey(
    generateBytes(mulberry32(0), 32)
)
const EMULATOR_AGENT_PUB_KEY =
    EMULATOR_AGENT_ROOT_KEY.deriveSpendingKey().derivePubKey()
const EMULATOR_AGENT_PUB_KEY_HASH = EMULATOR_AGENT_PUB_KEY.hash()

const EMULATOR_GOV0_ROOT_KEY = makeRootPrivateKey(
    generateBytes(mulberry32(1), 32)
)
const EMULATOR_GOV0_PUB_KEY =
    EMULATOR_GOV0_ROOT_KEY.deriveSpendingKey().derivePubKey()
const EMULATOR_GOV0_PUB_KEY_HASH = EMULATOR_GOV0_PUB_KEY.hash()

const EMULATOR_GOV1_ROOT_KEY = makeRootPrivateKey(
    generateBytes(mulberry32(2), 32)
)
const EMULATOR_GOV1_PUB_KEY =
    EMULATOR_GOV1_ROOT_KEY.deriveSpendingKey().derivePubKey()
const EMULATOR_GOV1_PUB_KEY_HASH = EMULATOR_GOV1_PUB_KEY.hash()

const EMULATOR_GOV2_ROOT_KEY = makeRootPrivateKey(
    generateBytes(mulberry32(3), 32)
)
const EMULATOR_GOV2_PUB_KEY =
    EMULATOR_GOV2_ROOT_KEY.deriveSpendingKey().derivePubKey()
const EMULATOR_GOV2_PUB_KEY_HASH = EMULATOR_GOV2_PUB_KEY.hash()

/**
 * @type {Record<string, Record<string, UplcData>>}
 */
const CONTEXT_PARAMETERS = {
    Mainnet: {
        "fund_policy::SEED_ID": makeTxOutputId(
            "f4e7e483c236c511d5d665e94c709d294084b69347d6f83ec92a90d258b4c841#1"
        ).toUplcData(),
        "fund_policy::INITIAL_NAME": makeByteArrayData(encodeUtf8("PBG Token")),
        "fund_policy::INITIAL_DESCRIPTION": makeByteArrayData(
            encodeUtf8("The first DVP")
        ),
        "fund_policy::INITIAL_TICKER": makeByteArrayData(
            encodeUtf8("PBG")
        ),
        "fund_policy::INITIAL_URL": makeByteArrayData(
            encodeUtf8("https://token.pbg.io")
        ),
        "fund_policy::INITIAL_LOGO": makeByteArrayData(
            encodeUtf8("https://token.pbg.io/logo.png")
        ),
        "fund_policy::INITIAL_BURN_FEE": makeIntData(30_000n),
        "fund_policy::INITIAL_MINT_FEE": makeIntData(30_000n),
        "fund_policy::INITIAL_CYCLE_PERIOD": makeIntData(50 * 24 * 3600 * 1000), // until 21 dec if launched on the 1st of nov
        "fund_policy::INITIAL_AGENT": makePubKeyHash(
            "0e20e50c171c50d2bd604ba3ef24f6019233a6e79b84c7d4e11bab0f"
        ).toUplcData(),
        "fund_policy::INITIAL_SUCCESS_FEE": INITIAL_ONLINE_SUCCESS_FEE,
        "governance_delegate::GOV_KEYS": INITIAL_ONLINE_GOV_KEYS_DATA,
        "oracle_delegate::ORACLE_KEYS": INITIAL_ONLINE_ORACLE_KEYS_DATA,
        "TokenNames::PREFIX_STRING": makeByteArrayData(
            encodeUtf8("PBG")
        )
    },
    Beta: {
        "fund_policy::SEED_ID": makeTxOutputId(
            "738fe4bd4892c7ef6f7bd0c6b5900e0e2f59cbc3aefe1eacdf0bade3134b0f82#0"
        ).toUplcData(),
        "fund_policy::INITIAL_NAME": makeByteArrayData(
            encodeUtf8("Beta PBG Token")
        ),
        "fund_policy::INITIAL_DESCRIPTION": makeByteArrayData(
            encodeUtf8("Integration testing DVP")
        ),
        "fund_policy::INITIAL_TICKER": makeByteArrayData(
            encodeUtf8("bPBG")
        ),
        "fund_policy::INITIAL_URL": makeByteArrayData(
            encodeUtf8("https://beta.pbgtoken.io")
        ),
        "fund_policy::INITIAL_LOGO": makeByteArrayData(
            encodeUtf8("https://beta.pbgtoken.io/logo.png")
        ),
        "fund_policy::INITIAL_BURN_FEE": makeIntData(30_000n),
        "fund_policy::INITIAL_MINT_FEE": makeIntData(30_000n),
        "fund_policy::INITIAL_CYCLE_PERIOD": makeIntData(50 * 24 * 3600 * 1000), // until 21 dec if launched on the 1st of nov
        "fund_policy::INITIAL_AGENT": makePubKeyHash(
            "80edfa909a3d40a54fca4c3ee852c7ba2a79391738911dc363580dc2"
        ).toUplcData(),
        "fund_policy::INITIAL_SUCCESS_FEE": INITIAL_ONLINE_SUCCESS_FEE,
        "governance_delegate::GOV_KEYS": INITIAL_ONLINE_GOV_KEYS_DATA,
        "oracle_delegate::ORACLE_KEYS": INITIAL_ONLINE_ORACLE_KEYS_DATA,
        "TokenNames::PREFIX_STRING": makeByteArrayData(encodeUtf8("bPBG"))
    },
    Preprod: {
        "fund_policy::SEED_ID": makeTxOutputId(
            "6751b1e2ce4ada10ac758119b8f390b3494042171a33b86f4a2a7a29eeb3f03c#4"
        ).toUplcData(),
        "fund_policy::INITIAL_NAME": makeByteArrayData(
            encodeUtf8("Testnet PBG Token")
        ),
        "fund_policy::INITIAL_DESCRIPTION": makeByteArrayData(
            encodeUtf8("Preprod DVP")
        ),
        "fund_policy::INITIAL_TICKER": makeByteArrayData(
            encodeUtf8("tPBG")
        ),
        "fund_policy::INITIAL_URL": makeByteArrayData(
            encodeUtf8("https://preprod.pbgtoken.io")
        ),
        "fund_policy::INITIAL_LOGO": makeByteArrayData(
            encodeUtf8("https://preprod.pbgtoken.io/logo.png")
        ),
        "fund_policy::INITIAL_BURN_FEE": makeIntData(30_000n),
        "fund_policy::INITIAL_MINT_FEE": makeIntData(30_000n),
        "fund_policy::INITIAL_CYCLE_PERIOD": makeIntData(50 * 24 * 3600 * 1000), // until 21 dec if launched on the 1st of nov
        "fund_policy::INITIAL_AGENT": makePubKeyHash(
            "a3527f67e636f3200fef95378e2ef12e86f1a6366cc87734945d46d2"
        ).toUplcData(),
        "fund_policy::INITIAL_SUCCESS_FEE": INITIAL_ONLINE_SUCCESS_FEE,
        "governance_delegate::GOV_KEYS": INITIAL_ONLINE_GOV_KEYS_DATA,
        "oracle_delegate::ORACLE_KEYS": INITIAL_ONLINE_ORACLE_KEYS_DATA,
        "TokenNames::PREFIX_STRING": makeByteArrayData(
            encodeUtf8("tPBG")
        )
    },
    Emulator: {
        "fund_policy::SEED_ID": makeTxOutputId(
            makeTxId(new Array(32).fill(0)),
            0
        ).toUplcData(),
        "fund_policy::INITIAL_AGENT": EMULATOR_AGENT_PUB_KEY_HASH.toUplcData(),
        "fund_policy::INITIAL_UPDATE_DELAY": makeIntData(10 * 24 * 3600 * 1000), // 2 epochs -> 10 days (to have slighly more frequent parameter updates during an emulation run)
        "fund_policy::INITIAL_CYCLE_PERIOD": makeIntData(30 * 24 * 3600 * 1000), // 6 epochs -> 30 days (because we don't want to waste time emulation a multi-timescale problem with a 365 day cycle)
        "governance_delegate::GOV_KEYS": makeListData([
            EMULATOR_GOV0_PUB_KEY_HASH.toUplcData(),
            EMULATOR_GOV1_PUB_KEY_HASH.toUplcData(),
            EMULATOR_GOV2_PUB_KEY_HASH.toUplcData()
        ]),
        // reuse the gov keys for the oracle, but in a different order so we get another address
        "oracle_delegate::ORACLE_KEYS": makeListData([
            EMULATOR_GOV2_PUB_KEY_HASH.toUplcData(),
            EMULATOR_GOV1_PUB_KEY_HASH.toUplcData(),
            EMULATOR_GOV0_PUB_KEY_HASH.toUplcData()
        ])
    }
}

/**
 * @typedef {{
 *   assets_validator?: string
 *   benchmark_delegate?: string
 *   burn_order_validator?: string
 *   config_validator?: string
 *   fund_policy?: string
 *   governance_delegate?: string
 *   metadata_validator?: string
 *   mint_order_validator?: string
 *   oracle_delegate?: string
 *   portfolio_validator?: string
 *   price_validator?: string
 *   reimbursement_validator?: string
 *   supply_validator?: string
 *   voucher_validator?: string
 * }} ExpectedHashes
 */

/**
 * @type {Record<string, ExpectedHashes>}
 */
const EXPECTED_HASHES = {
    Mainnet: {
        assets_validator:
            "58d33b5203a1a5a4157cab5503ae579f5277dacf7fa07dccb428cc59",
        benchmark_delegate:
            "929e32e92e08e486e2cea633346590fbba0037d9dc082eb4477e6253",
        burn_order_validator:
            "fffee534d121ebcf3085ec2c170c8b98281211c9bc6c2fc7ad351dc4",
        config_validator:
            "3c0300efbcd9fac0971e2cca2d53520c4be1c5183153f3278da5d68a",
        fund_policy: "03b6ddacd60cc1ebd9ed4041d0c298c4c6f48ab61e04fdad4d915cfa",
        governance_delegate:
            "1fe160289f7e13bd006fc56cad4c73ec4bd366181a0f5836d4f3bb8d",
        metadata_validator:
            "d76ee51518a7cbbb672fee6b465f745c241b1ccbfb79ebf81e69cfcd",
        mint_order_validator:
            "c9ba5257ed665f3165ceb9e2a74a38b6f6da1d93a56612e0d52447cf",
        oracle_delegate:
            "65bac629ba84a1db1548d88e20286344ba05ccfa32f7ac38dc4b1483",
        portfolio_validator:
            "968550ca1edefaed2b973fe522b0d06f4919503258cfde532f251af5",
        price_validator:
            "d5790406000db18085dacdacbc2837866f05b9c3bbf3c92c60a168bb",
        reimbursement_validator:
            "f74fc72ba0dc25cec15dc12466cd4343bd719ab485b6b64b695c9c2e",
        supply_validator:
            "ffbfb44b231e8311608ea310f12c49a5227ce2e988d2b071a327e1f5",
        voucher_validator:
            "fef86f0a6f5e20826ceb1a02c110e9470a7b1668c864716fbfbd6345"
    },
    Beta: {
        assets_validator:
            "ccf6f79049e521a2b90c5b08ac73c9de3eb0cb0f697e2e787f78cfba",
        benchmark_delegate:
            "929e32e92e08e486e2cea633346590fbba0037d9dc082eb4477e6253",
        burn_order_validator:
            "a56ce81cf293d2a6c65c94825467f82c453ae4cc615e22c2ba99469d",
        config_validator:
            "70f18cd8fa80e4d37026aeaadeac15bfe6898ad1b0e68fc84ca1a2ce",
        fund_policy: "a93af7588d587b9abdaddb4abbc4b818c58175d841054fcca8371a8a",
        governance_delegate:
            "1fe160289f7e13bd006fc56cad4c73ec4bd366181a0f5836d4f3bb8d",
        metadata_validator:
            "c3d750e4f7f8514e06358f152660b855137e1b3f3f50c4f0ad265e8b",
        mint_order_validator:
            "d4dc03bc7f29a1c9179c842d2ba990e50cc767fa03a47c5ece543649",
        oracle_delegate:
            "65bac629ba84a1db1548d88e20286344ba05ccfa32f7ac38dc4b1483",
        portfolio_validator:
            "23d8f3ed456809d1aca61a75d018822f359fd044449575feb020fd8a",
        price_validator:
            "7e3ce17e9f99984350546c0bbe14da82ca6881255af95053633a7ef8",
        reimbursement_validator:
            "1f840e1785e1c116601529c4a7cf23f8f37a750018bc43d9dce59a4e",
        supply_validator:
            "ec378dfe369938a5984cba22873461f58033e8c3ae10bb4ff21742f6",
        voucher_validator:
            "89d4502ff3fdc8a4c6b3e1d8387360fccd157177a12329b1cde0b966"
    },
    Preprod: {
        assets_validator:
            "5cbc07d6cb6d23191116ab02e7c58f8a4e3779c63f7a109819928568",
        benchmark_delegate:
            "929e32e92e08e486e2cea633346590fbba0037d9dc082eb4477e6253",
        burn_order_validator:
            "ff2e83f75fc1693872dbf39ef431c78d36cd2fc990c7bad9ac58451e",
        config_validator:
            "658ee614cbb6577b82c38f331bf79503d7e77baa66b5555687ee01de",
        fund_policy: "1fd38a7e152b5033e6b2f45447cbb98683a7214f3ab2b71b9ffaa04b",
        governance_delegate:
            "1fe160289f7e13bd006fc56cad4c73ec4bd366181a0f5836d4f3bb8d",
        metadata_validator:
            "45534829ff49d1513078001e8e437fe89fd7ef01b85af2adeeb2f5c7",
        mint_order_validator:
            "858d3635f5c06fb9cf67b31f0da7e97797794729ab6bbe0335c2d11b",
        oracle_delegate:
            "65bac629ba84a1db1548d88e20286344ba05ccfa32f7ac38dc4b1483",
        portfolio_validator:
            "a0e6b96ed3ea9fa4eaba7b2e605247f298dd551c0cc4cd6cb209faa0",
        price_validator:
            "a9c846aa9ecb2b2208122029b9459fd95f2f776090f41c1a9a99ce59",
        reimbursement_validator:
            "7e3ecc6f6641e1935d0b29fac0eb5ea04cd30461ea354db807d4ed4d",
        supply_validator:
            "0813a6308bd6fb301d8b12801fe3bb3cc598732b8b62b2f485604177",
        voucher_validator:
            "ea11935f6196d4ef38beca329a987acce19c95ced2affaa99ef835ae"
    },
    Emulator: {}
}

for (let stage of ["Emulator", "Preprod", "Beta", "Mainnet"]) {
    const context = makeContractContextBuilder()
        .with(assets_validator)
        .with(benchmark_delegate)
        .with(burn_order_validator)
        .with(config_validator)
        .with(fund_policy)
        .with(governance_delegate)
        .with(metadata_validator)
        .with(mint_order_validator)
        .with(oracle_delegate)
        .with(portfolio_validator)
        .with(price_validator)
        .with(reimbursement_validator)
        .with(supply_validator)
        .with(voucher_validator)
        .build({
            isMainnet: ["Beta", "Mainnet"].includes(stage),
            parameters: CONTEXT_PARAMETERS[stage],
            expectedHashes: EXPECTED_HASHES[stage]
        })

    writeContractContextArtifacts(context, {
        outDir: `./dist/${stage.toLocaleLowerCase()}`,
        fs
    })
}