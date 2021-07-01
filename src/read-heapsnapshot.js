const path = require("path");
const fs = require("fs");
const cliProgress = require("cli-progress");
const { Transform, pipeline, Writable } = require("stream");
const { parser } = require("stream-json");

module.exports = async (filename) =>
	new Promise((resolve, reject) => {
		class Processor extends Writable {
			constructor() {
				super({ objectMode: true });
				this._mode = "";
				this._stack = [];
				this._data = [];
				this._current = [];
				this._handlePartial = undefined;

				this.meta = {};
				this.data = {};
			}
			_getPartialHandler(mode) {
				switch (mode) {
					case "nodes": {
						this.data.nodes = new Uint32Array(
							this.meta.node_count * this.meta.node_fields.length
						);
						let i = 0;
						return (array) => {
							for (const item of array) {
								this.data.nodes[i++] = item;
							}
							array.length = 0;
						};
					}
					case "edges": {
						this.data.edges = new Uint32Array(
							this.meta.edge_count * this.meta.edge_fields.length
						);
						let i = 0;
						return (array) => {
							for (const item of array) {
								this.data.edges[i++] = item;
							}
							array.length = 0;
						};
					}
				}
			}
			_handle(mode, data) {
				switch (mode) {
					case "node_fields":
					case "node_types":
					case "edge_fields":
					case "edge_types":
					case "node_count":
					case "edge_count":
						this.meta[mode] = data;
						break;
					case "strings":
						this.data.strings = data;
						break;
				}
			}
			_write(chunk, encoding, callback) {
				switch (chunk.name) {
					case "keyValue":
						if (this._handlePartial !== undefined) {
							this._handlePartial(...this._current);
						}
						this._handle(this._mode, ...this._current);
						this._stack.length = 0;

						this._mode = chunk.value;
						this._data = this._current = [];
						this._stack.push(this._data);
						this._handlePartial = this._getPartialHandler(this._mode);
						break;
					case "startArray": {
						this._stack.push(this._data);
						const data = this._data;
						this._data = [];
						data.push(this._data);
						break;
					}
					case "endArray":
						this._data = this._stack.pop();
						break;
					case "stringValue":
						this._data.push(chunk.value);
						break;
					case "numberValue":
						this._data.push(+chunk.value);
						break;
					default:
						break;
				}
				if (
					this._data !== undefined &&
					this._data.length === 100000 &&
					this._handlePartial !== undefined
				) {
					this._handlePartial(...this._current);
				}
				callback();
			}
			_final(callback) {
				if (this._handlePartial !== undefined) {
					this._handlePartial(...this._current);
				}
				this._handle(this._mode, ...this._current);
				this._stack.length = 0;

				try {
					const bar = new cliProgress.SingleBar({
						format: "{bar} | {percentage}% | Decoding heapsnapshot",
						clearOnComplete: true,
					});

					let incCounter = 0;
					const inc = () =>
						(incCounter = (incCounter + 1) % 1024) || bar.increment();

					const decodeArray = (fields, types, data) => {
						const result = [];
						let i = 0;
						while (i < data.length) {
							const item = { index: i };
							for (let j = 0; j < fields.length; j++) {
								const name = fields[j];
								const type = types ? types[j] : "number";
								const value = data[i];
								// item[name + "_raw"] = value;
								if (Array.isArray(type)) {
									item[name] = type[value];
								} else if (type === "number") {
									item[name] = value;
								} else if (type === "string") {
									item[name] = strings[value];
								} else if (type === "string_or_number") {
									item[name] =
										item.type === "hidden" || item.type === "element"
											? value
											: strings[value];
								} else if (type === "node") {
									item[name] = nodes[value / meta.node_fields.length];
								} else {
									throw new Error(`Type ${type} is not implemented`);
								}
								i++;
							}
							result.push(item);
							inc();
						}
						return result;
					};

					const {
						meta,
						data: { strings },
					} = this;

					bar.start(
						(this.data.nodes.length / meta.node_fields.length +
							this.data.edges.length / meta.edge_fields.length) /
							1024
					);

					const nodes = decodeArray(
						meta.node_fields,
						meta.node_types,
						this.data.nodes
					);
					// const nodesById = new Map(nodes.map((n) => [n.id, n]));
					const edges = decodeArray(
						meta.edge_fields,
						meta.edge_types,
						this.data.edges
					);
					bar.stop();

					// connect edges
					{
						const bar = new cliProgress.SingleBar({
							format: "{bar} | {percentage}% | Connecting edges",
							clearOnComplete: true,
						});
						bar.start((nodes.length + edges.length) / 1024);
						let incCounter = 0;
						const inc = () =>
							(incCounter = (incCounter + 1) % 1024) || bar.increment();
						let e = 0;
						for (const node of nodes) {
							node.from_edges = [];
							node.edges = [];
							for (let i = 0; i < node.edge_count; i++) {
								const edge = edges[e++];
								node.edges.push(edge);
								edge.from_node = node;
							}
							inc();
						}
						for (const edge of edges) {
							if (edge.to_node) edge.to_node.from_edges.push(edge);
							inc();
						}
						bar.stop();
					}

					resolve({
						meta,
						nodes,
						edges,
						strings,
					});
					callback();
				} catch (e) {
					callback(e);
				}
			}
		}
		const pathname = path.resolve(filename);
		const size = fs.statSync(pathname).size;
		const bar = new cliProgress.SingleBar({
			format: "{bar} | {percentage}% | Reading heapsnapshot",
			clearOnComplete: true,
		});
		bar.start(size, 0);
		class Progress extends Transform {
			_transform(chunk, encoding, callback) {
				bar.increment(chunk.length);
				this.push(chunk, encoding);
				callback();
			}
			_final(callback) {
				bar.stop();
				callback();
			}
		}
		pipeline(
			fs.createReadStream(pathname, {
				highWaterMark: 10 * 1024 * 1024,
			}),
			new Progress(),
			parser({
				streamKeys: false,
				streamNumbers: false,
				streamStrings: false,
				streamValues: false,
				packNumbers: true,
				packStrings: true,
				packKeys: true,
				packValues: true,
			}),
			new Processor(),
			(e) => {
				if (e) reject(e);
			}
		);
	});
