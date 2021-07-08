// TestObject

let GLOBAL;
(() => {
	class TestObject {}

	const a = new TestObject();
	const b = new TestObject();
	const c = new TestObject();
	const d = new TestObject();

	const map1 = new WeakMap();
	const map2 = new WeakMap();
	const map3 = new WeakMap();
	map1.set(a, b);
	map2.set(b, c);
	map3.set(c, d);
	map1.set(b, map3);
	GLOBAL = {
		maps: [map1, map2],
		key: a,
	};
})();
require("heapdump").writeSnapshot("test.heapsnapshot");
