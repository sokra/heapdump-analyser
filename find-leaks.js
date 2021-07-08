#!/usr/bin/env node

const calculateDistances = require("./src/calculate-distances");
const getRetainerStack = require("./src/get-retainer-stack");
const printNode = require("./src/print-node");
const printStack = require("./src/print-stack");
const readHeapsnapshot = require("./src/read-heapsnapshot");

const [, , filename, name] = process.argv;

process.exitCode = 1;

if (!filename || !name) {
	console.log(
		"Invalid arguments: heapdump-analyser <path-to-heapsnapshot> <name>"
	);
	console.log(
		"<name> can be a class name, or a function name ending with '()'"
	);
	return;
}

(async () => {
	let snapshot = await readHeapsnapshot(filename);
	await calculateDistances(snapshot);
	let nodes;
	if (name.endsWith("()")) {
		const closureName = name.slice(0, -2);
		nodes = snapshot.nodes.filter(
			(n) =>
				n.name === closureName &&
				n.type === "closure" &&
				typeof n.distance === "number"
		);
	} else {
		nodes = snapshot.nodes.filter(
			(n) =>
				n.name === name && n.type === "object" && typeof n.distance === "number"
		);
	}
	nodes.sort((a, b) => a.distance - b.distance);
	nodes.forEach((n, i) => (n.name += ` #${i + 1}`));
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
})().then(
	() => {
		process.exitCode = 0;
	},
	(e) => {
		console.error(e.stack);
	}
);
