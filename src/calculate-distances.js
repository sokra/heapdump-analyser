const cliProgress = require("cli-progress");
const isInternalEdge = require("./is-internal-edge");
const isStrongEdge = require("./is-strong-edge");

module.exports = (snapshot) => {
	const bar = new cliProgress.SingleBar({
		format: "{bar} | {percentage}% | Calculate distances",
		clearOnComplete: true,
	});
	bar.start(40);
	let queue = [snapshot.nodes.find((node) => node.name === "(GC roots)")];
	for (let i = 0; queue.length > 0; i++) {
		const nextQueue = [];
		for (const node of queue) {
			if (node.distance === undefined) {
				node.distance = i;
				for (const edge of node.edges) {
					if (!isStrongEdge(edge)) continue;
					if (isInternalEdge(edge)) continue;
					nextQueue.push(edge.to_node);
				}
			}
		}
		queue = nextQueue;
		bar.increment();
	}
	bar.stop();
};
