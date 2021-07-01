const printEdge = require("./print-edge");
const printNode = require("./print-node");

/**
 * @typedef {Object} Stack
 * @property {Stack} child
 * @property {Stack} parent
 * @property {any} node
 * @property {Set<any>} nodes
 * @property {any[]} edges
 */

const toLines = (nodes, edges, node, indent) => {
	const nodesArray = Array.from(nodes);
	const lines = [];
	for (let i = 0; i < edges.length; i++) {
		const edge = edges[i];
		const node = nodesArray[i];
		lines.push(
			`${i === 0 ? indent.slice(0, -2) + "+ " : indent}${printEdge(
				edge
			)} = ${printNode(node)}`
		);
		indent += " ";
	}
	lines.push(`${indent}${printNode(node)}`);
	return { lines, indent };
};

const stackToLines = (stack, indent) => {
	if (stack.parent) {
		const { lines: parentLines, indent: parentIndent } = stackToLines(
			stack.parent,
			indent
		);

		const { lines: myLines, indent: resultIdent } = toLines(
			stack.nodes,
			stack.edges,
			stack.node,
			parentIndent + " "
		);

		const { lines: childLines } = stackToLines(
			stack.parent.child,
			parentIndent.slice(0, -1) + "| "
		);

		return {
			lines: [...parentLines, ...childLines, ...myLines],
			indent: resultIdent,
		};
	}
	return toLines(stack.nodes, stack.edges, stack.node, indent);
};

module.exports = (stack) => {
	const { lines } = stackToLines(stack, "  ");
	return lines.reverse().join("\n");
};
