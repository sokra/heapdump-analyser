const { exec, fork } = require("child_process");
const fs = require("fs");
const path = require("path");
const rootPath = path.resolve(__dirname, "..");
const findLeaks = path.resolve(rootPath, "find-leaks.js");

const cleanOutput = (output) => {
	return output
		.replace(/@\d+/g, "@XXX")
		.replace(/internal \d+/g, "internal XXX");
};

describe("TestCase", () => {
	const testCasesPath = path.resolve(__dirname, "cases");
	for (const caseName of fs.readdirSync(testCasesPath)) {
		if (caseName.startsWith(".")) continue;
		describe(caseName, () => {
			it("should run the case", (done) => {
				exec(
					"node index.js",
					{
						cwd: path.resolve(testCasesPath, caseName),
					},
					done
				);
			});
			it("should analyse the result", (done) => {
				const file = fs.readFileSync(
					path.resolve(testCasesPath, caseName, "index.js")
				);
				const match = /^\/\/\s+(.+)\n/.exec(file);
				expect(match).toBeTruthy();
				const process = fork(
					findLeaks,
					[
						path.resolve(testCasesPath, caseName, "test.heapsnapshot"),
						match[1],
					],
					{
						cwd: rootPath,
						stdio: ["inherit", "pipe", "inherit", "ipc"],
					}
				);
				let output = "";
				process.stdout.on("data", (chunk) => (output += chunk));
				process.on("exit", (code) => {
					expect(code).toBe(0);
					expect(cleanOutput(output)).toMatchSnapshot();
					done();
				});
			});
		});
	}
});
