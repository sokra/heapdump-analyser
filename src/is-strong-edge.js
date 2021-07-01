module.exports = (edge) => {
	if (edge.type === "weak") return false;
	// const from_node = edge.from_node;
	// if (
	// 	from_node.type === "hidden" &&
	// 	from_node.name === "system / FeedbackCell"
	// ) {
	// 	return false;
	// }
	return true;
};
