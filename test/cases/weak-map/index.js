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
	map1.set(a, b);
	map2.set(c, d);
	GLOBAL = {
		map: map1,
		key: c,
		deep: {
			nested: {
				key: a,
				map: map2,
			},
		},
	};
})();
require("heapdump").writeSnapshot("test.heapsnapshot");
