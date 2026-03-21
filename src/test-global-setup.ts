import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const target = resolve("src/lib/server/build-info.generated.ts");
const stub = resolve("src/lib/server/__mocks__/build-info.generated.ts");

export function setup() {
    if (!existsSync(target)) {
        mkdirSync(resolve("src/lib/server"), { recursive: true });
        copyFileSync(stub, target);
    }
}
