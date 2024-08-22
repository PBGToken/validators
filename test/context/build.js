import { dirname, join } from "node:path"
import { build } from "esbuild"
import makeHeliosESBuildPlugin from "@helios-lang/esbuild-plugin"

async function main() {
    const repoRoot = join(dirname(process.argv[1]), "./")

    const srcBaseDir = join(repoRoot, "src")
    const dstBaseDir = join(repoRoot, "dist")

    const heliosLoader = makeHeliosESBuildPlugin({
        contextEntryPoint: join(repoRoot, "src", "index.ts")
    })

    await build({
        bundle: true,
        splitting: false,
        treeShaking: true,
        // all entry points that are accompanied by a Dockerfile have purely external package dependencies
        external: ["buffer", "child_process", "crypto", "events", "fs", "http", "http2", "https", "os", "path", "process", "stream", "url", "util", "node:*", "@helios-lang*"],
        format: "esm",
        banner: {
            // needed for esm calling node modules (see https://github.com/evanw/esbuild/pull/2067)
            js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);"
        },
        platform: "node",
        minify: false,
        outfile: join(dstBaseDir, "index.mjs"),
        entryPoints: [join(srcBaseDir, "index.ts")],
        plugins: [heliosLoader],
        tsconfig: join(repoRoot, "tsconfig.json")
    })
}

main()
