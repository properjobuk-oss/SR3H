import { createHash } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";

const [endpoint] = process.argv.slice(2);
if (!endpoint) {
  console.error("Usage: node scripts/verify-skill-import.mjs <mcp-url>");
  process.exit(2);
}

const resourceSchema = z.object({ uri: z.string(), digest: z.string() });
const skillSchema = z.object({
  uri: z.string(),
  frontmatter: z.record(z.string()),
  resources: z.array(resourceSchema)
});
const client = new Client({ name: "aido-skill-import-verifier", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(new URL(endpoint));

try {
  await client.connect(transport);
  const extension = client.getServerCapabilities()?.extensions?.["io.modelcontextprotocol/skills"];
  if (!extension) throw new Error("skills extension was not advertised");

  const catalog = await client.request({ method: "skills/list", params: {} }, z.object({ skills: z.array(skillSchema) }));
  if (catalog.skills.length !== 1) throw new Error(`expected one skill, received ${catalog.skills.length}`);
  const listed = catalog.skills[0];
  if (listed.frontmatter.name !== "aido-discoverability-check") throw new Error("unexpected skill name");

  const fetched = await client.request({ method: "skills/get", params: { uri: listed.uri } }, z.object({ skill: skillSchema }));
  if (JSON.stringify(fetched.skill) !== JSON.stringify(listed)) throw new Error("skills/get did not match skills/list");

  for (const item of listed.resources) {
    const result = await client.readResource({ uri: item.uri });
    if (result.contents.length !== 1 || typeof result.contents[0].text !== "string") throw new Error(`resource was not readable: ${item.uri}`);
    const digest = `sha256:${createHash("sha256").update(result.contents[0].text, "utf8").digest("hex")}`;
    if (digest !== item.digest) throw new Error(`digest mismatch: ${item.uri}`);
  }

  console.log(JSON.stringify({
    ok: true,
    server: client.getServerVersion(),
    skill: listed.frontmatter.name,
    resources: listed.resources.length,
    digests_verified: true
  }, null, 2));
} finally {
  await client.close();
}
