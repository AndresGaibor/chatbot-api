require("dotenv").config();
const cors = require("cors");
const express = require("express");
const app = express();

app.use(cors());
const morgan = require("morgan");

const { createClient } = require("@supabase/supabase-js");

const Replicate = require("replicate");

// Configuraciones
app.set("port", process.env.PORT || 3000);
app.set("json spaces", 2);

// Middleware
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Nuestro primer WS Get
app.get("/", (req, res) => {
  res.json({
    Title: "Hola mundo",
  });
});

const MODELO =
  "joehoover/falcon-40b-instruct:7eb0f4b1ff770ab4f68c3a309dd4984469749b7323a3d47fd2d5e09d58836d3c";
const replicateKey = process.env.REPLICATE_KEY;
const replicate = new Replicate({ auth: replicateKey });

const TEMA = "Discos duros SSD y HDD";

async function relacionado(prompt) {
  console.log("buscando relacion con ", prompt);
  const pregunta = `la oracion "${prompt}" tiene relacion con "${TEMA}"? Responde solo "si" o "no"`;

  try {
    const output = await replicate.run(MODELO, {
      input: {
        prompt: pregunta,
        max_length: 500,
        temperature: 1,
      },
    });

    const respuesta = output.join("");
    console.log("respuesta de relacion ", respuesta);

    if (respuesta.toLowerCase().includes("si")) {
      return true;
    }

    return false;
  } catch (error) {
    console.error("Ocurrió un error al buscar relación:", error);
    throw error;
  }
}

async function preguntar(prompt) {
  console.log("preguntando ", prompt);

  try {
    const output = await replicate.run(MODELO, {
      input: { prompt, max_length: 100 },
    });

    return output.join("");
  } catch (error) {
    console.error("Ocurrió un error al realizar la pregunta:", error);
    throw error;
  }
}

const supabaseUrl = "https://bgaysluggolvjnozqzep.supabase.co";
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function guardarPregunta(pagina, pregunta, respuesta) {
  console.log("guardando pregunta ", pagina, pregunta, respuesta);

  try {
    const { data, error } = await supabase
      .from("preguntas")
      .insert([{ pagina, pregunta, respuesta }])
      .select();

    console.log("guardar pregunta ", data, error);
    return data;
  } catch (error) {
    console.error("Ocurrió un error al guardar la pregunta:", error);
    throw error;
  }
}

let procesando = false;

app.get("/api/preguntar", async (req, res) => {
  try {
    const { pregunta, pagina } = req.query;

    if (procesando) {
      const error = "Estoy procesando otra pregunta, intenta más tarde";

      res.json({
        pregunta,
        error,
      });
      return;
    }

    procesando = true;

    const relacion = await relacionado(pregunta);

    if (!relacion) {
      const error = "No tengo relación con el tema, intenta con otra pregunta";

      res.json({
        pregunta,
        relacion,
        error,
      });
      return;
    }

    const respuesta = await preguntar(pregunta);

    if (respuesta.length > 0) {
      await guardarPregunta(pagina, pregunta, respuesta);
    }

    res.json({
      pregunta,
      respuesta,
      relacion,
      error: null,
    });
  } catch (error) {
    console.error("Ocurrió un error en la solicitud:", error);
    res.status(500).json({
      error:
        "Ocurrió un error en la solicitud. Por favor, intenta de nuevo más tarde.",
    });
  } finally {
    procesando = false;
  }
});

// Iniciando el servidor
app.listen(app.get("port"), () => {
  console.log(`Server listening on port ${app.get("port")}`);
});
