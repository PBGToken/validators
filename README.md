# PBGToken Contract Validators for Cardano

PBG Token contract validators for Cardano, written in [Helios](https://www.helios-lang.io)

This is a mono-repo which contains 3 packages:
   - *root* package with Helios code
   - `test` package with Javascript unit tests 
   - `test/context` package with context configuration needed by unit tests

## Building

Run `npm install` first.

Running `npm run build` in the root package creates a Javascript bundle with Typescript definitions in `./dist/`. 

The generated JS/TS bundle contains all the validators, and user-defined types and data-functions used by those validators. This makes it easy to interact with the smart contract from within JS/TS.

## Audit recommendations

- use VSCode to look at the .hl files inside `./src`
- install the Helios IDE plugin through the VSCode Extensions tab 
   - search for "Helios"
   - the description of the plugin should read "Helios language support for VS Code"
- run `npm install` inside the repo so the IDE plugin can pick up the correct version of the compiler

## Unit tests

The unit tests are placed in the `./test` directory, and can be run with `npm test`.

### Context

The unit tests require another build step which applies parameters and creates a test *context* bundle. 

The test context bundle is placed in `./test/context/dist` and can be imported via the name `"pbg-token-validators-test-context"`.

The test context bundle contains serialized UPLC programs for each validator and each user-defined function, as well as utility functions for converting JS/TS values into `UplcData` instances.

## Inspecting the UPLC

First make sure the JS/TS definitions of the DVP smart contract are built:
```sh
$ npm install
$ npm run build
```

Then build the test context, which will use dummy parameters to create final runable UPLC programs:
```sh
$ cd ./test/context
$ npm run build
```

This could take a few minutes as UPLC programs for all smart contract functions are also generated.

You will find the serialized (CBOR hex) results in `test/context/dist/index.mjs`, by searching for `"optimizedCborHex"` and `"unoptimizedCborHex"`.