#!/usr/bin/env node

const { prompt } = require("inquirer");
const cliProgress = require("cli-progress");
const calculateDistances = require("./src/calculate-distances");
const getRetainerStack = require("./src/get-retainer-stack");
const printNode = require("./src/print-node");
const printStack = require("./src/print-stack");
const readHeapsnapshot = require("./src/read-heapsnapshot");

const [, , filename, name] = process.argv;

process.exitCode = 1;

if (!filename) {
	console.log(
		"Invalid arguments: heapdump-analyser <path-to-heapsnapshot> [<name>]"
	);
	console.log(
		"<name> can be a class name, a function name ending with '()', or a object id starting with '@'."
	);
	console.log("Without <name> interactive mode is entered.");
	return;
}

(async () => {
	let snapshot = await readHeapsnapshot(filename);
	await calculateDistances(snapshot);
	const getNodes = (name) => {
		let nodes;
		if (name.endsWith("()")) {
			const closureName = name.slice(0, -2);
			nodes = snapshot.nodes.filter(
				(n) =>
					n.name === closureName &&
					n.type === "closure" &&
					typeof n.distance === "number"
			);
		} else if (name.startsWith("@")) {
			const id = +name.slice(1);
			nodes = snapshot.nodes.filter((n) => n.id === id);
		} else {
			nodes = snapshot.nodes.filter(
				(n) =>
					n.name === name &&
					n.type === "object" &&
					typeof n.distance === "number"
			);
		}
		nodes.sort((a, b) => a.distance - b.distance);
		return nodes;
	};
	const numberNodes = (nodes) =>
		nodes.forEach((n, i) => (n.name += ` #${i + 1}`));
	const printNodeStacks = (nodes) => {
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
	const resetNodes = (nodes) => {
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
					validate: (name) => {
						if (!name) return true;
						const nodes = getNodes(name);
						if (nodes.length === 0)
							return "This object doesn't exist in the heapsnapshot.";
						return true;
					},
				});
				if (!name) {
					if (!allNames) {
						allNames = new Set();
						const bar = new cliProgress.SingleBar({
							format: `{bar} | {percentage}% | Finding available object types`,
							clearOnComplete: true,
						});
						bar.start(snapshot.nodes.length);
						for (const node of snapshot.nodes) {
							if (
								node.type === "object" &&
								node.name &&
								typeof node.distance === "number"
							) {
								allNames.add(node.name);
							} else if (
								node.type === "closure" &&
								typeof node.distance === "number"
							) {
								allNames.add(node.name + "()");
							}
							bar.increment();
						}
						bar.stop();
						allNames = Array.from(allNames).sort();
					}
					const { type } = await prompt({
						type: "list",
						name: "type",
						message: "Type of object",
						choices: ["object", "closure"],
						askAnswered: true,
					});
					({ name } = await prompt({
						type: "list",
						name: "name",
						message: "Object type",
						choices: allNames.filter(
							(n) => !((type === "closure") ^ n.endsWith("()"))
						),
						askAnswered: true,
					}));
				}
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
									value: "all",
								},
								{ name: "Select objects to print...", value: "select" },
								{ name: "Abort", value: false },
							],
							askAnswered: true,
						});
						if (!choice) {
							continue;
						}
						if (choice === "select") {
							const choices = nodes
								.map((node) => ({
									name: printNode(node),
									value: node,
								}))
								.concat({
									name: "Abort",
									value: false,
								});
							let lastSelectedNode = choices[0].value;
							while (true) {
								const { selectedNode } = await prompt({
									type: "list",
									name: "selectedNode",
									message: `Object to print`,
									choices,
									default: lastSelectedNode,
									askAnswered: true,
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
	(e) => {
		console.error(e.stack);
	}
);
