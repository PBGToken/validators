# PBGToken Contract Validators for Cardano

PBG Token contract validators for Cardano, written in [Helios](https://www.helios-lang.io)

## Audit recommendations

- use VSCode to look at the .hl files inside `./src`
- install the Helios IDE plugin through the VSCode Extensions tab 
   - search for "Helios"
   - the description of the plugin should read "Helios language support for VS Code"
- run `npm run install` inside the repo so the IDE plugin can pick up the correct version of the compiler
- run `npm run build` and inspect the `./dist` directory to verify that the Helios sources are correctly transpiled into Javascript/Typescript
