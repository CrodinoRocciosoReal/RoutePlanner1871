
const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.static("public"));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Assicurarsi che il server ascolti su tutti gli indirizzi (0.0.0.0)
// invece di solo localhost (127.0.0.1)
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server in esecuzione su http://0.0.0.0:${PORT}`);
});
