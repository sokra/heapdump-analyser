module.exports = (edge) => {
	if (edge.name_or_index === "current_microtask" && edge.type === "internal") {
		return true;
	}
	return false;
};
