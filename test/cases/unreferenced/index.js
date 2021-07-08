// TestObject

let GLOBAL;
(() => {
	class TestObject {}

	const a = new TestObject();
	const b = new TestObject();
	const c = new TestObject();
	const d = new TestObject();
	const e = new TestObject();

	const key = {};

	const map1 = new WeakMap();
	const map2 = new WeakMap();
	const map3 = new WeakMap();
	map1.set(a, b);
	map2.set(c, d);
	map3.set(key, e);
	GLOBAL = {
		maps: [map1, map2],
		key,
	};
})();
require("heapdump").writeSnapshot("test.heapsnapshot");
