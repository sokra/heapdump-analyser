module.exports = (edge) => {
	const from_node = edge.from_node;
	if (
		from_node.type === "hidden" &&
		from_node.name === "system / FeedbackCell"
	) {
		return true;
	}
	if (from_node.type === "code") {
		return true;
	}
	return false;
};
