/**
 * Point d’entrée pour OVH Cloud Web (moteur Node.js).
 * Le panneau lance ce fichier ; équivalent à `next start`.
 */
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const hostname = "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "3000", 10);

const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error("Erreur requête", err);
        res.statusCode = 500;
        res.end("Erreur interne");
      }
    }).listen(port, hostname, () => {
      console.log(`Next.js prêt sur http://${hostname}:${port}`);
    });
  })
  .catch((err) => {
    console.error("Échec démarrage Next.js", err);
    process.exit(1);
  });
