const chalk = require("chalk");

module.exports = (node, short) => {
	if (!node) return chalk.redBright("undefined");
	if (node.type === "closure") {
		let fnNode = node;
		let prefix = "";
		while (true) {
			const bound_function = fnNode.edges.find(
				(e) => e.name_or_index === "bound_function"
			)?.to_node;
			const await_function = fnNode.edges
				.find((e) => e.name_or_index === "context")
				?.to_node.edges.find((e) => e.name_or_index === "extension")
				?.to_node.edges.find((e) => e.name_or_index === "function")?.to_node;
			if (bound_function) {
				fnNode = bound_function;
				prefix += "bound ";
			} else if (await_function) {
				fnNode = await_function;
				prefix += "awaited in ";
			} else {
				break;
			}
		}
		const name = fnNode.edges
			.find((e) => e.name_or_index === "shared")
			?.to_node.edges.find((e) => e.name_or_index === "script_or_debug_info")
			?.to_node.edges.find((e) => e.name_or_index === "name")?.to_node.name;
		const codeName = fnNode.edges.find((e) => e.name_or_index === "code")
			?.to_node?.name;
		if (name && !short) {
			return `${prefix}${chalk.cyanBright(node.name)}() in ${chalk.blueBright(
				name
			)} @${node.id}`;
		} else if (codeName && !short) {
			return `${prefix}${chalk.cyanBright(node.name)}() ${chalk.blueBright(
				codeName
			)} @${node.id}`;
		} else {
			return `${prefix}${chalk.cyanBright(node.name)}() @${node.id}`;
		}
	}
	if (!short && node.type === "object") {
		switch (node.name) {
			case "Object": {
				let properties = node.edges
					.filter(
						(e) => e.type === "property" && e.name_or_index !== "__proto__"
					)
					.map((e) =>
						e.name_or_index.length > 20
							? e.name_or_index.slice(0, 10) +
							  "..." +
							  e.name_or_index.slice(-10)
							: e.name_or_index
					);
				if (properties.length > 10) {
					properties = [...properties.slice(0, 10), "..."];
				}
				return `object ${chalk.cyanBright(`{ ${properties.join(", ")} }`)} @${
					node.id
				}`;
			}
			case "NormalModule":
				const requestEdge = node.edges.find(
					(e) => e.type === "property" && e.name_or_index === "request"
				);
				if (requestEdge) {
					return `object ${chalk.cyanBright(node.name)} ${chalk.blueBright(
						requestEdge.to_node.name
					)} @${node.id}`;
				}
				break;
			case "Chunk":
				const nameEdge = node.edges.find(
					(e) => e.type === "property" && e.name_or_index === "name"
				);
				if (nameEdge) {
					return `object ${chalk.cyanBright(node.name)} ${chalk.blueBright(
						nameEdge.to_node.name
					)} @${node.id}`;
				}
				const idEdge = node.edges.find(
					(e) => e.type === "property" && e.name_or_index === "id"
				);
				if (idEdge) {
					return `object ${chalk.cyanBright(node.name)} ${chalk.blueBright(
						idEdge.to_node.name
					)} @${node.id}`;
				}
				break;
		}
	}
	return `${node.type} ${chalk.cyanBright(node.name)} @${node.id}`;
};
