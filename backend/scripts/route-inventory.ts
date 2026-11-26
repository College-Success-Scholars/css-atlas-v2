/**
 * Prints every mounted Express route as `METHOD PATH ACCESS`, one per line.
 * Diff the output before and after a refactor to prove no route moved or lost
 * a gate. See src/tests/support/route-inventory.ts.
 */
import { inventoryLines } from "../src/tests/support/route-inventory.js";

console.log(inventoryLines().join("\n"));
