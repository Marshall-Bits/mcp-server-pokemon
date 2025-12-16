import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import z from "zod";
import { readFileSync } from "fs";
import path from "path";

const guideText = readFileSync(
  path.resolve(process.cwd(), "usage-guide.md"),
  "utf8"
);

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
// TOOLS
server.registerTool(
  "consultar-pokemon",
  {
    title: "Consultar los datos de un pokemon a través del nombre",
    description:
      "Indicando solo el nombre podemos obtener la información del peso y la alutra de un pokemon",
    inputSchema: {
      name: z.string().describe("El nombre del pokemon a buscar"),
    },
  },
  async (params) => {
    const { name } = params;
    const pokemonData = await fetchPokemon(name);
    return {
      content: [{ type: "text", text: pokemonData }],
    };
  }
);

server.registerTool(
  "crear-pokemon",
  {
    title: "Generar un nuevo pokemon en la base de datos",
    description:
      "Indicando el nombre o id del pokemon se va a añadir a la base de datos",
    inputSchema: {
      nameOrId: z.string().describe("El nombre del pokemon a buscar o su id"),
    },
  },
  async (params) => {
    const { nameOrId } = params;
    const data = await postPokemon(nameOrId);
    return {
      content: [{ type: "text", text: data }],
    };
  }
);

// RESOURCES
server.registerResource(
  "guia",
  "docs://pokemon/guia", // URI BASE
  {
    title: "Guia para usar el MCP server",
    mimeType: "text/markdown",
  },
  async (uri) => {
    // HANDLER que maneja el recurso a devolver
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: guideText,
        },
      ],
    };
  }
);

server.registerResource(
  "ejemplo de pokemon",
  new ResourceTemplate("docs://pokemon/{pokemon}", { list: undefined }),
  {
    title: "Objeto de ejemplo con los datos de un pokemon",
    description: "Obtenemos el recurso de un pokemon sólo con su nombre",
    mimeType: "text/plain",
  },
  async (uri, { pokemon }) => {
    const data = await fetchPokemon(pokemon as string);
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "text/plain",
          text: data,
        },
      ],
    };
  }
);

async function fetchPokemon(name: string) {
  const response = await fetch(
    `https://pokeapi.co/api/v2/pokemon/${name.toLocaleLowerCase().trim()}`
  );
  if (!response.ok) {
    throw new Error(`Pokemon ${name} not found`);
  }

  const data = await response.json();

  return `Nombre: ${data.name}, Altura: ${data.height}, Peso: ${data.weight}`;
}

async function postPokemon(nameOrId: string) {
  const response = await fetch("http://localhost:3000/pokemons", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nameOrId }),
  });

  if (!response.ok) {
    throw new Error(`POST fallido: ${response.status} ${response.statusText}`);
  }

  return await response.text();
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
