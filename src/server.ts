import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import z from "zod";

const server = new McpServer(
  {
    name: "hola-mcp",
    version: "0.0.1",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  }
);

server.registerTool(
  "Consultar un pokemon",
  {
    title: "Consultar un pokemon",
    inputSchema: {
      name: z.string().describe("Nombre del pokemon a consultar"),
    },
    outputSchema: z.object({
      name: z.string(),
      height: z.number(),
      weight: z.number(),
    }).describe("Información del pokemon"),
  },
  async (params) => {
    const { name } = params;
    const pokemonData = await fetchPokemon(name);
    return {content: [
      {type: "text", text: `Nombre: ${pokemonData.name}`},
      {type: "text", text: `Altura: ${pokemonData.height}`},
      {type: "text", text: `Peso: ${pokemonData.weight}`},
    ]};        
  }
);

async function fetchPokemon(name: string) {
  const response = await fetch(
    `https://pokeapi.co/api/v2/pokemon/${name.toLowerCase()}`
  );
  if (!response.ok) {
    throw new Error(`Pokemon ${name} not found`);
  }
  const data = await response.json();
  const cleanedData = {
    name: data.name,
    height: data.height,
    weight: data.weight,
  };
  return cleanedData;
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
