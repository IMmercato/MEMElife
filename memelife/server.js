const dotenv = require("dotenv");
const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const { v2: cloudinary } = require("cloudinary");
const fse = require("fs-extra");
dotenv.config();
const app = express();

app.use(express.json());
app.use(express.static("templates"));
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({
  secret: "psw",
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}))

const cloudinaryConfig = cloudinary.config({
  cloud_name: process.env.CLOUDNAME,
  api_key: process.env.CLOUDAPIKEY,
  api_secret: process.env.CLOUDINARYSECRET,
  secure: true,
});

app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MEME time</title>
        <style>
      body {
        font-family: 'Comic Neue', cursive;
        background-color: #f0f8ff;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        margin: 0;
      }
      h1 {
        color: #ff6347;
      }
      form, button, a {
        margin: 10px;
      }
      #upload-form {
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      input[type="file"] {
        margin-bottom: 10px;
      }
      button {
        background-color: #ff6347;
        color: white;
        border: none;
        padding: 10px 20px;
        cursor: pointer;
        font-size: 16px;
      }
      button:hover {
        background-color: #ff4500;
      }
      #auth-button {
        background-color: #32cd32;
      }
      #auth-button:hover {
        background-color: #228b22;
      }
      #auth-message {
        margin-top: 20px;
        color: #ff6347;
      }
    </style>
    </head>
    <body>
        <h1>Upload a Photo</h1>
        <button id="auth-button">Sign in Anonymously</button>
        <form id="upload-form">
            <input type="file" id="file-field" accept="image/*" required />
            <button>Upload</button>
        </form>
        <p id="auth-message"></p>
        <p><a href="/view-photos">View Photos</a></p>
        <p><a href="/vote">Vote for Photos</a></p>
        <p><a href="/top-images">Top Images</a></p>
        <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
        <script type="module" src="/client-side.js"></script>
    </body>
    </html>`);
});

app.get("/vote-photos", async (req, res) => {
  try {
    await fse.ensureFile("./data.txt");
    const existingData = await fse.readFile("./data.txt", "utf8");
    const imageIds = existingData.split("\n").filter((item) => item);
    res.json(imageIds);
  } catch (error) {
    res.status(500).send("Error reading data");
  }
});

app.get("/vote", (req, res) => {
  res.sendFile(__dirname + "/templates/vote.html");
});

app.post("/vote", async (req, res) => {
  try {
    const { imageId } = req.body;
    const voteRef = db.collection("votes").doc(imageId);
    const voteDoc = await voteRef.get();

    if (voteDoc.exists) {
      await voteRef.update({
        votes: FieldValue.increment(1),
      });
    } else {
      await voteRef.set({
        votes: 1,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    res.sendStatus(200);
  } catch (error) {
    res.status(500).send("Error voting");
  }
});

app.get("/top-images", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const topImages = await db
      .collection("votes")
      .where("createdAt", ">=", today)
      .where("createdAt", "<", tomorrow)
      .orderBy("votes", "desc")
      .limit(10)
      .get();

    const topImagesData = topImages.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(topImagesData);
  } catch (error) {
    res.status(500).send("Error fetching top images");
  }
});

app.get("/get-signature", (req, res) => {
  const timestamp = Math.round(new Date().getTime() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    {
      timestamp: timestamp,
    },
    cloudinaryConfig.api_secret
  );
  res.json({ timestamp, signature });
});

app.post("/do-something-with-photo", async (req, res) => {
  try {
    const expectedSignature = cloudinary.utils.api_sign_request(
      { public_id: req.body.public_id, version: req.body.version },
      cloudinaryConfig.api_secret
    );

    if (expectedSignature === req.body.signature) {
      await fse.ensureFile("./data.txt");
      const existingData = await fse.readFile("./data.txt", "utf8");
      await fse.outputFile("./data.txt", existingData + req.body.public_id + "\n");
    }

    res.sendStatus(200);
  } catch (error) {
    res.status(500).send("Error processing photo");
  }
});

let ids = [];
app.post("/view-photos", async (req, res) => {
    const photoIds = req.body.public_ids;
    if (Array.isArray(photoIds)) {
      ids = photoIds;
      req.session.photoIds = photoIds;
      res.json({ message: "Dati ricevuti correttamente" });
    } else {
      res.status(400).json({ message: "Formato dei dati non valido" });
    }
});
app.get("/view-photos", async (req, res) => {
  res.send(`<head><title>Your MEMEs</title></head><body><h1>Hello, here are a few photos...</h1>
  <ul>
  ${ids
    .map((id) => {
      return `<li><img src="https://res.cloudinary.com/${cloudinaryConfig.cloud_name}/image/upload/w_200,h_100,c_fill,q_100/${id}.jpg">
      <form action="delete-photo" method="POST">
        <input type="hidden" name="id" value="${id}" />
        <button>Delete</button>
      </form>
      </li>
      `
    })
    .join("")}
  </ul>
  <p><a href="/">Back to homepage</a></p>
  <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
  <script type="module" src="/client-side.js"></script>
  </body>
  `)
});

app.post("/delete-photo", async (req, res) => {
  try {
    await fse.ensureFile("./data.txt");
    const existingData = await fse.readFile("./data.txt", "utf8");
    await fse.outputFile(
      "./data.txt",
      existingData
        .split("\n")
        .filter((id) => id != req.body.id)
        .join("\n")
    );

    cloudinary.uploader.destroy(req.body.id);

    res.redirect("/view-photos");
  } catch (error) {
    res.status(500).send("Error deleting photo");
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});