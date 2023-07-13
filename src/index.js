require("dotenv").config();
const cors = require("cors");
const express = require("express");
const app = express();

app.use(cors());
const morgan = require("morgan");

const { createClient } = require("@supabase/supabase-js");

const Replicate = require("replicate");

//Configuraciones
app.set("port", process.env.PORT || 3000);
app.set("json spaces", 2);

//Middleware
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

//Nuestro primer WS Get
app.get("/", (req, res) => {
  res.json({
    Title: "Hola mundo",
  });
});

const MODELO =
  "joehoover/falcon-40b-instruct:7eb0f4b1ff770ab4f68c3a309dd4984469749b7323a3d47fd2d5e09d58836d3c";

// eslint-disable-next-line no-undef
const replicateKey = process.env.REPLICATE_KEY;

const replicate = new Replicate({ auth: replicateKey });

const TEMA = "Discos duros SSD y HDD";

async function relacionado(prompt) {
  console.log("buscando relacion con ", prompt);
  const pregunta = `la oracion "${prompt}" tiene relacion con "${TEMA}"? Responde solo "si" o "no"`;

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
}

async function preguntar(prompt) {
  console.log("preguntando ", prompt);

  const output = await replicate.run(MODELO, {
    input: { prompt, max_length: 100 },
  });
  return output.join("");
}

const supabaseUrl = "https://bgaysluggolvjnozqzep.supabase.co";

// eslint-disable-next-line no-undef
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function guardarPregunta(pagina, pregunta, respuesta) {
  console.log("guardando pregunta ", pagina, pregunta, respuesta);
  let { data, error } = await supabase
    .from("preguntas")
    .insert([{ pagina, pregunta, respuesta }])
    .select();

  console.log("guardar pregunta ", data, error);
  return data;
}

let procesando = false;

app.get("/api/preguntar", async (req, res) => {
  try {
    const { pregunta, pagina } = req.query;

    let error;

    if (procesando) {
      error = "Estoy procesando otra pregunta, intenta mas tarde";

      res.json({
        pregunta,
        error,
      });
      return;
    }

    procesando = true;

    const relacion = await relacionado(pregunta);

    if (!relacion) {
      error = "No tengo relacion con el tema, intenta con otra pregunta";

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
      error,
    });
  } catch (error) {
    procesando = false;
  } finally {
    procesando = false;
  }
});

//Iniciando el servidor
app.listen(app.get("port"), () => {
  console.log(`Server listening on port ${app.get("port")}`);
});
