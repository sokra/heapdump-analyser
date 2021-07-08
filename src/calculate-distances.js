const cliProgress = require("cli-progress");
const getOtherWeakMapEdge = require("./get-other-weak-map-edge");
const isInternalEdge = require("./is-internal-edge");
const isStrongEdge = require("./is-strong-edge");

module.exports = (snapshot) => {
	const bar = new cliProgress.SingleBar({
		format: "{bar} | {percentage}% | Calculate distances",
		clearOnComplete: true,
	});
	bar.start(40);
	const gcRoot = snapshot.nodes.find((node) => node.name === "(GC roots)");
	let queue = gcRoot.edges.map((e) => e.to_node);
	for (let i = 0; queue.length > 0; i++) {
		const nextQueue = [];
		for (const node of queue) {
			if (node.distance === undefined) {
				node.distance = i;
				for (const edge of node.edges) {
					if (!isStrongEdge(edge)) continue;
					if (isInternalEdge(edge)) continue;
					if (!edge.otherWeakMapEdge) {
						const other = getOtherWeakMapEdge(edge);
						if (other !== undefined) {
							edge.otherWeakMapEdge = other;
							other.otherWeakMapEdge = edge;
							if (other.from_node.distance === undefined) continue;
						}
					} else {
						if (edge.otherWeakMapEdge.from_node.distance === undefined)
							continue;
					}
					nextQueue.push(edge.to_node);
				}
			}
		}
		queue = nextQueue;
		bar.increment();
	}
	bar.stop();
};
