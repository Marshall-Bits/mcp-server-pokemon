"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = __importDefault(require("zod"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const express_1 = __importDefault(require("express"));
const guideText = (0, fs_1.readFileSync)(path_1.default.resolve(process.cwd(), "usage-guide.md"), "utf8");
const server = new mcp_js_1.McpServer({
    name: "hola-mcp",
    version: "0.0.1",
}, {
    capabilities: {
        resources: {},
        tools: {},
        prompts: {},
    },
});
// TOOLS
server.registerTool("consultar-pokemon", {
    title: "Consultar los datos de un pokemon a través del nombre",
    description: "Indicando solo el nombre podemos obtener la información del peso y la alutra de un pokemon",
    inputSchema: {
        name: zod_1.default.string().describe("El nombre del pokemon a buscar"),
    },
}, async (params) => {
    const { name } = params;
    const pokemonData = await fetchPokemon(name);
    return {
        content: [{ type: "text", text: pokemonData }],
    };
});
server.registerTool("consultar-pokemon-random", {
    title: "Consultar los datos de un pokemon aleatorio",
    description: "Obtendremos la información del peso y la alutra de un pokemon aleatorio",
}, async () => {
    const res = await server.server.request({
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
    }, types_js_1.CreateMessageResultSchema);
    const name = res.content && res.content.type === "text" ? res.content.text : "";
    console.error("EL NOMBRE ES: ", name);
    const pokemonData = await fetchPokemon(name);
    return {
        content: [{ type: "text", text: pokemonData }],
    };
});
server.registerTool("crear-pokemon", {
    title: "Generar un nuevo pokemon en la base de datos",
    description: "Indicando el nombre o id del pokemon se va a añadir a la base de datos",
    inputSchema: {
        nameOrId: zod_1.default.string().describe("El nombre del pokemon a buscar o su id"),
    },
}, async (params) => {
    const { nameOrId } = params;
    const data = await postPokemon(nameOrId);
    return {
        content: [{ type: "text", text: data }],
    };
});
// RESOURCES
server.registerResource("guia", "docs://pokemon/guia", // URI BASE
{
    title: "Guia para usar el MCP server",
    mimeType: "text/markdown",
}, async (uri) => {
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
});
server.registerResource("ejemplo de pokemon", new mcp_js_1.ResourceTemplate("docs://pokemon/{pokemon}", { list: undefined }), {
    title: "Objeto de ejemplo con los datos de un pokemon",
    description: "Obtenemos el recurso de un pokemon sólo con su nombre",
    mimeType: "text/plain",
}, async (uri, { pokemon }) => {
    const data = await fetchPokemon(pokemon);
    return {
        contents: [
            {
                uri: uri.href,
                mimeType: "text/plain",
                text: data,
            },
        ],
    };
});
// PROMPTS
server.registerPrompt("prompt-create", {
    title: "generar un pokemon",
    description: "Genera el prompt para crear un nuevo pokemon",
    argsSchema: {
        nameOrId: zod_1.default.string().describe("El nombre del pokemon a buscar o su id"),
    },
}, ({ nameOrId }) => {
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
});
async function fetchPokemon(name) {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${name.toLocaleLowerCase().trim()}`);
    if (!response.ok) {
        throw new Error(`Pokemon ${name} not found`);
    }
    const data = await response.json();
    return `Nombre: ${data.name}, Altura: ${data.height}, Peso: ${data.weight}`;
}
async function postPokemon(nameOrId) {
    try {
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
    catch (error) {
        console.error("SE HA PRODUCIDO UN ERROR EN EL FETCH: ", error);
        throw error;
    }
}
// ============ EXPRESS APP PARA VERCEL ============
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.post("/mcp", async (req, res) => {
    try {
        const transport = new streamableHttp_js_1.StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
        });
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    }
    catch (error) {
        console.error("Error en /mcp:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
app.get("/", (_req, res) => {
    res.json({ status: "ok", name: "pokemon-mcp" });
});
// Para desarrollo local con STDIO
async function runStdio() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
}
// Detectar entorno
if (process.env.VERCEL) {
    // Vercel usa el export default
}
else if (process.argv.includes("--stdio")) {
    runStdio();
}
// Export para Vercel
exports.default = app;
//# sourceMappingURL=server.js.map