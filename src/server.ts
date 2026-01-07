import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import z from "zod";
import { readFileSync } from "fs";
import path from "path";
import { CreateMessageResultSchema } from "@modelcontextprotocol/sdk/types.js";
import express, { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

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
  "consultar-pokemon-random",
  {
    title: "Consultar los datos de un pokemon aleatorio",
    description:
      "Obtendremos la información del peso y la alutra de un pokemon aleatorio",
  },
  async () => {
    const res = await server.server.request(
      {
        method: "sampling/createMessage",
        params: {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: "Genera el nombre de un pokemon aleatorio existente. Devuelve solamente el nombre de este pokemon",
              },
            },
          ],
          maxTokens: 250,
        },
      },
      CreateMessageResultSchema
    );

    const name =
      res.content && res.content.type === "text" ? res.content.text : "";
    console.error("EL NOMBRE ES: ", name);

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

// PROMPTS

server.registerPrompt(
  "prompt-create",
  {
    title: "generar un pokemon",
    description: "Genera el prompt para crear un nuevo pokemon",
    argsSchema: {
      nameOrId: z.string().describe("El nombre del pokemon a buscar o su id"),
    },
  },
  ({ nameOrId }) => {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Genera el pokemon ${nameOrId} y responde con los datos en forma de tabla`,
          },
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
  try {
    const response = await fetch("http://localhost:3000/pokemons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nameOrId }),
    });

    if (!response.ok) {
      throw new Error(
        `POST fallido: ${response.status} ${response.statusText}`
      );
    }

    return await response.text();
  } catch (error) {
    console.error("SE HA PRODUCIDO UN ERROR EN EL FETCH: ", error);
    throw error;
  }
}

const app = express();

app.use(express.json());

app.post("/mcp", async (req: Request, res: Response) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error en /mcp: ", error);
    res.status(500).json({ error: "internal server error" });
  }
});

app.get("/", (_req, res) => {
  res.json({ status: "ok", name: "mcp-server-pokemon" });
});

// Ejecutar el desarrollo local con STDIO
async function runStdio() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// si no estamos en vercel y pasamos --stdio en el script vamos a ejecutarlo STANDARD
if (!process.env.VERCEL && process.argv.includes("--stdio")) {
  runStdio();
}

// Si estamos en vercel exporta la app para usar HTTP
export default app;
