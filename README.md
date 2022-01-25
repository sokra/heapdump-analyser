# heapdump-analyser

```sh
heapdump-analyser dump.heapsnapshot
```

Enters interactive mode.

```sh
heapdump-analyser dump.heapsnapshot ClassToFind
heapdump-analyser dump.heapsnapshot ClosureToFind()
heapdump-analyser dump.heapsnapshot @IdToFind
```

Finds all `ClassToFind` classes or ClosureToFind closures in the heapsnapshot and prints out a colorful retainer trace for them.

```sh
heapdump-analyser a.heapsnapshot b.heapsnapshot c.heapsnapshot [ClassToFind|ClosureToFind()|@IdToFind]
```

Finds only retained objects in c.heapsnapshot that were allocated between a.heapsnapshot and b.heapsnapshot.

Compared to the v8 devtools it

- correctly analyses WeakMaps and circular dependencies within them.
- eliminates references between the classes/closures you are looking for.

Note that it may take a large amount of memory for the analysis so you may want to increase the max memory with `NODE_OPTIONS=--max_old_space_size=16000`. It takes about 16x size of heapsnapshot.

## Creating a heapsnapshot

Note that creating a heapsnapshot is pretty slow and blocks execution of your code.

### Node.js CLI

Since Node.js 16 you can use [`--heapsnapshot-near-heap-limit=1`](https://nodejs.org/api/cli.html#cli_heapsnapshot_near_heap_limit_max_count) to create a heapsnapshot when the process runs out of memory. Best reduce the available amount of memory via `--max_old_space_size=500` to make it run out of memory faster and make the size of the heapsnapshot smaller.

```sh
node --max_old_space_size=500 --heapsnapshot-near-heap-limit=1 program.js
```

It also possible to create a heapsnapshot on a signal via [`--heapsnapshot-signal=SIGUSR2`](https://nodejs.org/api/cli.html#cli_heapsnapshot_signal_signal)

```sh
node --heapsnapshot-signal=SIGUSR2 program.js

ps aux
kill -USR2 1234
```

### heapdump package

The [npm package `heapdump`](https://www.npmjs.com/package/heapdump) allows to create a heapsnapshot from javascript:

```js
console.log("creating heapdump...");
require("heapdump").writeSnapshot((err) => console.log("done", err));
```

### Node.js devtools

Using the devtools is not recommended since the devtools affect the results, are very slow and crash when the heapsnapshot is too large.
