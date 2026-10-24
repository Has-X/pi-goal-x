/** Native Windows sharing-violation checks; run by the focused Windows CI group. */
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawn} from "node:child_process";
import {once} from "node:events";
import {atomicRenamer} from "../../extensions/storage/atomic-rename.ts";
import {atomicWriteGoalFile} from "../../extensions/storage/goal-files.ts";

const script = `
$ErrorActionPreference = 'Stop'
$stream = [System.IO.File]::Open($env:PI_GOAL_TEST_LOCK, [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::ReadWrite)
try {
  [Console]::WriteLine('READY'); [Console]::Out.Flush()
  while (!(Test-Path -LiteralPath $env:PI_GOAL_TEST_RELEASE)) { Start-Sleep -Milliseconds 1 }
  Start-Sleep -Milliseconds 10
} finally { $stream.Dispose() }
`;

async function lock(target: string, release: string) {
	const child = spawn("pwsh", ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], {
		env: {...process.env, PI_GOAL_TEST_LOCK: target, PI_GOAL_TEST_RELEASE: release}, stdio: ["ignore", "pipe", "pipe"],
	});
	let output = "", errors = "";
	child.stderr.on("data", chunk => {errors += chunk;});
	await new Promise<void>((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error(`Windows lock startup timed out: ${errors}`)), 10000);
		child.once("error", reject);
		child.once("exit", code => {clearTimeout(timeout); if (!output.includes("READY")) reject(new Error(`Lock exited ${code}: ${errors}`));});
		child.stdout.on("data", chunk => {output += chunk; if (output.includes("READY")) {clearTimeout(timeout); resolve();}});
	});
	let closed = false;
	return {child, close: async () => {
		if (closed) return;
		closed = true;
		const exited = child.exitCode === null ? once(child, "exit") : Promise.resolve();
		fs.writeFileSync(release, "release");
		await exited;
	}};
}

for (const asynchronous of [false, true]) test(`native Windows ${asynchronous ? "async" : "sync"} replacement succeeds after a sharing lock clears`, {timeout: 20000}, async t => {
	assert.equal(process.platform, "win32");
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "goal sharing Ω "));
	let holder: Awaited<ReturnType<typeof lock>> | undefined;
	t.after(async () => {await holder?.close(); fs.rmSync(cwd, {recursive: true, force: true});});
	const source = path.join(cwd, "source"), target = path.join(cwd, "target"), release = path.join(cwd, "release");
	fs.writeFileSync(source, "new"); fs.writeFileSync(target, "old");
	holder = await lock(target, release);
	let failures = 0;
	const failure = (error: unknown) => {
		assert.ok(["EPERM", "EACCES", "EBUSY"].includes((error as NodeJS.ErrnoException).code!));
		failures++;
		fs.writeFileSync(release, "release");
		throw error;
	};
	const renamer = atomicRenamer("win32", {
		renameSync: (a,b) => {try {fs.renameSync(a,b);} catch (error) {failure(error);}},
		rename: async (a,b) => {try {await fs.promises.rename(a,b);} catch (error) {failure(error);}},
		isDirectorySync: () => false, isDirectory: async () => false,
		sleepSync: ms => {Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);},
		sleep: ms => new Promise(resolve => setTimeout(resolve,ms)),
	});
	if (asynchronous) await renamer.rename(source,target); else renamer.renameSync(source,target);
	assert.ok(failures >= 1, "the real OS rejected at least one rename before releasing the lock");
	assert.equal(fs.readFileSync(target,"utf8"),"new");
	assert.equal(fs.existsSync(source),false);
	await holder.close();
});

test("native Windows permanent sharing failure preserves the target and cleans the goal writer's temporary file", {timeout: 20000}, async t => {
	assert.equal(process.platform,"win32");
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(),"goal permanent lock "));
	let holder: Awaited<ReturnType<typeof lock>> | undefined;
	t.after(async () => {await holder?.close(); fs.rmSync(cwd,{recursive:true,force:true});});
	atomicWriteGoalFile({cwd},".pi/goals",".pi/goals/goal.md","original");
	const target=path.join(cwd,".pi/goals/goal.md"), release=path.join(cwd,"release");
	holder=await lock(target,release);
	const start=performance.now();
	assert.throws(() => atomicWriteGoalFile({cwd},".pi/goals",".pi/goals/goal.md","replacement"), error => ["EPERM","EACCES","EBUSY"].includes((error as NodeJS.ErrnoException).code!));
	assert.ok(performance.now()-start < 1000,"the critical writer returns promptly under a permanent lock");
	assert.equal(fs.readFileSync(target,"utf8"),"original");
	assert.deepEqual(fs.readdirSync(path.dirname(target)),["goal.md"]);
	await holder.close();
});
