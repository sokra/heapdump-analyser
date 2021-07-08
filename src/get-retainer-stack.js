const cliProgress = require("cli-progress");
const getOtherWeakMapEdge = require("./get-other-weak-map-edge");
const isInternalEdge = require("./is-internal-edge");
const isStrongEdge = require("./is-strong-edge");
const printNode = require("./print-node");
const printStack = require("./print-stack");
const Heap = require("heap");
const printEdge = require("./print-edge");

const setWithItem = (set, item) => {
	const newSet = new Set(set);
	newSet.add(item);
	return newSet;
};

/**
 * @typedef {Object} Job
 * @property {number} estimatedTotalLength
 * @property {number} length
 * @property {Job[]} children
 * @property {any} node
 * @property {Set<any>} nodes
 * @property {any[]} edges
 * @property {Job} parent
 */

module.exports = (name, node, additionalRoots) => {
	const bar = new cliProgress.SingleBar({
		format: `{bar} | {percentage}% | Computing retainer stacks of ${name}{path}`,
		clearOnComplete: true,
	});

	let processedNodes = 0;
	let totalNodes = 0;

	bar.start(1, 0, { path: "" });

	const cycleSet = new Set([node]);
	const search = (job) => {
		const queue = new Heap((a, b) => {
			return a.estimatedTotalLength - b.estimatedTotalLength;
		});
		queue.push(job);
		const visited = new Map();
		while (!queue.empty()) {
			const job = queue.pop();
			if (job.node.distance === 0 || additionalRoots.has(job.node)) return job;
			const push = (newJob) => {
				if (isNaN(newJob.estimatedTotalLength)) debugger;
				totalNodes++;
				queue.push(newJob);
			};
			const node = job.node;
			const edges = node.from_edges.filter(
				(e) => isStrongEdge(e) && !isInternalEdge(e)
			);
			edgeLoop: for (const edge of edges) {
				const from_node = edge.from_node;
				if (typeof from_node.distance !== "number") continue;

				// check for cycle
				if (from_node === node) continue;
				let current = job;
				do {
					if (current.nodes.has(from_node)) continue edgeLoop;
				} while ((current = current.parent));
				if (cycleSet.has(from_node)) continue;
				if (visited.get(from_node) <= job.length) continue;

				const otherEdge = getOtherWeakMapEdge(edge);
				if (otherEdge) {
					const otherFromNode = otherEdge.from_node;
					if (typeof otherFromNode.distance !== "number") continue;

					// only visit one node
					if (
						otherFromNode.distance < from_node.distance ||
						(otherFromNode.distance === from_node.distance &&
							otherFromNode.id < from_node.id)
					) {
						continue;
					}

					// check for cycle
					if (otherFromNode === node) continue;
					let current = job;
					do {
						if (current.nodes.has(otherFromNode)) continue edgeLoop;
					} while ((current = current.parent));
					if (cycleSet.has(otherFromNode)) continue;
					// if (visited.get(otherFromNode) <= job.length) continue;

					cycleSet.add(node);
					otherResult = search({
						estimatedTotalLength: 1 + otherFromNode.distance,
						length: 1,
						node: otherFromNode,
						nodes: new Set([node]),
						edges: [otherEdge],
						parent: undefined,
					});
					cycleSet.delete(node);
					if (!otherResult) continue;

					job.child = otherResult;

					const length = job.length + otherResult.length + 1;
					push({
						estimatedTotalLength: length + from_node.distance,
						length,
						node: from_node,
						nodes: new Set([node]),
						edges: [edge],
						parent: job,
					});
				} else {
					const length = job.length + 1;
					push({
						estimatedTotalLength: length + from_node.distance,
						length,
						node: from_node,
						nodes: setWithItem(job.nodes, node),
						edges: [...job.edges, edge],
						parent: job.parent,
					});
				}
				visited.set(node, job.length);
			}
			if (processedNodes++ % 1024 === 0) {
				bar.setTotal(totalNodes);
				bar.update(processedNodes, {
					path:
						(cycleSet.size > 2 ? " > ..." : "") +
						Array.from(cycleSet)
							.slice(-2)
							.map((n) => ` > ${printNode(n, true)}`)
							.join(""),
				});
			}
		}
		return false;
	};

	const result = search({
		estimatedTotalLength: node.distance,
		length: 0,
		node,
		nodes: new Set(),
		edges: [],
		parent: undefined,
	});
	bar.stop();
	return result;
};
