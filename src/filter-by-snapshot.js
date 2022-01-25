const cliProgress = require("cli-progress");

const edge = (node, name) => {
	return node.edges.find((e) => e.node_or_index === name);
};

const properties = (node) => {
	return node.edges
		.filter((e) => e.type === "property")
		.map((e) => e.name_or_index)
		.sort();
};

const compare = (a, b, unsure) => {
	if (a.type !== b.type) return false;
	if (a.name !== b.name) return false;
	if (a.self_size !== b.self_size) return false;
	switch (a.type) {
		case "synthetic":
			if (a.name.startsWith("(")) return true;
			return unsure;
			break;
		case "hidden":
		case "array":
			return unsure;
		case "string":
		case "number":
		case "symbol":
		case "code":
		case "regexp":
		case "bigint":
		case "native":
			return !!a.name;
		case "concatenated string": {
			const a1 = edge(a, "first");
			const b1 = edge(b, "first");
			const a2 = edge(a, "second");
			const b2 = edge(b, "second");
			return (
				a1 && b1 && a2 && b2 && compare(a1, b1, false) && compare(a2, b2, false)
			);
		}
		case "sliced string": {
			const ap = edge(a, "parent");
			const bp = edge(b, "parent");
			return ap && bp && compare(ap, bp, false);
		}
		case "object": {
			const ap = properties(a);
			const bp = properties(b);
			if (ap.join() !== bp.join()) return false;
			if (ap.length > 2) return true;
		}
		case "closure": {
			const ac = edge(a, "context");
			const bc = edge(b, "context");
			if (!ac || !ab || !compare(ac, bc, true)) return false;
			const ap = properties(a);
			const bp = properties(b);
			if (ap.join() !== bp.join()) return false;
			if (ap.length > 2) return true;
		}
	}
	return unsure;
};

module.exports = (s1, s2, s3) => {
	const bar = new cliProgress.SingleBar({
		format: "{bar} | {percentage}% | Filter by allocated nodes",
		clearOnComplete: true,
	});
	bar.start(3);
	const byId1 = new Map();
	for (const node of s1.nodes) {
		if (typeof node.distance === "number") byId1.set(node.id, node);
	}
	bar.increment();
	const byId2 = new Map();
	for (const node of s2.nodes) {
		if (typeof node.distance === "number") byId2.set(node.id, node);
	}
	bar.increment();
	const result = s3.nodes.filter((node) => {
		const n1 = byId1.get(node.id);
		if (n1 && compare(node, n1, false)) return false;
		const n2 = byId2.get(node.id);
		if (!n2 || !compare(node, n2, true)) return false;
		return true;
	});
	bar.increment();
	bar.stop();
	return result;
};
