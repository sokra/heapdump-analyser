#!/usr/bin/env node

const { prompt } = require("inquirer");
const cliProgress = require("cli-progress");
const calculateDistances = require("./src/calculate-distances");
const getRetainerStack = require("./src/get-retainer-stack");
const printNode = require("./src/print-node");
const printStack = require("./src/print-stack");
const readHeapsnapshot = require("./src/read-heapsnapshot");
const filterBySnapshot = require("./src/filter-by-snapshot");

const formatSize = bytes => {
	if (bytes < 2048) return `${bytes} bytes`;
	bytes /= 1024;
	if (bytes < 2048) return `${Math.round(bytes * 10) / 10} kiB`;
	bytes /= 1024;
	if (bytes < 2048) return `${Math.round(bytes * 10) / 10} MiB`;
	bytes /= 1024;
	return `${Math.round(bytes * 10) / 10} GiB`;
};

let [, , file1, file2, file3, name] = process.argv;

process.exitCode = 1;

if (!file3) {
	file3 = file1;
	name = file2;
	file1 = undefined;
	file2 = undefined;
}

if (!file3) {
	console.log(
		"Invalid arguments: heapdump-analyser [<path-to-heapsnapshot> <path-to-heapsnapshot>] <path-to-heapsnapshot> [<name>]"
	);
	console.log(
		"When 3 headsnapshots are passed, it will show only object still alive in the 3rd snapsnot that were allocated between 1st and 2nd snapshot"
	);
	console.log(
		"<name> can be a class name, a function name ending with '()', or a object id starting with '@'."
	);
	console.log("Without <name> interactive mode is entered.");
	return;
}

(async () => {
	const snapshot1 = file1 && (await readHeapsnapshot(file1));
	const snapshot2 = file2 && (await readHeapsnapshot(file2));
	const snapshot = await readHeapsnapshot(file3);
	await calculateDistances(snapshot);
	let relevantNodes;
	if (snapshot1 && snapshot2) {
		await calculateDistances(snapshot1);
		await calculateDistances(snapshot2);
		relevantNodes = await filterBySnapshot(snapshot1, snapshot2, snapshot);
	} else {
		relevantNodes = snapshot.nodes;
	}
	console.log(
		`${relevantNodes.length} objects found, ${formatSize(
			relevantNodes.reduce((sum, n) => sum + n.self_size || 0, 0)
		)}`
	);
	const interalTypeRegexp =
		/^(internal|hidden|native|(sliced |concatenated )?string|regexp|bigint|symbol|number|synthetic|code|closure)$/;
	const getNodes = name => {
		let nodes;
		if (name.endsWith("()")) {
			const closureName = name.slice(0, -2);
			nodes = relevantNodes.filter(
				n =>
					n.name === closureName &&
					n.type === "closure" &&
					typeof n.distance === "number"
			);
		} else if (name.startsWith("@")) {
			const id = +name.slice(1);
			nodes = relevantNodes.filter(n => n.id === id);
		} else if (name.startsWith("(code) ")) {
			const codeName = name.slice(7);
			nodes = relevantNodes.filter(
				n =>
					n.name === codeName &&
					n.type === "code" &&
					typeof n.distance === "number"
			);
		} else {
			nodes = relevantNodes.filter(
				n =>
					n.name === name &&
					!interalTypeRegexp.test(n.type) &&
					typeof n.distance === "number"
			);
		}
		nodes.sort((a, b) => a.distance - b.distance);
		return nodes;
	};
	const numberNodes = nodes =>
		nodes.forEach((n, i) => (n.name += ` #${i + 1}`));
	const printNodeStacks = nodes => {
		let i = 0;
		const roots = new Set();
		for (const node of nodes) {
			if (i++ !== 0) console.log("\n");
			const stack = getRetainerStack(
				`${printNode(node)} (of ${nodes.length})`,
				node,
				roots
			);
			console.log(printStack(stack));
			roots.add(node);
		}
	};
	const resetNodes = nodes => {
		for (const node of nodes) {
			node.name = node.name.replace(/ #\d+$/, "");
		}
	};
	if (name) {
		// One off mode
		const nodes = getNodes(name);
		numberNodes(nodes);
		printNodeStacks(nodes);
	} else {
		// Interactive mode
		let allNames;
		while (true) {
			try {
				let { name } = await prompt({
					type: "input",
					name: "name",
					message:
						"Class name, closure name (ending with '()'), object id (starting with '@'), or leave empty to choose",
					askAnswered: true,
					validate: name => {
						if (!name) return true;
						const nodes = getNodes(name);
						if (nodes.length === 0)
							return "This object doesn't exist in the heapsnapshot.";
						return true;
					}
				});
				if (!name) {
					if (!allNames) {
						allNames = new Set();
						const bar = new cliProgress.SingleBar({
							format: `{bar} | {percentage}% | Finding available object types`,
							clearOnComplete: true
						});
						bar.start(relevantNodes.length);
						for (const node of relevantNodes) {
							if (
								node.type === "closure" &&
								typeof node.distance === "number"
							) {
								allNames.add(node.name + "()");
							} else if (
								node.type === "code" &&
								node.name &&
								typeof node.distance === "number"
							) {
								allNames.add("(code) " + node.name);
							} else if (
								!interalTypeRegexp.test(node.type) &&
								node.name &&
								typeof node.distance === "number"
							) {
								allNames.add(node.name);
							} else bar.increment();
						}
						bar.stop();
						allNames = Array.from(allNames).sort();
					}
					const { type } = await prompt({
						type: "list",
						name: "type",
						message: "Type of object",
						choices: ["object", "closure", "code", "internal", "internal code"],
						askAnswered: true
					});
					({ name } = await prompt({
						type: "list",
						name: "name",
						message: "Object type",
						choices: ["Abort"].concat(
							allNames.filter(n => {
								const nType = n.endsWith("()")
									? "closure"
									: n.startsWith("(code) (")
									? "internal code"
									: n.startsWith("(code) ")
									? "code"
									: n.startsWith("(")
									? "internal"
									: "object";
								return nType === type;
							})
						),
						askAnswered: true
					}));
				}
				if (name === "Abort") continue;
				let nodes = getNodes(name);
				numberNodes(nodes);
				try {
					if (nodes.length > 5) {
						const { choice } = await prompt({
							type: "list",
							name: "choice",
							message: `${nodes.length} objects found in heapsnapshot.`,
							choices: [
								{
									name: `Print all ${nodes.length} objects`,
									value: "all"
								},
								{ name: "Select objects to print...", value: "select" },
								{ name: "Abort", value: false }
							],
							askAnswered: true
						});
						if (!choice) {
							continue;
						}
						if (choice === "select") {
							const choices = nodes
								.map(node => ({
									name: printNode(node),
									value: node
								}))
								.concat({
									name: "Abort",
									value: false
								});
							let lastSelectedNode = choices[0].value;
							while (true) {
								const { selectedNode } = await prompt({
									type: "list",
									name: "selectedNode",
									message: `Object to print`,
									choices,
									default: lastSelectedNode,
									askAnswered: true
								});
								if (!selectedNode) break;
								lastSelectedNode = selectedNode;
								printNodeStacks([selectedNode]);
							}
							continue;
						}
					}
					printNodeStacks(nodes);
				} finally {
					resetNodes(nodes);
				}
			} catch (e) {
				console.log(e.stack);
			}
		}
	}
})().then(
	() => {
		process.exitCode = 0;
	},
	e => {
		console.error(e.stack);
	}
);
