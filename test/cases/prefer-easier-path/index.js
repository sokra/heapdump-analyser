// TestObject

let GLOBAL;
(() => {
	class TestObject {}

	const a = {};
	const b = new TestObject();

	const map = new WeakMap();
	map.set(a, b);
	GLOBAL = {
		map: map,
		key: a,
		deep: {
			nested: b,
		},
	};
})();
require("heapdump").writeSnapshot("test.heapsnapshot");
