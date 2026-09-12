import { z } from "zod";
import { AIDO_SKILL_BUNDLE } from "./generated/aido-skill-bundle.js";

const listSkillsRequestSchema = z.object({
  method: z.literal("skills/list"),
  params: z.object({ cursor: z.string().max(256).optional() }).optional()
});
const getSkillRequestSchema = z.object({
  method: z.literal("skills/get"),
  params: z.object({ uri: z.string().max(2048) })
});

function publicSkillEntry() {
  return {
    uri: AIDO_SKILL_BUNDLE.uri,
    frontmatter: AIDO_SKILL_BUNDLE.frontmatter,
    resources: AIDO_SKILL_BUNDLE.resources.map(({ uri, digest }) => ({ uri, digest }))
  };
}

export function registerSkillImport(server) {
  const resources = new Map(AIDO_SKILL_BUNDLE.resources.map((resource) => [resource.uri, resource]));
  server.server.registerCapabilities({
    extensions: { "io.modelcontextprotocol/skills": {} }
  });

  server.server.setRequestHandler(listSkillsRequestSchema, ({ params }) => {
    if (params?.cursor) return { skills: [] };
    return { skills: [publicSkillEntry()] };
  });
  server.server.setRequestHandler(getSkillRequestSchema, ({ params }) => {
    if (params.uri !== AIDO_SKILL_BUNDLE.uri) throw new Error("Skill not found");
    return { skill: publicSkillEntry() };
  });

  for (const resource of resources.values()) {
    server.registerResource(
      resource.uri.split("/").at(-1),
      resource.uri,
      { title: resource.uri, mimeType: resource.mimeType },
      async () => ({
        contents: [{ uri: resource.uri, mimeType: resource.mimeType, text: resource.text }]
      })
    );
  }
}

export { AIDO_SKILL_BUNDLE };
