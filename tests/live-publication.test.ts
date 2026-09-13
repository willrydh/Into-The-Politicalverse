import assert from "node:assert/strict";
import test from "node:test";
import {
  digest,
  downloadIndexedArchive,
  INDEX_URLS,
} from "../lib/live/official-files";

const url =
  "https://resultat.val.se/resultatfiler/val2026/p/rd/Val_2026_preliminar_00_RD.zip";
const old = Buffer.from("old test archive"),
  current = Buffer.from("new test archive");
const entry = { url, md5: digest(old, "md5") };
const index = (archive: Buffer) =>
  Buffer.from(
    `${digest(archive, "md5")}  ./p/rd/Val_2026_preliminar_00_RD.zip\n`,
  );

test("a newer archive is accepted only after the refreshed official index names its exact checksum", async () => {
  const calls: string[] = [];
  const result = await downloadIndexedArchive(entry, {
    mode: "production",
    stage: "preliminary",
    fetchFile: async (u) => {
      calls.push(u);
      return u === url ? current : index(current);
    },
    pause: async () => {
      assert.fail("No pause needed once the official index matches");
    },
  });
  assert.equal(result.entry.md5, digest(current, "md5"));
  assert.equal(result.archive, current);
  assert.deepEqual(calls, [url, INDEX_URLS.production]);
});

test("an older archive is retried with bounded waits and still has to match the index", async () => {
  let downloads = 0,
    pauses = 0;
  const result = await downloadIndexedArchive(
    { url, md5: digest(current, "md5") },
    {
      mode: "production",
      stage: "preliminary",
      fetchFile: async (u) =>
        u === url ? (++downloads === 1 ? old : current) : index(current),
      pause: async () => {
        pauses++;
      },
    },
  );
  assert.equal(result.archive, current);
  assert.equal(downloads, 2);
  assert.equal(pauses, 1);
});

test("permanent mismatch, missing phases and unsafe index entries remain failures", async () => {
  let downloads = 0,
    pauses = 0;
  await assert.rejects(
    downloadIndexedArchive(entry, {
      mode: "production",
      stage: "preliminary",
      fetchFile: async (u) => {
        if (u === url) {
          downloads++;
          return current;
        }
        return index(old);
      },
      pause: async () => {
        pauses++;
      },
    }),
    /checksum after bounded/,
  );
  assert.equal(downloads, 3);
  assert.equal(pauses, 2);
  for (const contents of [
    Buffer.from(""),
    Buffer.from(`${entry.md5} ./p/../evil.zip`),
  ]) {
    await assert.rejects(
      downloadIndexedArchive(entry, {
        mode: "production",
        stage: "preliminary",
        fetchFile: async (u) => (u === url ? current : contents),
        pause: async () => {
          assert.fail("Missing or invalid index must stop immediately");
        },
      }),
      /disappeared|unsafe/,
    );
  }
});
