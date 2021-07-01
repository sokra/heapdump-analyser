module.exports = (edge) => {
	if (edge.type !== "internal") return;
	const name = edge.name_or_index;
	if (typeof name !== "string") return;
	if (!/\/ part of key .+ -> value .+ pair in WeakMap/.test(name)) return;
	const idx = name.lastIndexOf("/");
	const key = name.slice(idx);
	const otherEdges = edge.to_node.from_edges;
	return otherEdges.find(
		(e) =>
			e.type === "internal" &&
			typeof e.name_or_index === "string" &&
			e.name_or_index.endsWith(key) &&
			e !== edge
	);
};
