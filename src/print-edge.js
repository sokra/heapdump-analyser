const chalk = require("chalk");

module.exports = (edge) => {
	if (!edge) return chalk.redBright("undefined");
	switch (edge.type) {
		case "property":
			return `.${chalk.greenBright(edge.name_or_index)}`;
		case "element":
			return `[${chalk.greenBright(edge.name_or_index)}]`;
	}
	return `${chalk.gray(edge.type)} ${chalk.greenBright(edge.name_or_index)}`;
};
